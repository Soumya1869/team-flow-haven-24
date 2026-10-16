package dev.teamspace;

import com.fasterxml.jackson.databind.*;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.*;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import java.util.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest @AutoConfigureMockMvc @ActiveProfiles("test")
class ApiIntegrationTest {
    @Autowired MockMvc mvc; @Autowired ObjectMapper json;
    @Autowired org.springframework.jdbc.core.JdbcTemplate jdbc;
    @Autowired org.springframework.security.oauth2.jwt.JwtEncoder encoder;
    @MockitoBean Mailer mail;
    @MockitoBean RateLimiter limits;
    record Account(String access,String refresh,String id,String email) {}
    Account register() throws Exception {
        String email=UUID.randomUUID()+"@example.com";
        var r=mvc.perform(post("/api/auth/register").contentType("application/json").content(json.writeValueAsString(Map.of("name","Tester","email",email,"password","StrongPassword123!"))))
            .andExpect(status().isCreated()).andReturn();
        var data=json.readTree(r.getResponse().getContentAsString());
        String cookie=r.getResponse().getHeader("Set-Cookie");
        assertTrue(cookie.contains("HttpOnly")); assertTrue(cookie.contains("Path=/api/auth"));
        return new Account(data.path("accessToken").asText(),cookie.split(";",2)[0].substring("ts_refresh=".length()),data.path("user").path("id").asText(),email);
    }
    JsonNode call(String method,String path,Account account,Object body,int expected) throws Exception {
        MockHttpServletRequestBuilder req=switch(method) { case "GET" -> get(path); case "POST" -> post(path); case "PATCH" -> patch(path); case "DELETE" -> delete(path); default -> throw new IllegalArgumentException(); };
        if(account!=null) req.header("Authorization","Bearer "+account.access);
        if(body!=null) req.contentType("application/json").content(json.writeValueAsString(body));
        var result=mvc.perform(req).andExpect(status().is(expected)).andReturn();
        String text=result.getResponse().getContentAsString(); return text.isBlank()?json.nullNode():json.readTree(text);
    }
    String workspace(Account a) throws Exception { return call("POST","/api/workspaces",a,Map.of("name","Engineering"),201).path("id").asText(); }
    String project(Account a,String ws) throws Exception { return call("POST","/api/workspaces/"+ws+"/projects",a,Map.of("key","APP","name","Portal","description",""),201).path("id").asText(); }
    @Test void workspaceIsolationRolesAndLastOwner() throws Exception {
        var owner=register(); var member=register(); var outsider=register(); String ws=workspace(owner); String base="/api/workspaces/"+ws;
        call("GET",base+"/projects",outsider,null,403);
        call("POST",base+"/members",owner,Map.of("email",member.email,"role","MEMBER"),201);
        call("POST",base+"/projects",member,Map.of("key","XX","name","Forbidden","description",""),403);
        call("PATCH",base+"/members/"+owner.id,owner,Map.of("role","MEMBER"),409);
        call("DELETE",base+"/members/"+owner.id,owner,null,409);
        String p=project(owner,ws); String other=workspace(owner); String otherP=project(owner,other);
        call("GET",base+"/projects/"+otherP+"/tasks",owner,null,404);
        var task=call("POST",base+"/projects/"+p+"/tasks",member,Map.of("title","Build API","priority","HIGH","assigneeId",owner.id),201);
        String id=task.path("id").asText();
        call("PATCH","/api/workspaces/"+other+"/tasks/"+id,owner,Map.of("title","Stolen"),404);
        call("PATCH",base+"/tasks/"+id,owner,Map.of("assigneeId",outsider.id),400);
        call("PATCH",base+"/tasks/"+id,owner,Map.of("title"," "),400);
        var cleared=new HashMap<String,Object>(); cleared.put("assigneeId",null); cleared.put("dueDate",null);
        assertTrue(call("PATCH",base+"/tasks/"+id,owner,cleared,200).path("assigneeId").isNull());
        var comment=call("POST",base+"/tasks/"+id+"/comments",owner,Map.of("body","Review this"),201);
        call("DELETE",base+"/comments/"+comment.path("id").asText(),member,null,403);
        call("PATCH",base+"/members/"+member.id,owner,Map.of("role","ADMIN"),200);
        call("POST",base+"/members",member,Map.of("email",outsider.email,"role","ADMIN"),403);
        call("DELETE",base+"/projects/"+p,owner,null,204);
        call("GET",base+"/tasks/"+id+"/comments",owner,null,404);
    }
    record Csrf(String token,Cookie cookie) {}
    Csrf csrf() throws Exception {
        var result=mvc.perform(get("/api/auth/csrf")).andExpect(status().isOk()).andReturn().getResponse();
        String token=json.readTree(result.getContentAsString()).path("token").asText();
        return new Csrf(token,new Cookie("XSRF-TOKEN",token));
    }
    MvcResult refresh(String token,int expected) throws Exception {
        var c=csrf(); return mvc.perform(post("/api/auth/refresh").cookie(new Cookie("ts_refresh",token),c.cookie).header("X-XSRF-TOKEN",c.token)).andExpect(status().is(expected)).andReturn();
    }
    @Test void rotationReplayRevokesFamilyAndAccessToken() throws Exception {
        var a=register();
        mvc.perform(post("/api/auth/refresh").cookie(new Cookie("ts_refresh",a.refresh))).andExpect(status().isForbidden());
        var r=refresh(a.refresh,200); String newCookie=r.getResponse().getHeader("Set-Cookie").split(";",2)[0].substring("ts_refresh=".length());
        refresh(a.refresh,401); refresh(newCookie,401); call("GET","/api/auth/me",a,null,401);
    }
    @Test void logoutAndSessionOwnership() throws Exception {
        var a=register(); var b=register();
        var sessions=call("GET","/api/sessions",a,null,200); String id=sessions.get(0).path("id").asText();
        call("DELETE","/api/sessions/"+id,b,null,404);
        var c=csrf(); mvc.perform(post("/api/auth/logout").cookie(c.cookie,new Cookie("ts_refresh",a.refresh)).header("X-XSRF-TOKEN",c.token)).andExpect(status().isNoContent());
        refresh(a.refresh,401); call("GET","/api/auth/me",a,null,401);
    }
    @Test void corsAndInvalidBearer() throws Exception {
        mvc.perform(options("/api/workspaces").header("Origin","https://evil.example").header("Access-Control-Request-Method","POST")).andExpect(status().isForbidden());
        mvc.perform(options("/api/workspaces").header("Origin","http://localhost:5173").header("Access-Control-Request-Method","POST")).andExpect(status().isOk());
        mvc.perform(get("/api/auth/me").header("Authorization","Bearer invalid.jwt.token")).andExpect(status().isUnauthorized());
        call("GET","/api/workspaces",null,null,401);
    }
    @Test void passwordResetTokensAreSingleUseAndRevokeSessions() throws Exception {
        var a=register();
        call("POST","/api/auth/password-reset/request",null,Map.of("email",a.email),202);
        var captor=org.mockito.ArgumentCaptor.forClass(String.class);
        verify(mail).send(eq(a.email),eq("RESET"),captor.capture()); String token=captor.getValue();
        call("POST","/api/auth/password-reset/confirm",null,Map.of("token",token,"newPassword","ChangedPassword456!"),204);
        refresh(a.refresh,401);
        call("POST","/api/auth/password-reset/confirm",null,Map.of("token",token,"newPassword","ChangedPassword789!"),400);
        call("POST","/api/auth/login",null,Map.of("email",a.email,"password","StrongPassword123!"),401);
        call("POST","/api/auth/login",null,Map.of("email",a.email,"password","ChangedPassword456!"),200);
    }
    @Test void expiredRefreshAndExpiredSignedJwtAreRejected() throws Exception {
        var a=register();
        jdbc.update("update refresh_tokens set expires_at=? where hash=?",java.sql.Timestamp.from(java.time.Instant.now().minusSeconds(3600)),AuthService.hash(a.refresh));
        refresh(a.refresh,401);
        var claims=org.springframework.security.oauth2.jwt.JwtClaimsSet.builder().issuer("teamspace").subject(a.id)
            .issuedAt(java.time.Instant.now().minusSeconds(7200)).expiresAt(java.time.Instant.now().minusSeconds(3600)).build();
        var header=org.springframework.security.oauth2.jwt.JwsHeader.with(org.springframework.security.oauth2.jose.jws.MacAlgorithm.HS256).build();
        String expired=encoder.encode(org.springframework.security.oauth2.jwt.JwtEncoderParameters.from(header,claims)).getTokenValue();
        mvc.perform(get("/api/auth/me").header("Authorization","Bearer "+expired)).andExpect(status().isUnauthorized());
    }
    @Test void emailVerificationAndPasswordChange() throws Exception {
        var a=register();
        var captor=org.mockito.ArgumentCaptor.forClass(String.class); verify(mail).send(eq(a.email),eq("VERIFY"),captor.capture());
        call("POST","/api/auth/verify-email/confirm",null,Map.of("token",captor.getValue()),204);
        assertTrue(call("GET","/api/auth/me",a,null,200).path("emailVerified").asBoolean());
        call("POST","/api/auth/verify-email/confirm",null,Map.of("token",captor.getValue()),400);
        var login=call("POST","/api/auth/login",null,Map.of("email",a.email,"password","StrongPassword123!"),200);
        var second=new Account(login.path("accessToken").asText(),"",a.id,a.email);
        call("POST","/api/auth/password",a,Map.of("currentPassword","wrong-password","newPassword","NewPassword456!"),400);
        call("POST","/api/auth/password",a,Map.of("currentPassword","StrongPassword123!","newPassword","NewPassword456!"),204);
        call("GET","/api/auth/me",second,null,401); call("GET","/api/auth/me",a,null,200);
    }
    @Test void simultaneousOwnerDemotionsLeaveOneOwner() throws Exception {
        var a=register(); var b=register(); String ws=workspace(a); String base="/api/workspaces/"+ws;
        call("POST",base+"/members",a,Map.of("email",b.email,"role","OWNER"),201);
        try(var pool=java.util.concurrent.Executors.newFixedThreadPool(2)) {
            var start=new java.util.concurrent.CountDownLatch(1);
            java.util.concurrent.Callable<Integer> first=() -> { start.await(); return mvc.perform(patch(base+"/members/"+a.id).header("Authorization","Bearer "+a.access).contentType("application/json").content("{\"role\":\"MEMBER\"}")).andReturn().getResponse().getStatus(); };
            java.util.concurrent.Callable<Integer> second=() -> { start.await(); return mvc.perform(patch(base+"/members/"+b.id).header("Authorization","Bearer "+b.access).contentType("application/json").content("{\"role\":\"MEMBER\"}")).andReturn().getResponse().getStatus(); };
            var x=pool.submit(first); var y=pool.submit(second); start.countDown();
            var statuses=new ArrayList<>(List.of(x.get(15,java.util.concurrent.TimeUnit.SECONDS),y.get(15,java.util.concurrent.TimeUnit.SECONDS))); Collections.sort(statuses);
            assertEquals(List.of(200,409),statuses);
        }
        var members=call("GET",base+"/members",a,null,200);
        int owners=0; for(var m:members) if(m.path("role").asText().equals("OWNER")) owners++;
        assertEquals(1,owners);
    }
    @Test void taskMoveSearchAndMemberRemoval() throws Exception {
        var a=register(); var b=register(); String ws=workspace(a); String base="/api/workspaces/"+ws;
        call("POST",base+"/members",a,Map.of("email",b.email,"role","MEMBER"),201);
        String p=project(a,ws);
        String id=call("POST",base+"/projects/"+p+"/tasks",a,Map.of("title","Unique invoice","priority","URGENT","assigneeId",b.id),201).path("id").asText();
        call("DELETE",base+"/tasks/"+id,b,null,403);
        assertEquals("DONE",call("POST",base+"/tasks/"+id+"/move",b,Map.of("status","DONE","position",100),200).path("status").asText());
        assertEquals(1,call("GET",base+"/projects/"+p+"/tasks?q=invoice&status=DONE",a,null,200).size());
        call("DELETE",base+"/members/"+b.id,a,null,204);
        assertTrue(call("GET",base+"/projects/"+p+"/tasks",a,null,200).get(0).path("assigneeId").isNull());
        call("GET",base+"/projects/"+p+"/tasks",b,null,403);
    }
}
