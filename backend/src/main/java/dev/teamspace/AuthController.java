package dev.teamspace;

import dev.teamspace.Contracts.*;
import jakarta.servlet.http.*;
import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.*;
import java.time.Duration;
import java.util.*;

@RestController
public class AuthController {
    private final AuthService auth; private final RateLimiter limits; private final boolean secure; private final String sameSite;
    public AuthController(AuthService auth,RateLimiter limits,@Value("${teamspace.cookie-secure}") boolean secure,@Value("${teamspace.cookie-same-site}") String sameSite) {
        this.auth=auth; this.limits=limits; this.secure=secure; this.sameSite=sameSite;
        if(!Set.of("Strict","Lax","None").contains(sameSite) || (sameSite.equals("None") && !secure)) throw new IllegalStateException("Invalid cookie settings");
    }
    void cookie(HttpServletResponse response,String value,boolean clear) {
        response.addHeader(HttpHeaders.SET_COOKIE,ResponseCookie.from("ts_refresh",value).httpOnly(true).secure(secure)
            .sameSite(sameSite).path("/api/auth").maxAge(clear?Duration.ZERO:Duration.ofDays(30)).build().toString());
        response.setHeader(HttpHeaders.CACHE_CONTROL,"no-store");
    }
    AuthResponse issued(AuthService.Issued result,HttpServletResponse response) { cookie(response,result.refresh(),false); return result.response(); }
    @GetMapping("/health") Map<String,String> health() { return Map.of("status","UP"); }
    @GetMapping("/api/auth/csrf") Map<String,String> csrf(CsrfToken token,HttpServletResponse response) {
        response.setHeader(HttpHeaders.CACHE_CONTROL,"no-store"); return Map.of("token",token.getToken());
    }
    @PostMapping("/api/auth/register") @ResponseStatus(HttpStatus.CREATED)
    AuthResponse register(@Valid @RequestBody Register body,HttpServletRequest req,HttpServletResponse res) { limits.check("register:"+req.getRemoteAddr(),10); return issued(auth.register(body,req),res); }
    @PostMapping("/api/auth/login")
    AuthResponse login(@Valid @RequestBody Login body,HttpServletRequest req,HttpServletResponse res) {
        limits.check("login-ip:"+req.getRemoteAddr(),30); limits.check("login-user:"+AuthService.hash(AuthService.email(body.email())),10);
        return issued(auth.login(body,req),res);
    }
    @PostMapping("/api/auth/refresh")
    AuthResponse refresh(@CookieValue(name="ts_refresh",required=false) String token,HttpServletResponse response) { return issued(auth.refresh(token),response); }
    @PostMapping("/api/auth/logout") @ResponseStatus(HttpStatus.NO_CONTENT)
    void logout(@CookieValue(name="ts_refresh",required=false) String token,HttpServletResponse response) { auth.logout(token); cookie(response,"",true); }
    @GetMapping("/api/auth/me") UserDto me(@AuthenticationPrincipal Jwt token) { return Contracts.user(auth.actor(token).user()); }
    @PatchMapping("/api/users/me") UserDto profile(@AuthenticationPrincipal Jwt token,@Valid @RequestBody Name name) { return auth.profile(token,name); }
    @PostMapping("/api/auth/password") @ResponseStatus(HttpStatus.NO_CONTENT)
    void password(@AuthenticationPrincipal Jwt token,@Valid @RequestBody Password body) { auth.password(token,body); }
    @PostMapping("/api/auth/password-reset/request") @ResponseStatus(HttpStatus.ACCEPTED)
    void requestReset(@Valid @RequestBody Email body,HttpServletRequest req) { limits.check("email-ip:"+req.getRemoteAddr(),10); auth.requestReset(body.email()); }
    @PostMapping("/api/auth/password-reset/confirm") @ResponseStatus(HttpStatus.NO_CONTENT)
    void reset(@Valid @RequestBody Reset body,HttpServletRequest req) { limits.check("reset:"+req.getRemoteAddr(),20); auth.reset(body); }
    @PostMapping("/api/auth/verify-email/resend") @ResponseStatus(HttpStatus.ACCEPTED)
    void resend(@AuthenticationPrincipal Jwt token) { limits.check("verify:"+token.getSubject(),5); auth.resend(token); }
    @PostMapping("/api/auth/verify-email/confirm") @ResponseStatus(HttpStatus.NO_CONTENT)
    void verify(@Valid @RequestBody Token body,HttpServletRequest req) { limits.check("verify-ip:"+req.getRemoteAddr(),20); auth.verify(body.token()); }
    @GetMapping("/api/sessions") List<SessionDto> sessions(@AuthenticationPrincipal Jwt token) { return auth.sessions(token); }
    @DeleteMapping("/api/sessions/others") @ResponseStatus(HttpStatus.NO_CONTENT)
    void others(@AuthenticationPrincipal Jwt token) { auth.revokeOthers(token); }
    @DeleteMapping("/api/sessions/{id}") @ResponseStatus(HttpStatus.NO_CONTENT)
    void revoke(@AuthenticationPrincipal Jwt token,@PathVariable UUID id) { auth.revoke(token,id); }
}
