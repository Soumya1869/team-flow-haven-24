package dev.teamspace;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import java.util.Map;
import java.util.UUID;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties="teamspace.email-enabled=false")
@AutoConfigureMockMvc @ActiveProfiles("test")
class NoEmailIntegrationTest {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @MockitoBean Mailer mail;
    @Test void registrationLoginAndPasswordChangeWorkWithoutEmail() throws Exception {
        String email=UUID.randomUUID()+"@example.com";
        String password="StrongPassword123!";
        var result=mvc.perform(post("/api/auth/register").contentType("application/json")
            .content(json.writeValueAsString(Map.of("name","Portfolio Tester","email",email,"password",password))))
            .andExpect(status().isCreated()).andExpect(jsonPath("$.user.emailVerified").value(false)).andReturn();
        String access=json.readTree(result.getResponse().getContentAsString()).path("accessToken").asText();
        mvc.perform(post("/api/auth/password").header("Authorization","Bearer "+access).contentType("application/json")
            .content(json.writeValueAsString(Map.of("currentPassword",password,"newPassword","ChangedPassword123!"))))
            .andExpect(status().isNoContent());
        mvc.perform(post("/api/auth/login").contentType("application/json")
            .content(json.writeValueAsString(Map.of("email",email,"password","ChangedPassword123!"))))
            .andExpect(status().isOk()).andExpect(jsonPath("$.user.emailVerified").value(false));
        for(String endpoint: new String[]{"password-reset/request","password-reset/confirm","verify-email/confirm","verify-email/resend"}) {
            mvc.perform(post("/api/auth/"+endpoint).header("Authorization","Bearer "+access).contentType("application/json")
                .content(json.writeValueAsString(Map.of("email",email,"token","unused-token","newPassword","ChangedPassword123!"))))
                .andExpect(status().isServiceUnavailable()).andExpect(jsonPath("$.code").value("EMAIL_DISABLED"));
        }
        verifyNoInteractions(mail);
    }
}
