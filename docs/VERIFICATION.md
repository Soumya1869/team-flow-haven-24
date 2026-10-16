# Verification — 16 October 2026

Verified locally against the source in this delivery:

- Java 21 / Maven `package`: successful; executable Spring Boot JAR generated.
- Backend: 19 tests passed: 9 HTTP integration tests with H2, the same 9 against PostgreSQL 17.11, and 1 rate-limiter test.
- Frontend: 19 Vitest tests across 4 files passed, including CSRF bootstrap, shared refresh and logout handling.
- TypeScript `tsc --noEmit`: passed.
- Vite production build: passed.

Backend tests exercise the Spring Security filter chain, Flyway migration, JPA and HTTP endpoints with H2 in PostgreSQL mode. Coverage includes workspace isolation, scoped resource lookups, role restrictions, concurrent last-owner protection, task permissions, member removal, refresh replay/session revocation, expiry, CORS/CSRF, verification codes and password resets.

The external PostgreSQL suite passed against a dedicated local PostgreSQL 17.11 database, including Flyway migration and concurrent last-owner protection. The 9 Docker Testcontainers variants were skipped because Docker was unavailable. Run `mvn -DpostgresTests=true verify` with Docker to execute those variants. The provided GitHub Actions workflow also enables them; it has not been run on GitHub.

No browser end-to-end test against a deployed PostgreSQL-backed API was performed. SMTP was mocked in automated tests. Docker Compose and external SMTP delivery still need an environment smoke test. No changes were pushed to GitHub or deployed to the published Lovable site.

Local tooling workaround: Windows sandbox Node async-realpath and temporary-directory failures were handled outside the deliverable source. Package installation used npm with `--legacy-peer-deps --ignore-scripts`; no dependency versions in package.json were changed. The existing bun.lock is preserved. This verification is not an exhaustive security audit.
