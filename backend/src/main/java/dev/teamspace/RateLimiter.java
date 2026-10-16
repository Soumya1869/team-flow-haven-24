package dev.teamspace;

import org.springframework.stereotype.Component;
import java.time.Instant;
import java.util.HashMap;

/** Single-instance limiter; use a shared gateway/Redis limiter before scaling horizontally. */
@Component
public class RateLimiter {
    private record Bucket(long window,int count) {}
    private final HashMap<String,Bucket> buckets=new HashMap<>();
    public synchronized void check(String key,int limit) {
        long window=Instant.now().getEpochSecond()/900;
        buckets.entrySet().removeIf(e -> e.getValue().window()!=window);
        var old=buckets.getOrDefault(key,new Bucket(window,0));
        if(old.count()>=limit || (buckets.size()>=10000 && !buckets.containsKey(key)))
            throw new ApiException(429,"RATE_LIMITED","Too many attempts. Try again in 15 minutes.");
        buckets.put(key,new Bucket(window,old.count()+1));
    }
}
