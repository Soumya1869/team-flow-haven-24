<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- All data access goes through the `TeamSpaceApi` interface in `src/lib/api/types.ts`; UI never calls fetch directly — so demo and Spring Boot modes stay swappable.
- Backend is Spring Boot (external); never add Supabase/Lovable Cloud auth or TypeScript server functions for app data — the project showcases a Java backend.
- Access tokens stay in memory only; nothing secret goes to localStorage — refresh tokens are HttpOnly cookies set by the API.
- Role rules live in `src/lib/permissions.ts` and must match backend enforcement documented in `docs/API.md`.
- App routes live under the `_workspace` pathless layout with `ssr: false` because demo data is browser-local and the token is in-memory.
