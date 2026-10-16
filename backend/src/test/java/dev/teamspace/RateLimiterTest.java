package dev.teamspace;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
class RateLimiterTest {
    @Test void limitsOneKeyWithoutBlockingOthers() {
        var limiter=new RateLimiter(); limiter.check("a",2); limiter.check("a",2);
        var error=assertThrows(ApiException.class,() -> limiter.check("a",2));
        assertEquals(429,error.status); assertDoesNotThrow(() -> limiter.check("b",2));
    }
}
