package dev.teamspace;

import com.nimbusds.jose.jwk.source.ImmutableSecret;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.*;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.*;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.csrf.*;
import org.springframework.web.cors.*;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.*;

@Configuration
public class SecurityConfig {
    @Bean PasswordEncoder passwordEncoder() { return new BCryptPasswordEncoder(12); }
    @Bean SecretKeySpec jwtKey(@Value("${teamspace.jwt-secret}") String secret) {
        byte[] bytes;
        try { bytes=Base64.getDecoder().decode(secret); } catch (IllegalArgumentException e) { throw new IllegalStateException("JWT_SECRET must be base64",e); }
        if(bytes.length<32) throw new IllegalStateException("JWT_SECRET must contain at least 32 random bytes");
        return new SecretKeySpec(bytes,"HmacSHA256");
    }
    @Bean JwtEncoder encoder(SecretKeySpec key) { return new NimbusJwtEncoder(new ImmutableSecret<>(key)); }
    @Bean JwtDecoder decoder(SecretKeySpec key) {
        var decoder=NimbusJwtDecoder.withSecretKey(key).macAlgorithm(MacAlgorithm.HS256).build();
        decoder.setJwtValidator(JwtValidators.createDefaultWithIssuer("teamspace")); return decoder;
    }
    @Bean SecurityFilterChain chain(HttpSecurity http, CorsConfigurationSource cors,
            @Value("${teamspace.cookie-secure}") boolean secure,@Value("${teamspace.cookie-same-site}") String sameSite) throws Exception {
        var csrf=CookieCsrfTokenRepository.withHttpOnlyFalse();
        csrf.setCookieCustomizer(c -> c.path("/").secure(secure).sameSite(sameSite));
        http.cors(c -> c.configurationSource(cors))
            .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
            .csrf(c -> c.csrfTokenRepository(csrf).csrfTokenRequestHandler(new CsrfTokenRequestAttributeHandler())
                .requireCsrfProtectionMatcher(r -> !Set.of("GET","HEAD","OPTIONS").contains(r.getMethod()) &&
                    Set.of("/api/auth/refresh","/api/auth/logout").contains(r.getRequestURI().substring(r.getContextPath().length()))))
            .authorizeHttpRequests(a -> a
                .requestMatchers("/api/auth/login","/api/auth/register","/api/auth/csrf","/api/auth/refresh","/api/auth/logout",
                    "/api/auth/password-reset/request","/api/auth/password-reset/confirm","/api/auth/verify-email/confirm","/health").permitAll()
                .anyRequest().authenticated())
            .oauth2ResourceServer(o -> o.jwt(j -> {}).authenticationEntryPoint((r,s,e) -> error(s,401,"UNAUTHENTICATED")))
            .exceptionHandling(e -> e.authenticationEntryPoint((r,s,x) -> error(s,401,"UNAUTHENTICATED"))
                .accessDeniedHandler((r,s,x) -> error(s,403,"FORBIDDEN")));
        return http.build();
    }
    static void error(HttpServletResponse response,int status,String code) throws java.io.IOException {
        response.setStatus(status); response.setContentType("application/problem+json");
        response.getWriter().write("{\"status\":"+status+",\"code\":\""+code+"\",\"detail\":\"Authentication or CSRF validation failed\"}");
    }
    @Bean CorsConfigurationSource cors(@Value("${teamspace.allowed-origins}") String origins) {
        var allowed=Arrays.stream(origins.split(",")).map(String::trim).toList();
        if(allowed.stream().anyMatch(s -> s.contains("*") || s.isBlank())) throw new IllegalStateException("Exact CORS origins required");
        var c=new CorsConfiguration(); c.setAllowedOrigins(allowed); c.setAllowCredentials(true);
        c.setAllowedMethods(List.of("GET","POST","PATCH","DELETE","OPTIONS"));
        c.setAllowedHeaders(List.of("Authorization","Content-Type","X-XSRF-TOKEN","Accept"));
        var source=new UrlBasedCorsConfigurationSource(); source.registerCorsConfiguration("/**",c); return source;
    }
}
