# TeamSpace

A team project management platform built as a portfolio piece: workspaces, projects, a Kanban board, assignments, comments, members with per-workspace roles, and account security.

- **Frontend (this repo):** React 19, TypeScript, TanStack Router (file-based), TanStack Query, Tailwind CSS v4 and shadcn/ui.
- **Intended backend (not in this repo yet):** Spring Boot 3, Spring Security, Spring Data JPA, Bean Validation, PostgreSQL, Flyway and JWT.

> This project template uses TanStack Router rather than React Router; routing is file-based under `src/routes/`.

## Modes

| | Demo mode (default) | Real API mode |
|---|---|---|
| Enable | nothing | `VITE_API_MODE=http`, `VITE_API_BASE_URL=https://api.example.com` |
| Data | Fictional seed data in `localStorage` (`teamspace.demo.v1`) | PostgreSQL via Spring Boot |
| Auth | **Simulated.** Any seed email plus any 8+ character password signs in. No passwords or tokens are stored or verified. | Hashed passwords, a JWT access token in memory, and a rotating HttpOnly refresh cookie with CSRF protection |
| Label | A "Demo mode" badge in the sidebar, a banner and the sign-in pages | none |

Demo mode **is not real security**: anyone with the browser can edit its data. It does reproduce the backend's authorization rules (membership, roles, cross-workspace 404s, last-owner protection) so the UI behaves the way it will against the real API.

Demo accounts: `priya@northwind.dev` (Owner, Member and Admin across 3 workspaces), `elena@northwind.dev` and `sofia@harborhealth.org`. "Reset demo data" in the banner restores the seed.

## Layout

- `src/lib/api/types.ts`: DTOs and the `TeamSpaceApi` interface (the contract).
- `src/lib/api/http.ts`: the client for Spring Boot (in-memory access token, refresh-once on 401, `X-XSRF-TOKEN`, `credentials: include`).
- `src/lib/api/demo.ts` and `seed.ts`: the local demo implementation.
- `src/lib/permissions.ts`: role rules (the backend must enforce the same ones).
- `docs/API.md`: endpoints, DTOs, and 401/403/404/409 behavior.

## Tests

`bunx vitest run` covers the role rules, 401 without a session, 403 for non-members, 404 for cross-workspace ids, last-owner protection, rejection of revoked sessions, and a check that no password ends up in browser storage.

## Remaining Spring Boot work

1. Project skeleton: Spring Boot 3 / Java 21, Flyway migrations for `users`, `workspaces`, `memberships(workspace_id, user_id, role)`, `projects`, `tasks`, `comments`, `sessions`, `refresh_tokens`, `email_tokens`.
2. Security: `SecurityFilterChain` with a stateless JWT resource server for `/api/**`, `CookieCsrfTokenRepository` for `/api/auth/refresh|logout`, a strict `CorsConfigurationSource`, and an Argon2/BCrypt `PasswordEncoder`.
3. Authorization: a `WorkspaceAccess` service (`requireRole(ws, userId, minRole)`), used through `@PreAuthorize("@access.hasRole(#ws,'ADMIN')")` or explicit service calls. Every repository lookup is scoped as `findByIdAndWorkspaceId`.
4. Refresh token rotation with reuse detection, session listing/revocation, email verification and password reset (via a mail provider), and login rate limiting.
5. A global `@RestControllerAdvice` that maps to `ProblemDetail` with the error codes used in `docs/API.md`.
6. **Tests needed** (JUnit 5, `@SpringBootTest`, Testcontainers PostgreSQL, MockMvc):
   - **Cross-workspace isolation:** user A, a member of WS1 only, gets 403 on every `/workspaces/WS2/**` endpoint. Accessing a WS2 task/comment/project id through `/workspaces/WS1/...` returns 404 and doesn't change it. Assigning a non-member returns 400. Listing returns only the caller's workspaces.
   - **Role matrix:** a parameterized test of every endpoint × OWNER/ADMIN/MEMBER, including that admins can't promote to ADMIN and the last owner can't be demoted or removed.
   - **Refresh tokens:** a revoked refresh token gets 401. A rotated (already-used) token gets 401 **and** revokes its whole session family. Expired tokens get 401. Logout and "revoke session" invalidate the refresh token immediately. A password change revokes other sessions.
   - **CSRF/CORS:** `/auth/refresh` without `X-XSRF-TOKEN` gets 403. A preflight from an unlisted origin is rejected.
   - **Auth basics:** expired or tampered JWT gets 401, wrong password gets 401 with no difference from an unknown email, and reset tokens are single-use and expire.

This app is kept as an editor preview only and isn't published.
