# Architecture Decision Records — CPCCU

This document records the most important architectural decisions made in the CPCCU project. Each ADR explains **why** the project is built this way, not just **how** it works.

> **Rule of thumb:** every decision below was verified against the current frontend codebase. Nothing here is hypothetical — decisions marked **Accepted** are implemented in production. Decisions marked **Planned** are not yet implemented.

Related documentation: [README](../README.md) · [ARCHITECTURE.md](./ARCHITECTURE.md) · [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) · [DEPLOYMENT.md](./DEPLOYMENT.md) · [CLAUDE.md](./CLAUDE.md)

---

## ADR-001 — Frontend Deployment (Vercel) + Backend Deployment (Render)

### Status

**Superseded in part (2026-09).** The Vercel half stands. The Render half and the cross-origin topology are obsolete: the Express backend was migrated into Next.js App Router route handlers inside this repository and the frontend was cut over to them, so the platform is now a **single Vercel deployment serving both the pages and the API**. See the supersession note below and [BACKEND_MIGRATION.md](./BACKEND_MIGRATION.md).

> **Superseded: what changed, and why.** The split into two applications described below no longer exists. `NEXT_PUBLIC_API_BASE_URL` was deleted rather than repointed, the API is reached at the hard-coded relative literal `/api/v1`, and there is no `cpccu-server` deployment, no second repository in the runtime path, and no CORS configuration anywhere in the system. The reasoning for keeping the record rather than rewriting it: a reader who remembers the old topology needs to be told **which half is wrong**, not shown a document that quietly disagrees with their memory. The original text is preserved verbatim below so the decision that was actually made stays auditable.

### Context

The CPCCU platform is split into two applications: the Next.js frontend (`cpccu-client`) and an Express/MongoDB backend (`cpccu-server`). Both need to be hosted, and each has different operational needs (the frontend is mostly static/CSR; the backend needs a long-running Node process and a database).

### Decision

