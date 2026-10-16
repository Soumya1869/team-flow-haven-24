# Free deployment: Render + Neon

Status: preparation only. No cloud resources have been created or code published.

## Accounts

Sign into https://dashboard.render.com and https://console.neon.tech using your own accounts. Select only Free plans; do not enable paid upgrades. Connect Render to the GitHub repository containing this updated source (the original Lovable repository does not yet contain these local backend changes).

## Database

Create a Neon Free project and a dedicated TeamSpace database. Keep credentials in provider secret settings, never in the repository or chat. Use the direct database host for this initial single-instance deployment. Configure DATABASE_URL as `jdbc:postgresql://HOST/DATABASE?sslmode=require`, with DATABASE_USER and DATABASE_PASSWORD separate. Do not paste the PostgreSQL URI directly into DATABASE_URL: JDBC requires the `jdbc:` prefix and separate credentials here.

## API service

Create a Render Docker web service from the updated repository:

- Root directory: `backend`
- Dockerfile: `./Dockerfile`
- Instance: **Free** (explicitly select it)
- Health check: `/health`
- DATABASE_URL, DATABASE_USER, DATABASE_PASSWORD: Neon values above
- JWT_SECRET: new production base64 secret with at least 32 random bytes; do not reuse local credentials
- COOKIE_SECURE: `true`
- COOKIE_SAME_SITE: `None` for the existing unrelated Lovable origin
- ALLOWED_ORIGINS: `https://team-flow-haven-24.lovable.app`
- JAVA_TOOL_OPTIONS: `-Xms64m -Xmx256m`
- SPRING_DATASOURCE_HIKARI_MAXIMUM_POOL_SIZE: `3`
- SPRING_DATASOURCE_HIKARI_MINIMUM_IDLE: `0`

Render supplies PORT. Flyway applies the schema at startup. Free service memory is limited; validate startup on the actual host. Free services sleep after inactivity, causing cold starts. Neon has free usage quotas too. Do not use artificial keep-alive traffic to avoid provider limits.

## Email is a deployment prerequisite

The current Mailer uses SMTP and registration sends a verification message synchronously. Render Free blocks common outbound SMTP ports. Do not launch public registration with the localhost SMTP defaults: registration can fail.

Choose a free transactional email provider with an HTTPS API, confirm sender verification requirements, then implement and test that transport while retaining SMTP for local Mailpit. Sender/domain ownership and provider approval must be resolved before claiming email works. Do not buy a domain or a paid email plan under the strictly-free constraint.

## Frontend integration

Publish the updated React source only after the API and email work. Set VITE_API_MODE=http and VITE_API_BASE_URL to the actual HTTPS Render URL at build time. Never include database, JWT, or email secrets in VITE variables.

Lovable and Render are different sites. Even SameSite=None; Secure cookies may be blocked by browser third-party-cookie policies. Verify refresh after reload and logout in the target browsers. A same-origin frontend/API proxy is the preferred resolution if cookies are blocked; do not weaken authentication or persist access tokens in localStorage.

## Release checks

Verify /health, registration and delivered email, verification code, workspace/project/task creation, reload with refresh, logout, and password-reset delivery. Confirm persisted records after a service restart. Update docs/VERIFICATION.md only with checks actually completed.

References checked 16 October 2026:
- https://render.com/docs/free
- https://render.com/docs/docker
- https://neon.com/pricing
