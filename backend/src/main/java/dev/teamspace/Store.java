package dev.teamspace;

import jakarta.persistence.*;
import org.springframework.stereotype.Repository;
import java.util.*;

@Repository
public class Store {
    @PersistenceContext EntityManager em;
    public <T> T save(T value) { em.persist(value); return value; }
    public void delete(Object value) { em.remove(value); }
    public void refresh(Object value) { em.refresh(value); }
    public <T> T get(Class<T> type, UUID id) { return em.find(type, id); }
    public <T> T lock(Class<T> type, UUID id) { return em.find(type, id, LockModeType.PESSIMISTIC_WRITE); }
    public <T> List<T> list(Class<T> type, String jpql, Object... args) {
        var q = em.createQuery(jpql, type);
        for (int i=0; i<args.length; i++) q.setParameter(i+1, args[i]);
        return q.getResultList();
    }
    public <T> T one(Class<T> type, String jpql, Object... args) {
        var rows = list(type, jpql, args); return rows.isEmpty() ? null : rows.getFirst();
    }
}
