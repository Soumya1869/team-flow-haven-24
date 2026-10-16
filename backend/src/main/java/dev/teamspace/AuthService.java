package dev.teamspace;

import dev.teamspace.Model.*;
import dev.teamspace.Contracts.*;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.*;
import java.util.*;
import java.security.*;
import java.nio.charset.StandardCharsets;

@Service
@Transactional
public class AuthService {
    private final Store db; private final PasswordEncoder passwords; private final JwtEncoder jwt; private final Mailer mail;
    private final String dummyHash;
    public record Issued(AuthResponse response,String refresh) {}
    public record Actor(User user,Session session) { public UUID id() { return user.id; } }
    public AuthService(Store db,PasswordEncoder passwords,JwtEncoder jwt,Mailer mail) {
        this.db=db; this.passwords=passwords; this.jwt=jwt; this.mail=mail;
        dummyHash=passwords.encode(UUID.randomUUID().toString());
    }
    static String email(String input) { return input.trim().toLowerCase(Locale.ROOT); }
    static String randomToken() { byte[] b=new byte[32]; new SecureRandom().nextBytes(b); return Base64.getUrlEncoder().withoutPadding().encodeToString(b); }
    static String hash(String input) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(input.getBytes(StandardCharsets.UTF_8))); }
        catch(NoSuchAlgorithmException e) { throw new IllegalStateException(e); }
    }
    void validatePassword(String value) {
        if(value==null || value.length()<12 || value.getBytes(StandardCharsets.UTF_8).length>72)
            throw new ApiException(400,"VALIDATION_ERROR","Password must be at least 12 characters and no more than 72 UTF-8 bytes");
    }
    public Actor actor(Jwt token) {
        if(token==null) throw ApiException.unauthorized();
        try {
            var user=db.get(User.class,UUID.fromString(token.getSubject()));
            var session=db.get(Session.class,UUID.fromString(token.getClaimAsString("sid")));
            if(user==null || session==null || !session.userId.equals(user.id) || session.revokedAt!=null || !session.expiresAt.isAfter(Instant.now())) throw ApiException.unauthorized();
            return new Actor(user,session);
        } catch(IllegalArgumentException e) { throw ApiException.unauthorized(); }
    }
    public Issued register(Register body,HttpServletRequest request) {
        validatePassword(body.password());
        if(findEmail(body.email())!=null) throw new ApiException(409,"EMAIL_EXISTS","Email is already registered");
        var u=new User(); u.email=email(body.email()); u.name=body.name().trim(); u.passwordHash=passwords.encode(body.password()); db.save(u);
        sendToken(u,"VERIFY"); return start(u,request);
    }
    User findEmail(String email) { return db.one(User.class,"from AppUser where email=?1",email(email)); }
    public Issued login(Login body,HttpServletRequest request) {
        var u=findEmail(body.email());
        boolean matches=body.password().getBytes(StandardCharsets.UTF_8).length<=72 && passwords.matches(body.password(),u==null?dummyHash:u.passwordHash);
        if(!matches || u==null) throw new ApiException(401,"INVALID_CREDENTIALS","Invalid email or password");
        // Serialize with password changes/reset to avoid issuing a session after revocation.
        u=db.lock(User.class,u.id);
        db.refresh(u);
        if(!passwords.matches(body.password(),u.passwordHash)) throw new ApiException(401,"INVALID_CREDENTIALS","Invalid email or password");
        return start(u,request);
    }
    Issued start(User u,HttpServletRequest req) {
        var s=new Session(); s.userId=u.id;
        String agent=Objects.toString(req.getHeader("User-Agent"),"Unknown client");
        s.userAgent=agent.substring(0,Math.min(agent.length(),1000)); s.ipAddress=req.getRemoteAddr(); db.save(s);
        return issue(u,s);
    }
    Issued issue(User u,Session s) {
        String raw=randomToken(); var r=new RefreshToken(); r.sessionId=s.id; r.hash=hash(raw); r.expiresAt=s.expiresAt; db.save(r);
        s.lastUsedAt=Instant.now();
        var claims=JwtClaimsSet.builder().issuer("teamspace").subject(u.id.toString()).issuedAt(Instant.now())
            .expiresAt(Instant.now().plusSeconds(600)).claim("sid",s.id.toString()).build();
        String access=jwt.encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(),claims)).getTokenValue();
        return new Issued(new AuthResponse(access,600,Contracts.user(u)),raw);
    }
    // A rejected replay must COMMIT the session revocation rather than roll it back.
    @Transactional(noRollbackFor=ApiException.class)
    public Issued refresh(String raw) {
        if(raw==null || raw.length()>200) throw ApiException.unauthorized();
        var r=db.one(RefreshToken.class,"from RefreshToken where hash=?1",hash(raw));
        if(r==null) throw ApiException.unauthorized();
        var s=db.lock(Session.class,r.sessionId);
        // Reload token after acquiring the family lock: concurrent rotations must see usedAt.
        db.refresh(r);
        if(s==null || s.revokedAt!=null || !s.expiresAt.isAfter(Instant.now())) throw ApiException.unauthorized();
        if(r.usedAt!=null) { s.revokedAt=Instant.now(); throw ApiException.unauthorized(); }
        if(!r.expiresAt.isAfter(Instant.now())) throw ApiException.unauthorized();
        r.usedAt=Instant.now();
        var result=issue(db.get(User.class,s.userId),s);
        r.replacedBy=db.one(RefreshToken.class,"from RefreshToken where hash=?1",hash(result.refresh())).id;
        return result;
    }
    public void logout(String raw) {
        if(raw==null || raw.length()>200) return;
        var r=db.one(RefreshToken.class,"from RefreshToken where hash=?1",hash(raw));
        if(r!=null) db.lock(Session.class,r.sessionId).revokedAt=Instant.now();
    }
    public UserDto profile(Jwt token,Name name) { var a=actor(token); a.user.name=name.name().trim(); return Contracts.user(a.user); }
    public List<SessionDto> sessions(Jwt token) {
        var a=actor(token);
        return db.list(Session.class,"from LoginSession where userId=?1 and revokedAt is null and expiresAt>?2 order by createdAt desc",a.id(),Instant.now())
            .stream().map(s -> new SessionDto(s.id,s.userAgent,s.ipAddress,s.createdAt,s.lastUsedAt,s.id.equals(a.session.id))).toList();
    }
    public void revoke(Jwt token,UUID id) {
        var a=actor(token); var s=db.lock(Session.class,id);
        if(s==null || !s.userId.equals(a.id())) throw ApiException.missing(); s.revokedAt=Instant.now();
    }
    public void revokeOthers(Jwt token) { var a=actor(token); revokeAll(a.id(),a.session.id); }
    void revokeAll(UUID user,UUID except) {
        for(var s:db.list(Session.class,"from LoginSession where userId=?1 and revokedAt is null",user))
            if(!s.id.equals(except)) db.lock(Session.class,s.id).revokedAt=Instant.now();
    }
    public void password(Jwt token,Password body) {
        var a=actor(token); var u=db.lock(User.class,a.id()); db.refresh(u); validatePassword(body.newPassword());
        if(!passwords.matches(body.currentPassword(),u.passwordHash)) throw new ApiException(400,"INVALID_PASSWORD","Current password is incorrect");
        u.passwordHash=passwords.encode(body.newPassword()); revokeAll(u.id,a.session.id); invalidateEmailTokens(u.id,"RESET");
    }
    void invalidateEmailTokens(UUID user,String purpose) {
        db.list(EmailToken.class,"from EmailToken where userId=?1 and purpose=?2 and usedAt is null",user,purpose).forEach(t -> t.usedAt=Instant.now());
    }
    void sendToken(User u,String purpose) {
        invalidateEmailTokens(u.id,purpose);
        String raw=randomToken(); var t=new EmailToken(); t.userId=u.id; t.hash=hash(raw); t.purpose=purpose;
        t.expiresAt=Instant.now().plus(purpose.equals("RESET")?Duration.ofMinutes(30):Duration.ofHours(24)); db.save(t);
        mail.send(u.email,purpose,raw);
    }
    public void requestReset(String email) {
        var u=findEmail(email);
        if(u!=null) {
            db.lock(User.class,u.id);
            try { sendToken(u,"RESET"); }
            catch(org.springframework.mail.MailException e) {
                // Keep the same public response even during mail outages; never log tokens or recipient data.
                org.slf4j.LoggerFactory.getLogger(AuthService.class).warn("Password reset mail delivery failed; check SMTP availability");
            }
        }
    }
    public void resend(Jwt token) { var a=actor(token); db.lock(User.class,a.id()); if(!a.user.emailVerified) sendToken(a.user,"VERIFY"); }
    EmailToken consume(String raw,String purpose) {
        var t=db.one(EmailToken.class,"from EmailToken where hash=?1 and purpose=?2",hash(raw),purpose);
        if(t==null) throw new ApiException(400,"INVALID_TOKEN","Token is invalid or expired");
        db.lock(User.class,t.userId); db.refresh(t);
        if(t.usedAt!=null || !t.expiresAt.isAfter(Instant.now())) throw new ApiException(400,"INVALID_TOKEN","Token is invalid or expired");
        t.usedAt=Instant.now(); return t;
    }
    public void reset(Reset body) {
        validatePassword(body.newPassword()); var t=consume(body.token(),"RESET");
        db.get(User.class,t.userId).passwordHash=passwords.encode(body.newPassword()); revokeAll(t.userId,null); invalidateEmailTokens(t.userId,"RESET");
    }
    public void verify(String raw) { var t=consume(raw,"VERIFY"); db.get(User.class,t.userId).emailVerified=true; }
}
