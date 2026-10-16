package dev.teamspace;

import jakarta.validation.constraints.*;
import java.time.*;
import java.util.UUID;
import static dev.teamspace.Model.*;

public final class Contracts {
    private Contracts() {}
    public record Login(@NotBlank @jakarta.validation.constraints.Email @Size(max=254) String email,@NotBlank @Size(max=72) String password) {}
    public record Register(@NotBlank @Size(max=80) String name,@NotBlank @jakarta.validation.constraints.Email @Size(max=254) String email,@Size(min=12,max=72) @NotNull String password) {}
    public record Password(@NotBlank @Size(max=72) String currentPassword,@NotNull @Size(min=12,max=72) String newPassword) {}
    public record Name(@NotBlank @Size(max=80) String name) {}
    public record Email(@NotBlank @jakarta.validation.constraints.Email @Size(max=254) String email) {}
    public record Reset(@NotBlank @Size(max=200) String token,@NotNull @Size(min=12,max=72) String newPassword) {}
    public record Token(@NotBlank @Size(max=200) String token) {}
    public record AddMember(@NotBlank @jakarta.validation.constraints.Email String email,@NotNull Role role) {}
    public record ChangeRole(@NotNull Role role) {}
    public record NewProject(@NotBlank @Pattern(regexp="^[A-Z][A-Z0-9]{1,5}$") String key,@NotBlank @Size(max=80) String name,@NotNull @Size(max=5000) String description) {}
    public record NewTask(@NotBlank @Size(max=200) String title,@Size(max=5000) String description,Status status,@NotNull Priority priority,UUID assigneeId,LocalDate dueDate) {}
    public record Move(@NotNull Status status,@NotNull @PositiveOrZero Double position) {}
    public record NewComment(@NotBlank @Size(max=2000) String body) {}
    public record UserDto(UUID id,String name,String email,boolean emailVerified,Instant createdAt) {}
    public record AuthResponse(String accessToken,long expiresIn,UserDto user) {}
    public record WorkspaceDto(UUID id,String name,String slug,Role role,long memberCount) {}
    public record MemberDto(UUID userId,String name,String email,Role role,Instant joinedAt) {}
    public record ProjectDto(UUID id,UUID workspaceId,String key,String name,String description,int colorIndex,long taskCount,long doneCount,Instant createdAt) {}
    public record TaskDto(UUID id,UUID projectId,String key,String title,String description,Status status,Priority priority,UUID assigneeId,UUID createdById,LocalDate dueDate,double position,long commentCount,Instant createdAt,Instant updatedAt) {}
    public record Author(UUID id,String name) {}
    public record CommentDto(UUID id,UUID taskId,Author author,String body,Instant createdAt) {}
    public record SessionDto(UUID id,String userAgent,String ipAddress,Instant createdAt,Instant lastUsedAt,boolean current) {}
    public static UserDto user(User u) { return new UserDto(u.id,u.name,u.email,u.emailVerified,u.createdAt); }
}
