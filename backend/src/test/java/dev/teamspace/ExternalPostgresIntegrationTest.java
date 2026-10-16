package dev.teamspace;

import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

/** Run against a dedicated, disposable PostgreSQL database without requiring Docker. */
@EnabledIfEnvironmentVariable(named="POSTGRES_TEST_URL",matches="jdbc:postgresql:.*")
class ExternalPostgresIntegrationTest extends ApiIntegrationTest {
    @DynamicPropertySource static void database(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url",() -> System.getenv("POSTGRES_TEST_URL"));
        registry.add("spring.datasource.username",() -> System.getenv("POSTGRES_TEST_USER"));
        registry.add("spring.datasource.password",() -> System.getenv("POSTGRES_TEST_PASSWORD"));
    }
}
