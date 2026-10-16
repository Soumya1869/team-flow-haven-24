# TeamSpace Spring Boot API

Java 21, Spring Boot 3.5, Spring Security, JPA/Hibernate, PostgreSQL and Flyway.
The existing React app uses this backend through `src/lib/api/http.ts`; demo mode remains the default.

## Run locally with Docker

1. Install Docker Desktop and enable its Linux engine.
2. In `backend`, copy `.env.example` to `.env`. Choose a random database password and generate a JWT secret in PowerShell:

   ```powershell
   [Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
   ```

   Put the result in `JWT_SECRET` in `.env`. Do not commit this file.
3. Run `docker compose up --build` from `backend`. This starts PostgreSQL, the API on port 8080, and a local Mailpit inbox at http://localhost:8025.
4. In the repository root, copy `.env.example` to `.env.local`, then run `bun install` and `bun run dev --port 5173` (or the equivalent npm commands).
5. Register a new account. Real mode has no seeded accounts. Create a workspace and project, then add tasks. To add another member, that person must first register. Members are added directly; emailed invitations are a future feature.
6. Read the verification code in Mailpit and enter it under Account & security. The sign-in page's Forgot password flow accepts reset codes.

Docker configuration is for localhost development only: API port is bound to loopback, mail is captured locally, and cookies permit HTTP. No real emails leave Mailpit.

## Run with an installed JDK and Maven

Use Java 21 and Maven 3.9+. Set `DATABASE_URL` (JDBC URL), `DATABASE_USER`, `DATABASE_PASSWORD`, `JWT_SECRET`, `SMTP_HOST`, `SMTP_PORT`, and the cookie/origin options below. Run `mvn spring-boot:run` in `backend`. PostgreSQL and SMTP must be available. `mvn package` produces `target/teamspace-api-0.1.0.jar`.

## Configuration and deployment

| Variable | Purpose |
| --- | --- |
| `JWT_SECRET` | Required base64 encoding of at least 32 random bytes. No production fallback. |
| `DATABASE_PASSWORD` | Required database credential. |
| `DATABASE_URL` | Defaults to `jdbc:postgresql://localhost:5432/teamspace`. |
| `ALLOWED_ORIGINS` | Comma-separated exact browser origins; defaults to `http://localhost:5173`. |
| `COOKIE_SECURE` | Defaults to `true`; only use `false` on localhost HTTP. |
| `COOKIE_SAME_SITE` | Defaults to `Strict`. `None` requires HTTPS and secure cookies. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD` | Mail delivery configuration. |
| `SMTP_AUTH`, `SMTP_STARTTLS`, `MAIL_FROM` | SMTP security and sender identity. |

Prefer serving the frontend and `/api` behind the same HTTPS origin. Same-site subdomains also work with exact CORS settings. A Lovable-hosted frontend and an unrelated API host need `SameSite=None; Secure`, and may still be blocked by browser third-party-cookie restrictions. Same-origin deployment avoids that problem. Do not simply switch the published app to HTTP mode before deploying a reachable API.

The frontend fetches `/api/auth/csrf` with credentials and holds the returned token in memory; this works even when JavaScript cannot read the API host's cookies. Refresh and logout require both the CSRF cookie and its matching header. The refresh cookie is HttpOnly and path-scoped. Access tokens remain in memory.

## Implemented behavior

- All endpoints in `docs/API.md`, plus `GET /api/auth/csrf` and `GET /health`.
- BCrypt cost 12; JWTs expire after 10 minutes. A session check also rejects revoked sessions immediately.
- Hashed opaque refresh tokens, rotation, replay detection that commits family revocation, and a 30-day absolute session lifetime.
- Email verification and password-reset codes are single-use, hashed in the database, and expire. Password changes revoke other sessions; resets revoke all sessions.
- Workspace roles are read from the database, never trusted from JWT claims. Workspace locks serialize membership changes and task-number allocation, preventing concurrent last-owner removal and duplicate task keys.
- Composite foreign keys enforce project/task/comment workspace consistency. Resource lookups also scope by workspace.
- Members can edit tasks; only their creator or admins/owners can delete them. Comment deletion is limited to the author or admins/owners. Admins can manage only MEMBER roles.
- Removing a member unassigns their tasks. Deleting a project or task cascades to its dependent data.
- Validation and structured error responses; exact-origin CORS; bounded, in-memory login/registration/email rate limits.

## Verification

```sh
mvn test
# Requires a running Docker engine; repeats integration tests against PostgreSQL:
mvn -DpostgresTests=true verify
```

The default suite runs the real Spring Security filter chain, Flyway migration, controllers, services and JPA with H2 in PostgreSQL mode. SMTP is mocked. The optional Testcontainers suite repeats the same HTTP tests with PostgreSQL 17, and the included GitHub workflow enables it. H2 results alone do not establish PostgreSQL compatibility.

### Test an existing PostgreSQL server without Docker

Create a dedicated test database, then set `POSTGRES_TEST_URL` (for example `jdbc:postgresql://127.0.0.1:55432/teamspace_test`), `POSTGRES_TEST_USER` and `POSTGRES_TEST_PASSWORD` in your environment. Run `mvn -Dtest=ExternalPostgresIntegrationTest test`.

This runs the same 9 integration tests using PostgreSQL. Tests create synthetic accounts, workspaces and tasks; never target production or a database with valuable data. The test class is skipped unless `POSTGRES_TEST_URL` is set. SMTP remains mocked for this suite; a separate application smoke test is needed to check email delivery.

## Practical limits

This is a portfolio backend, not a production readiness certification. Lists currently return all matching records; add pagination and aggregate queries for large datasets. Workspace-level locks favor straightforward correctness over write throughput. Rate limiting is per application instance and uses the direct peer IP; configure a trusted gateway/shared limiter before horizontal scaling. Email delivery is synchronous; password-reset requests keep a generic accepted response even if SMTP fails, but there is no durable mail retry queue. Add a mail outbox, cleanup of expired sessions/tokens, monitoring, backups, and dependency scanning before production use. Attachments and invitation links are not implemented.

## No-email portfolio deployment

EMAIL_ENABLED defaults to false. Registration keeps emailVerified=false and does not send mail. Verification and password-reset endpoints return 503 EMAIL_DISABLED. Sign-in, refresh, authorization, sessions and signed-in password changes remain available. Enable EMAIL_ENABLED=true only with a working mail service; the local Compose setup does this for Mailpit. Set VITE_EMAIL_ENABLED=true in the frontend only when backend email is enabled.

The committed .env.production contains public frontend settings for the Render API, with email controls disabled. It contains no credentials. Password recovery is unavailable on this portfolio deployment.