- **Frontend** is deployed on **Vercel** (production: https://cpccu.club/).
- **Backend** is deployed on **Render** as a web service (`cpccu-server`).
- The frontend communicates with the backend through the **`NEXT_PUBLIC_API_BASE_URL`** environment variable (default `http://localhost:5000/api/v1`), used by `src/services/baseApi.js` (`fetchBaseQuery`), the public certificate API, and the certificate metadata fetcher.

```mermaid
flowchart LR
    U[Browser] --> V[Vercel - Next.js frontend]
    V -->|NEXT_PUBLIC_API_BASE_URL /api/v1/*| R[Render - Express backend]
    R --> M[(MongoDB)]
```

### Why

- **Independent scaling & release cycles** — frontend and backend can deploy, roll back, and scale separately.
- **Static/CDN delivery** — Vercel serves the client-rendered app globally with automatic caching and HTTPS; no need for a self-managed Node server.
- **Backend needs a persistent runtime** — Render hosts the long-running API process and its database connection.
- **Operational separation** — API keys, DB credentials, and rate-limit-sensitive concerns stay server-side.

### Consequences

**Pros**

- Zero-downtime frontend releases; fast global delivery.
- Backend can be scaled/monitored independently.
- No shared infrastructure lock-in.

**Cons**

- CORS must be configured on the backend to accept the deployed origin.
- `NEXT_PUBLIC_*` variables are inlined at build time — changing them requires a redeploy.
- Every API call crosses the network to Render (no Vercel-side API proxying).

**Future considerations**

- Vercel Edge/Server Functions could proxy API calls if CORS or token handling ever becomes a problem.
- Keep the legacy `render.yaml`/`_render.yaml` files in mind if the frontend ever returns to Render hosting.

> **What actually happened to each of those cons.** "Vercel Edge/Server Functions could proxy API calls if CORS or token handling ever becomes a problem" is the decision that was taken, and then some: the API was moved *into* the Vercel deployment, which removes the cross-origin hop outright rather than proxying it, and with it removes the CORS configuration. Token handling became a separate problem with a different answer (`httpOnly` cookies, see ADR-011). `render.yaml` / `_render.yaml` were **deleted**, not kept. The remaining live consequence of "inlined at build time" is `NEXT_PUBLIC_SITE_URL`, which seeds the CSRF allow-list — see [BACKEND_MIGRATION.md](./BACKEND_MIGRATION.md) §4.6.

---

## ADR-002 — Certificates Are Not Stored in the User Profile

### Status

Accepted

### Context

Members earn certificates (contests, workshops, hackathons). Earlier designs risked duplicating certificate data inside each user's profile document, which would drift out of sync whenever certificates were issued, edited, or revoked.

### Decision

Certificates are **not stored inside the User model/profile document**. The certificate system (backend `Certificate` collection) is the **single source of truth**. The profile fetches them dynamically:

```mermaid
flowchart LR
    A[User Profile] -->|Student ID uniID| B[Certificate API - GET /certificates/verify?recipientId=]
    B --> C[Certificate Database]
    C --> D[CertificatesSection renders badges]
```

Implementation: `src/components/Layout/Profile.jsx` calls `useLazyVerifyCertificateQuery({ recipientId: user.uniID })` and maps the response with `getCertificatesFromResponse` (`src/lib/certificates/parser.js`).

### Why

- **Single source of truth** — one canonical certificate record, never duplicated.
- **No duplicate data** — nothing to reconcile between profiles and certificates.
- **Automatic synchronization** — any issue/edit/delete in the admin certificate module is reflected instantly on profiles.
- **Lower maintenance** — no sync jobs or dual-writes.
- **Certificates appear automatically** after issuance — no per-user profile update required.

### Consequences

**Pros**

- Profile data stays small and certificate-accurate.
- Admin certificate CRUD is the one place that manages certificate truth.
- Easy to extend (stats, verification logs, bulk issue) without touching user records.

**Cons**

- Profile rendering depends on a second API request (mitigated with skeleton loading).
- Lookup requires a stable student ID shared by both systems.

**Future considerations**

- Download/share permission checks (stubs in `src/lib/certificates/permissions.js`) will gate client actions when implemented.

---

## ADR-003 — Student ID (`uniID`) as the Primary Certificate Lookup

### Status

Accepted

### Context

Certificates are issued to students by their university student ID, while users in the database are identified by a MongoDB `_id`. The profile page needed a key to fetch a member's certificates.

### Decision

The profile uses the member's **student ID (`uniID`)** — not the MongoDB `_id` — as `recipientId` when querying certificates (`GET /certificates/verify?recipientId=<uniID>`).

### Why

- **Stability** — `uniID` is a stable, human-meaningful identifier independent of the database row.
- **Cross-system compatibility** — certificates and profiles are managed by separate systems; the student ID is the common key between them.
- **Independence from database implementation** — a `_id` is an implementation detail of MongoDB; `uniID` survives migrations, re-imports, and future backends.
- **Easier integration with external systems** — universities, organizers, and recruiters already reference students by ID.
- **Validation is centralized** — `src/lib/id-validation.js` guards the format (digits only, 6–20 chars, no scientific notation) at signup and profile edit.

### Consequences

**Pros**

- Lookups are deterministic and portable.
- No coupling between the profile document and certificate records.

**Cons**

- The `uniID` must be identical in both the user record and the certificate record — typos silently produce an empty certificate section.
- Changing a student ID (rare) requires updating both systems.

**Future considerations**

- Consider a fallback lookup by email for edge cases where the ID format differs between systems.

---

## ADR-004 — Contributor Data via GitHub Action + `contributors.json` (Not Direct GitHub API)

### Status

Accepted

### Context

The site displays contributors with commit counts and ranks. Calling the GitHub API directly from the frontend would expose rate limits, require a token, and slow down page loads.

### Decision

Contributor data is produced **off the critical path** by an automated pipeline and consumed as a static asset:

```mermaid
flowchart LR
    A[GitHub Action - daily 19:05 UTC on release] --> B[scripts/update_contributors.py]
    B --> C[Fetch commits cpccu/cpccu-client + cpccu/cpccu-server]
    C --> D[Exclude bots, merge by login]
    D --> E[data/contributors.json]
    E --> F[Profile ContributionsSection]
    E --> G[Contributors page + homepage carousel]
```

- `.github/workflows/update-contributors.yml` runs daily on the `release` branch.
- `scripts/update_contributors.py` merges commit counts from both repositories and preserves manually curated fields (name, role, department, batch, LinkedIn).
- The frontend reads `data/contributors.json` via `src/lib/public-content.js` helpers (`extractGithubUsername`, `findContributorByGithub`, `parseContributionInfo`).

### Why

- **No API rate limits** — GitHub's REST API is never called from the browser or at render time.
- **Faster page loads** — contributor data is a small static JSON file, cached like any other asset.
- **No GitHub token exposure** — the token used by the workflow lives only in GitHub Actions secrets.
- **Static asset caching** — the JSON is served from the CDN; no dynamic fetch cost.
- **Simpler frontend** — no fetch logic, error states, or API keys in the client.

### Consequences

**Pros**

- Zero client-side cost; fully offline-able data.
- Bots and automated users are filtered once, in the pipeline.

**Cons**

- Data freshness lags by up to a day (daily schedule).
- The workflow must run against the correct branch (`release`) to stay current.

**Future considerations**

- Add a build-time metadata endpoint or trigger the workflow on push if fresher data is ever needed.

---

## ADR-005 — Dynamic Role Management (Official Roles Stored Separately)

### Status

Accepted

### Context

The club needs two very different kinds of roles: **system permissions** that control who can access what, and **official position titles** (President, Vice President, General Secretary…) that are displayed on profiles. Hardcoding the official titles in the UI would require a code deploy every time the committee changes.

### Decision

- **Panel / system roles** (`admin`, `moderator`, `mentor`, `member`) are backend permissions, enforced by the backend and the client-side admin guard (`src/components/admin-layout.jsx`, imported by every `/admin/*` page).
- **Official CPCCU roles** are stored as records in the `Role` collection and managed dynamically by admins through `/admin/roles` endpoints (`GET/POST /admin/roles`, `PATCH /admin/roles/:id`, `PATCH /admin/roles/:id/toggle`), with the management UI inside the Members module.
- Display logic is centralized in `src/lib/roles.js` (`normalizeRole`, `isOfficialRole`, `getDisplayRole`, `roleIcon`, `roleBadgeColor`, `sortRoles`), and `getDisplayRole` maps system roles back to "Member" so permissions are never displayed as titles.

### Why

- **Committees change every term** — admins can add/rename/toggle roles without a deploy.
- **Separation of concerns** — permissions (what you can do) are decoupled from titles (what you're called).
- **Consistent display** — one utility module drives badge color, icon, and display name everywhere.
- **Self-service** — the panel UI (role dropdown + creation) lives where admins already manage members.

### Consequences

**Pros**

- Role changes are data-driven and instantly reflected on profiles.
- System security model stays small and auditable.

**Cons**

- Two role systems can confuse newcomers (mitigated by documentation).
- Role records must be seeded/kept in sync with the club structure.
- Official role display depends on the `active` flag.

**Future considerations**

- Consider deriving profile badges from role IDs instead of names to avoid rename drift.

---

## ADR-006 — Profile Page Divided into Independent Sections

### Status

Accepted

### Context

A profile must show many different kinds of data (identity, bio, skills, certificates, projects, contributions, contact). A single monolithic component became hard to maintain as each section gained its own loading, empty, and edit states.

### Decision

The profile page (`src/components/Layout/Profile.jsx`) is composed of independent section components in `src/components/PROFILE/`:

| Section | Component |
| --- | --- |
| Hero | `ProfileHero.jsx` |
| About | `AboutSection.jsx` |
| Member Info | `MemberInfoSection.jsx` |
| Quick Stats | `QuickStats.jsx` |
| Skills | `SkillsSection.jsx` |
| Certificates | `CertificatesSection.jsx` |
| Projects | `ProjectsSection.jsx` |
| Contact | `ContactSection.jsx` |
| Contributions | `ContributionsSection.jsx` |

Shared building blocks: `SectionCard.jsx`, `EmptyState.jsx`, `AnimatedCounter.jsx`, `BrandIcons.jsx`.

### Why

- **Easier maintenance** — each section can be changed without touching the others.
- **Better code organization** — one component per concern, clear file names.
- **Independent loading** — sections render their own skeletons/empty states (e.g., certificates load lazily while the hero is already visible).
- **Component reusability** — sections are plain presentational components; the same patterns serve admin and public views.

### Consequences

**Pros**

- Small, focused files; parallel development.
- Owner-vs-public permissions apply per section (edit mode, job pipeline, project CRUD).

**Cons**

- Sections receive many props from the parent and must agree on the member data shape.
- Legacy unused profile components remain in the folder (documented in [ARCHITECTURE.md](./ARCHITECTURE.md) §18).

**Future considerations**

- Extract each section's data fetching into hooks if the parent `Profile.jsx` grows further.

---

## ADR-007 — Job Pipeline Approval Workflow

### Status

Accepted

### Context

The public job pipeline showcases members to recruiters. If members could publish directly, the page could contain outdated, incomplete, or low-quality profiles with no moderation.

### Decision

Publishing is gated by an admin approval workflow:

```mermaid
flowchart TD
    H[Hidden] --> R[Request - 'Show in Job Pipeline']
    R --> P[Pending]
    P -->|Admin approves| A[Approved - visible on /job-pipeline]
    P -->|Admin rejects| J[Rejected - request button returns]
    A --> X[Remove from Job Pipeline]
    X --> H
    J --> R
```

- Member side: `ProfileHero.jsx` + `src/components/Layout/Profile.jsx` (request modal, status badges) using `POST/DELETE /users/job-pipeline-request`.
- Admin side: `/admin/jobs` (`jobs-content.jsx`) supports **approve**, **reject**, **revert to pending**, and **remove** on `DeveloperProfile` records.
- Public side: `/job-pipeline` renders only approved profiles from `GET /content/profiles` (fallback to `data/job-pipeline/Info.json`).

### Why

- **Quality control** — only complete, curated profiles reach recruiters.
- **Club brand protection** — public showcase reflects the club's standards.
- **Prevents spam/abuse** — approval stops irrelevant or duplicate submissions.
- **Clear lifecycle** — every profile has an explicit, auditable state (`hidden`, `pending`, `approved`, `rejected`).

### Consequences

**Pros**

- Safe public surface with a full audit trail.
- Members get feedback (rejection reason stored) and can re-request.

**Cons**

- Adds friction for members and review workload for admins.
- Approved profiles only appear after review (delay between request and visibility).

**Future considerations**

- Add approval notifications (see ADR-012) so members know when their profile is live.

---

## ADR-008 — RTK Query for Server State

### Status

Accepted

### Context

The app performs many API calls (auth, users, content, admin, certificates) that need consistent loading/error states and cache invalidation. Hand-writing `fetch` + Redux action/selector boilerplate per feature would be repetitive and error-prone.

### Decision

All API access uses **RTK Query** (`@reduxjs/toolkit/query`):

- A single `baseApi` (`src/services/baseApi.js`) with centralized tag types, a relative same-origin base path, and `credentials: 'include'`. There is no auth-header injection to centralize — the session is the `httpOnly` cookie the browser attaches (ADR-011).
- Feature modules register endpoints via `baseApi.injectEndpoints()` (`authApi`, `userApi`, `memberApi`, `certificateApi`, `contentApi`, `contactApi`, `adminApi`).
- ~~A separate `publicApi` instance handles unauthenticated certificate verification.~~ **Superseded in part (2026-09).** The second instance existed only because the Express backend mounted verification at the **root** path `GET /verify/:certificateId` — `app.get('/verify/:certificateId', asyncHandler(verifyCertificatePublic))` at `cpccu-server/src/app.js:76` — i.e. *outside* the `/api/v1` base URL every other endpoint used. With verification unreachable under the base URL, a second `createApi` instance whose `baseUrl` stripped `/api/v1` was the only way to reach that one endpoint; its `useVerifyCertificatePublicQuery` hook had no call sites, and the instance was still wired into the store as an empty reducer plus a second middleware. The backend has since been migrated into Next.js App Router route handlers, where verification is served at **`GET /api/v1/certificates/verify/:certificateId`** by the same `baseApi` as every other certificate endpoint, and the root path is no longer served at all. `publicApi` has therefore been **deleted** together with its store registration. The single-`baseApi` decision above stands; only the second instance is withdrawn.
- Cache invalidation is driven by tag types (`Auth`, `Users`, `Posts`, `Projects`, `PublicContent`, `AdminOverview`, `AdminMembers`, `AdminContent`, `AdminStatistics`, `AdminCertificates`, `AdminSystemSettings`, `AdminRoles`).

### Why

- **Automatic caching** — identical queries are deduplicated and cached automatically.
- **Cache invalidation** — mutations invalidate tags so dependent queries refetch (e.g., admin content updates refresh the public page).
- **Loading & error states** — every hook exposes `isLoading`, `isError`, `data`, `refetch` without extra code.
- **Reduced boilerplate** — no manual request state management per feature.

### Consequences

**Pros**

- Consistent data flow across public and admin areas.
- Less code, fewer hand-rolled state bugs.

**Cons**

- Learning curve for RTK Query concepts (tags, injectEndpoints, lazy queries).
- Cache freshness depends on correct tag wiring; the `serializableCheck` is disabled for the store.
- A few direct `fetch` calls remain intentionally (visitor counter, bootcamp leaderboard, server-side certificate metadata).

**Future considerations**

- Register stray slices (`userSlice`, `memberSlice`, `postSlice`) or remove them (see [ARCHITECTURE.md](./ARCHITECTURE.md) §18).

---

## ADR-009 — Shared Utility Modules

### Status

Accepted

### Context

The same logic — role display, certificate parsing/sorting, public content mapping, ID validation, password rules — is needed in many components across public and admin areas.

### Decision

Reusable logic lives in centralized modules under `src/lib/`:

- `src/lib/roles.js` — official role normalization, detection, icons, badge colors.
- `src/lib/certificates/` — parsing (`parser.js`), sorting (`sorting.js`), badges (`badges.js`), permission stubs (`permissions.js`), re-exports (`index.js`).
- `src/lib/public-content.js` — API→view mappers (`toPublicContributor`, `toPublicEvent`, `toPublicDeveloperProfile`, …) and GitHub helpers.
- Also: `id-validation.js`, `password-validation.js`, `format-date.js`, `alerts.js`, `cropImage.js`.

### Why

- **Centralized logic** — one implementation, one place to fix bugs.
- **Avoid duplicated code** — no copy-pasted parsing/formatting across components.
- **Easier maintenance** — behavior changes in one file and propagates everywhere.
- **Consistent behavior** — public, profile, and admin views render data the same way.

### Consequences

**Pros**

- Smaller components; predictable output shapes.
- Utilities are unit-testable in isolation.

**Cons**

- Utility modules must stay in sync with API response shapes.
- Modules can become grab-bags if new helpers aren't grouped well.

**Future considerations**

- Add unit tests for parsers and validators as the test suite grows.

---

## ADR-010 — Security Headers via `proxy.ts`

### Status

Accepted

### Context

The deployed site needed defense-in-depth HTTP security headers without relying on infrastructure-level configuration.

### Decision

`src/proxy.ts` (Next.js 16 proxy/middleware) applies security headers to every route except `_next/static` and `_next/image`:

- **Content-Security-Policy** (production only) — restricts script/style/img/connect/font sources, `frame-ancestors 'none'`, `form-action 'self'`.
- **X-Content-Type-Options** — `nosniff`
- **Referrer-Policy** — `strict-origin-when-cross-origin`
- **Permissions-Policy** — disables camera, microphone, geolocation, usb, payment, and more.
- **X-Frame-Options** — `DENY`
- **Cross-Origin-Embedder/Opener/Resource-Policy** — hardening against embedding/cross-origin leaks.
- **Strict-Transport-Security (HSTS)** — applied when the host is not localhost.

External scan results (as reported): **SecurityHeaders → Grade A**, **MDN Observatory → B+** (current status — re-validate after any header changes).

### Why

- Headers travel with the app — no host-specific configuration needed.
- CSP + HSTS + frame/embedding restrictions raise the cost of XSS, clickjacking, and downgrade attacks.
- Production-only CSP avoids breaking local development.

### Consequences

**Pros**

- Strong baseline security posture on every response.
- Easy to inspect and change in one file.

**Cons**

- CSP `connect-src` must be updated when new external origins (fonts, CDNs, APIs) are added, or requests will be blocked.
- Headers protect the transport/browser layer only — application-level authorization is still required.

**Future considerations**

- Move the CSP to a strict, hash-based policy if inline styles/scripts are ever reduced.

---

## ADR-011 — Authentication Architecture

### Status

Accepted, **rewritten in 2026-09** (the decision below replaces the original `localStorage` bearer-token model).

> **Superseded: the `localStorage` + `Authorization: Bearer` model is withdrawn.** It is recorded here because the reasoning that retired it matters, and because a reader who remembers "the token lives in `localStorage`" needs to be told plainly that it no longer does. Two changes did it, both part of the same-origin cutover:
>
> - **The token left the response body and the client.** `POST /auth/login` returns `{ user }`; `GET /auth/refresh-token` returns `{ success: true }`. `baseApi` attaches no `Authorization` header. The `httpOnly` `accessToken` cookie is the credential, and the client cannot read it — which is the entire point of `httpOnly`.
> - **The `localStorage` token is gone.** `authSlice` has no `token` in its state; `ProviderWrapper` no longer reads `localStorage` at all. What remains in `localStorage` is a cached `user` object for first paint, which is explicitly **not** proof of a session.
>
> Why the original is a worse model than it looks: the cookie was set *and* the token was in the body, so a token readable by any XSS was handed to the server on every call while the unreadable cookie was already sufficient. `SameSite` had also been `none` — cross-site-capable — because the API was on another origin. Making the API same-origin let both of those be fixed together; see [BACKEND_MIGRATION.md](./BACKEND_MIGRATION.md) §5.2 and §5.5.

### Context

Users need to log in, maintain sessions across page loads, and access role-restricted admin areas.

### Decision

Verified from the code (`src/features/auth/authSlice.js`, `authApi.js`, `src/app/redux/ProviderWrapper.js`, `src/lib/server/auth.js`, `src/lib/server/constants.js`):

- **The session is the `httpOnly` cookie.** `COOKIE_OPTIONS` sets `httpOnly: true`, `sameSite: 'lax'`, `path: '/'`, and a 7-day `maxAge`, with `secure` conditional on `NODE_ENV` so a plain-`http` local dev server is not silently refused the cookie.
- **The client holds no token.** No `Authorization` header, no `localStorage` credential, no refresh orchestration. `authSlice` state is `{ user, loading, error, hydrated }`; `user` is a cache of what the server last returned, and `hydrated` — not `token` — is what unblocks auth-aware UI.
- **Session identity is server-decided.** `ProviderWrapper` calls `GET /users/user` on every page load with **no `skip` gate** (the cookie is sent automatically, so there is nothing to gate on) and dispatches `setCredentials` or `clearCredentials` on any error. A 401 there *is* "not logged in".
- **Protected routes** — `/admin` is guarded client-side for roles `admin`, `moderator`, `mentor`; unauthenticated users are redirected to `/login`. That guard is UX; the server enforces the same roles on every `/admin/*` route, auth-by-default.
- **Registration** — email OTP flow (`POST /auth/send-otp` → `POST /auth/verify-registration`).
- **Password reset** — `POST /auth/reset-link` + `PATCH /auth/reset-password`. `reset-link` was `GET /auth/reset-link/:email` until the cutover; `GET` is exempt from the CSRF check and the address was in the path, so a bare cross-site `<img src>` was enough to make the server mail a real branded reset link to an attacker-chosen address. `POST` with the address in the body re-arms `assertSameOrigin`. Do not add a `GET` fallback.
- **Logout** — `POST /auth/logout`, which revokes this device's refresh token and clears the cookies. It was `GET` until the cutover; `GET` is exempt from the CSRF check, which made force-logout (and seven-day refresh-token revocation) reachable cross-site.
- **Refresh** — transparent and server-side. `GET /auth/refresh-token` exists but the client never calls it; `auth.js` re-issues the access-token cookie when it sees an expired one.
- **Google authentication** — **not implemented**. There is no Google OAuth / Firebase code, and `firebase-admin` was removed from `serverExternalPackages` in `next.config.mjs` because the only endpoints that used it were never called.

### Why

- **A token script cannot read is a token XSS cannot steal.** This is the entire security argument, and it is why the same-origin cutover and the auth-model change were done together rather than separately.
- **One origin removes the reason `SameSite: 'none'` ever existed**, which closes the cross-site cookie path structurally rather than by layering. `assertSameOrigin` is the independent second layer on top.
- **Server-decided identity removes a whole class of client bug.** A gate on `localStorage.token` left in place after the token stopped being returned would make `GET /users/user` never fire and render every page logged out — a silent, total failure that no type checker catches.
- Hydration on startup keeps auth-aware UI consistent after refreshes.
- The cost of asking unconditionally is one small 401-shaped request per anonymous page load; the cost of a stale gate is a site where nobody is ever logged in.

### Consequences

**Pros**

- The XSS-token-exfiltration tradeoff this ADR previously accepted is **gone**, not mitigated.
- No refresh orchestration on the client, and no chance of the client and server disagreeing about who is signed in.
- Admin access gating is centralized in the admin layout, and enforced independently on the server.

**Cons**

- `httpOnly` means the client genuinely cannot inspect the session. Anything that used to read `auth.token` has to ask the server — which is the point, but it is a real ergonomic cost.
- A `skip`-style optimisation on `GET /users/user` is now a correctness bug, not an optimisation. The comment in `ProviderWrapper.js` records why.
- `WEB_DOMAIN` / `NEXT_PUBLIC_SITE_URL` become security-critical environment variables: a wrong value 403s every unsafe method.
- Google OAuth is **not present** — do not document or assume it exists.

**Future considerations**

- The `localStorage` `token` key is deleted on the first post-cutover sign-out, so returning browsers eventually shed the old credential. There is no migration that scrubs a browser that never signs out again.
- Distributed rate limiting for the credential endpoints remains the largest open risk ([BACKEND_MIGRATION.md](./BACKEND_MIGRATION.md) §8) — the cookie model does not reduce the need for it.

---

## ADR-013 — GitHub-Synced Contributors as Single Source of Truth

### Status

Accepted

### Context

Contributors needed to be shown on the public site and editable by admins. Earlier designs treated contributors as a generic MongoDB content resource, which risked drifting from the commit data generated by the GitHub Action.

### Decision

`data/contributors.json` in `cpccu-client` (`release` branch) is the **single source of truth** for contributor data:

- A daily GitHub Action regenerates it from commits in `cpccu/cpccu-client` **and** `cpccu/cpccu-server`, excluding bots and preserving manually-managed fields (`batch`, `linkedin`).
- The admin page (`/admin/contributors`, `src/components/contributors-content.jsx`) does **not** use generic content CRUD. It reads the file live through the backend's GitHub Contents API (`GET /admin/contributors`) and writes back **only `batch` and `linkedin`** (`PATCH /admin/contributors/:githubUsername`), so admin edits are never overwritten by the next workflow run.
- Role is fixed as `Contributor` — admins cannot change it.

### Why

- One canonical file; no second database copy to reconcile.
- Admin edits and the automation write to the same document.
- Read-only GitHub fields can never be corrupted by manual edits.

### Consequences

**Pros:** no drift between the pipeline and admin edits; the public page and profile contributions widget read the same data.

**Cons:** the backend needs `CONTRIBUTOR_GITHUB_TOKEN` (write access to `cpccu-client` contents) for the feature to work; edits appear on the public site only after a redeploy.

---

## ADR-014 — Site Statistics Are Derived, Not Manually Entered

### Status

Accepted

### Context

The site displays statistics (members, gallery photos, events, visitors, certificates, verification counts, contests, winners). A manually-edited counters collection could show numbers that contradict the real data.

### Decision

All statistics are **computed live** by the backend's `statistics.service.js` (`getSiteStatistics`) using `countDocuments()`/`findOne()` against the real collections (`User`, `GalleryItem`, `Event`, `Certificate`, `CertificateVerificationLog`, `Visitor`). The admin (`GET /admin/statistics`) and public (`GET /content/statistics`) endpoints return the **same** derived values, and the admin page is read-only — there is no `PATCH /admin/statistics` route and no `SiteStatistics` model anymore.

### Why

- Numbers always reflect the actual database.
- No editing UI to maintain, no stale counters.
- One implementation serves both public and admin consumers.

### Consequences

**Pros:** consistent, honest, zero-maintenance statistics.

**Cons:** counts are as good as the underlying data (e.g. empty collections show zeros locally); "Contests Held" depends on events carrying `type: "contest"`.

---

## ADR-015 — Backend-Enforced Email Verification

### Status

Accepted

### Context

The account lifecycle allows registration without verification. Previously the frontend could gate verification, which is not a security boundary — a crafted client could skip it.

### Decision

The **backend is the security authority** for email verification:

- `POST /auth/login` validates credentials first, then rejects unverified accounts with **`403` + error code `EMAIL_NOT_VERIFIED`** — no JWT, no cookies, no refresh-token persistence.
- `verifyToken` rejects any `isValid: false` user even with a valid access token.
- Both refresh paths (standalone endpoint and inline renewal) validate the refresh token against the user's persisted `refreshTokens[]` **and** require `isValid: true` — an unverified account cannot renew a session.
- The Google sign-in path applies the same `isValid` check as defense-in-depth.
- The frontend (`Login.jsx`) detects `EMAIL_NOT_VERIFIED` and reopens the existing OTP verification popup; no credentials are stored.

### Why

- Verification is a server-side property of the account, not a UI state.
- Closes the bypass where a client could obtain a session without verifying.

### Consequences

**Pros:** enforcement is uniform across login, token validation, refresh, and Google paths; covered by the backend auth regression tests.

**Cons:** the frontend must handle the `403 EMAIL_NOT_VERIFIED` contract (it does); `/auth/verify-registration` itself remains unthrottled (documented in the backend [SECURITY.md](https://github.com/cpccu/cpccu-server/blob/dev/docs/SECURITY.md)).

---

## ADR-012 — Future Decisions (Planned, Not Implemented)

> The following are **Planned** directions. None of them are implemented in the current codebase — treat them as proposals, not facts.

### 1. Notification System

**Planned.** Notification *preference toggles* already exist in the admin System Settings (`system-settings-content.jsx`: `emailNewPost`, `emailProfileSubmission`, `browserNotifications`), but there is **no notification delivery engine** (no in-app inbox, no push/email sending) on the frontend.

### 2. Certificate PDF Download

**Planned.** `src/lib/certificates/permissions.js` contains `canDownloadCertificate` / `canShareCertificate` / `canEditCertificate` / `canDeleteCertificate` **stubs that always return `false`**; the Download button in `CertificatesSection` is disabled with a "Coming Soon" tooltip.

### 3. Share Certificates

**Planned.** The same `permissions.js` stubs prepare share checks; no share implementation exists yet.

### 4. QR Verification

**Planned.** Certificates currently verify by ID/name/student ID search. A QR-code verification flow (scan → `/certificate/[certificateId]`) is a natural extension of the existing detail page.

### 5. Print Certificates

**Planned.** No print stylesheet or print action exists for certificate cards.

### 6. Email Service

**Planned.** Email is currently limited to password-reset links and OTP via the backend. A general email service (newsletters, notifications) is not implemented.

### 7. WebSocket / Real-Time Notifications

**Planned.** All current data flow is request/response via RTK Query. Real-time updates (e.g., live dashboard signals, in-app notifications) would require a WebSocket/SSE layer and are not implemented.

### 8. Google OAuth / Client-Side Refresh Tokens

**Planned.** Not implemented (see ADR-011). Google OAuth would be genuinely new work — the `firebase-admin` dependency and the `google-signin`/`google-signup` endpoints it backed were removed from the migrated API, so re-adding Google auth means re-adding a large dependency to `next.config.mjs`'s `serverExternalPackages` or the build fails on dynamic requires.

**Client-side refresh, specifically, is no longer a planned direction** — it was superseded by the `httpOnly` cookie session. Renewal is already transparent and server-side, so what remains genuinely open is *distributed* rate limiting for the credential endpoints, not client-side token orchestration.

---

## Document History

- ADR-001 to ADR-012 created during the documentation audit (August 2026).
- ADR-013 to ADR-015 added in September 2026 (GitHub-synced contributors, derived statistics, backend-enforced email verification).
- **September 2026 — backend migration and cutover.** ADR-001 marked **superseded in part** (single Vercel deployment; no Render, no `NEXT_PUBLIC_API_BASE_URL`, no CORS). ADR-011 **rewritten** to the `httpOnly` cookie session. ADR-008 already recorded the `publicApi` deletion. ADR-012 §8 updated.
- All "Accepted" ADRs verified against the current `cpccu-client` codebase. Where a record cites `cpccu-server`, that citation is to the **archived** Express repository and is retained deliberately as the provenance for a ported decision — it is not a claim that the code lives there any more.
