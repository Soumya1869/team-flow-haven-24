# TeamSpace API contract (Spring Boot)

The base path is `/api`, and every body is JSON. The DTO source of truth is `src/lib/api/types.ts`; mirror each type as a Java `record` with Bean Validation annotations.
Errors use RFC 7807 `ProblemDetail`: `{ type, title, status, detail, code, errors?: { field: message } }`.

## Auth model

| Concern | Rule |
|---|---|
| Passwords | Argon2id or BCrypt (cost ≥ 12). The minimum length is 12. Never logged. |
| Access token | A JWT (HS256/RS256) that lives 10–15 minutes, with claims `sub` and `iat/exp`. Workspace roles are **not** in the token: load them per request. It is returned in the body and kept **in memory** by the SPA. |
| Refresh token | Opaque random value (256-bit). Only its SHA-256 hash is stored in `refresh_tokens(session_id, hash, expires_at, revoked_at, replaced_by)`. It is sent as the cookie `ts_refresh` with `HttpOnly; Secure; SameSite=Strict; Path=/api/auth`. |
| Rotation | Every `/auth/refresh` call issues a new token and marks the old one replaced. **Reusing a replaced token revokes the whole session family** (theft detection). |
| CSRF | `CookieCsrfTokenRepository.withHttpOnlyFalse()` applies to cookie-authenticated endpoints (`/auth/refresh`, `/auth/logout`). The SPA echoes the `XSRF-TOKEN` cookie as `X-XSRF-TOKEN`. Bearer-only endpoints are not cookie-authenticated. |
| CORS | Exact allowed origins come from config, with `allowCredentials=true`. No wildcards. |
| Email | Verification and reset tokens are single-use, stored hashed, and expire after 24 h and 30 min respectively. Reset requests always return `202`, so the endpoint never reveals whether an account exists. |

## Status codes

- **401**: missing, expired or invalid access token, or a revoked/unknown refresh token. The SPA retries once after `/auth/refresh`, then sends the user to the sign-in page.
- **403**: authenticated, but either not a member of `{ws}` or the role is insufficient (e.g. MEMBER creating a project).
- **404**: the resource doesn't exist **or belongs to a different workspace** than `{ws}`. Every repository query is scoped by `workspaceId`, e.g. `findByIdAndWorkspaceId`.
- **409**: conflicts: duplicate email or project key, already a member, or removing/demoting the last owner.
- **400**: validation errors, or an assignee who isn't a workspace member.

## Endpoints

### Auth and account
| Method | Path | Body → Response | Notes |
|---|---|---|---|
| GET | `/auth/csrf` | → `{ token }` | Sets the CSRF cookie; response token is held in SPA memory and echoed as `X-XSRF-TOKEN`. Supports separate API origins. |
| POST | `/auth/register` | `RegisterRequest` → `AuthResponse` (201) | Sets the refresh cookie and sends a verification email. |
| POST | `/auth/login` | `LoginRequest` → `AuthResponse` | Wrong credentials → 401 `INVALID_CREDENTIALS`. Rate limited. |
| POST | `/auth/refresh` | cookie → `AuthResponse` | Requires CSRF. Rotates the token. |
| POST | `/auth/logout` | → 204 | Requires CSRF. Revokes the session and clears the cookie. |
| GET | `/auth/me` | → `UserDto` | |
| PATCH | `/users/me` | `UpdateProfileRequest` → `UserDto` | |
| POST | `/auth/password` | `ChangePasswordRequest` → 204 | Verifies the current password and revokes the user's other sessions. |
| POST | `/auth/password-reset/request` | `{ email }` → 202 | |
| POST | `/auth/password-reset/confirm` | `{ token, newPassword }` → 204 | Revokes all sessions. |
| POST | `/auth/verify-email/resend` | → 202 | |
| POST | `/auth/verify-email/confirm` | `{ token }` → 204 | |

### Sessions (the caller's own only)
| Method | Path | Response |
|---|---|---|
| GET | `/sessions` | `SessionDto[]` |
| DELETE | `/sessions/{id}` | 204. Someone else's session id → 404. |
| DELETE | `/sessions/others` | 204 |

### Workspaces and members
| Method | Path | Min role | Body → Response |
|---|---|---|---|
| GET | `/workspaces` | any user | → `WorkspaceDto[]` (only the caller's workspaces, each with the caller's role) |
| POST | `/workspaces` | any user | `CreateWorkspaceRequest` → `WorkspaceDto` (the caller becomes OWNER) |
| GET | `/workspaces/{ws}/members` | MEMBER | → `MemberDto[]` |
| POST | `/workspaces/{ws}/members` | ADMIN* | `AddMemberRequest` → `MemberDto` |
| PATCH | `/workspaces/{ws}/members/{userId}` | ADMIN* | `UpdateMemberRoleRequest` → `MemberDto` |
| DELETE | `/workspaces/{ws}/members/{userId}` | ADMIN* / self | → 204 |

\* Admins may only add or manage MEMBERs. Only owners can grant or revoke ADMIN or OWNER. A workspace must always keep at least one owner (409). The rules match `src/lib/permissions.ts`.

### Projects, tasks and comments
| Method | Path | Min role | Body → Response |
|---|---|---|---|
| GET | `/workspaces/{ws}/projects` | MEMBER | → `ProjectDto[]` |
| POST | `/workspaces/{ws}/projects` | ADMIN | `CreateProjectRequest` → `ProjectDto` |
| DELETE | `/workspaces/{ws}/projects/{id}` | ADMIN | → 204 (cascades) |
| GET | `/workspaces/{ws}/projects/{id}/tasks?q=&assigneeId=&priority=&status=` | MEMBER | → `TaskDto[]` |
| POST | `/workspaces/{ws}/projects/{id}/tasks` | MEMBER | `CreateTaskRequest` → `TaskDto` |
| PATCH | `/workspaces/{ws}/tasks/{id}` | MEMBER | `UpdateTaskRequest` → `TaskDto` |
| POST | `/workspaces/{ws}/tasks/{id}/move` | MEMBER | `MoveTaskRequest` → `TaskDto` |
| DELETE | `/workspaces/{ws}/tasks/{id}` | creator or ADMIN | → 204 |
| GET | `/workspaces/{ws}/tasks/{id}/comments` | MEMBER | → `CommentDto[]` |
| POST | `/workspaces/{ws}/tasks/{id}/comments` | MEMBER | `CreateCommentRequest` → `CommentDto` |
| DELETE | `/workspaces/{ws}/comments/{id}` | author or ADMIN | → 204 |

Validation limits: task title 1–200 characters, description ≤ 5000, comment body 1–2000, project key `^[A-Z][A-Z0-9]{1,5}$` (unique per workspace), names ≤ 80.

## Implementation notes

The API is implemented in `backend/`. IDs are UUID strings. Access JWTs also contain a `sid` claim; session state is checked on authenticated requests so revocation takes effect immediately. Password length is at least 12 characters and at most 72 UTF-8 bytes (BCrypt limit). Refresh sessions have a fixed 30-day lifetime. Email codes are entered in the frontend's account and password reset forms; raw codes are never returned by the API or stored in the database.

PATCH task fields distinguish omission from explicit `null`: `null` clears assignee/due date, while required fields reject `null`. Deleting a workspace member unassigns their tasks. Adding members requires an already-registered account; this is not an email invitation workflow. In-memory rate limits may return `429 RATE_LIMITED`.
