package dev.teamspace;

import jakarta.persistence.*;
import java.time.*;
import java.util.UUID;

/** Persistence objects stay internal. Controllers return explicitly mapped DTOs only. */
public final class Model {
    private Model() {}
    public enum Role { MEMBER, ADMIN, OWNER }
    public enum Status { TODO, IN_PROGRESS, IN_REVIEW, DONE }
    public enum Priority { LOW, MEDIUM, HIGH, URGENT }
    @MappedSuperclass
    public static abstract class Row {
        @Id public UUID id = UUID.randomUUID();
        public Instant createdAt = Instant.now();
    }
    @Entity(name="AppUser") @Table(name="users")
    public static class User extends Row {
        public String name;
        public String email;
        public String passwordHash;
        public boolean emailVerified;
    }
    @Entity(name="Workspace") @Table(name="workspaces")
    public static class Workspace extends Row { public String name; public String slug; }
    @Entity(name="Membership") @Table(name="memberships")
    public static class Membership extends Row {
        public UUID workspaceId; public UUID userId;
        @Enumerated(EnumType.STRING) public Role role;
    }
    @Entity(name="Project") @Table(name="projects")
    public static class Project extends Row {
        public UUID workspaceId;
        @Column(name="project_key") public String key;
        public String name;
        @Column(length=5000) public String description;
        public int colorIndex; public long nextNumber = 1;
    }
    @Entity(name="Task") @Table(name="tasks")
    public static class Task extends Row {
        public UUID workspaceId; public UUID projectId;
        @Column(name="task_key") public String key;
        public String title;
        @Column(length=5000) public String description;
        @Enumerated(EnumType.STRING) public Status status;
        @Enumerated(EnumType.STRING) public Priority priority;
        public UUID assigneeId; public UUID createdById;
        public LocalDate dueDate; public double position;
        public Instant updatedAt = Instant.now();
    }
    @Entity(name="TaskComment") @Table(name="comments")
    public static class Comment extends Row {
        public UUID workspaceId; public UUID taskId; public UUID authorId;
        @Column(length=2000) public String body;
    }
    @Entity(name="LoginSession") @Table(name="sessions")
    public static class Session extends Row {
        public UUID userId;
        @Column(length=1000) public String userAgent;
        public String ipAddress;
        public Instant lastUsedAt = Instant.now();
        public Instant expiresAt = Instant.now().plus(Duration.ofDays(30));
        public Instant revokedAt;
    }
    @Entity(name="RefreshToken") @Table(name="refresh_tokens")
    public static class RefreshToken extends Row {
        public UUID sessionId; public String hash; public Instant expiresAt;
        public Instant usedAt; public UUID replacedBy;
    }
    @Entity(name="EmailToken") @Table(name="email_tokens")
    public static class EmailToken extends Row {
        public UUID userId; public String hash; public String purpose;
        public Instant expiresAt; public Instant usedAt;
    }
}
