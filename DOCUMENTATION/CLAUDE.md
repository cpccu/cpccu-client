# CLAUDE.md

This file provides guidance to AI coding agents (Claude Code, Cursor, Copilot, etc.) when working with code in this repository.

> For the *reasoning* behind the architecture (why things are built this way), see [ADR.md](./ADR.md) — Architecture Decision Records.

## Project Overview

**CPCCU** — Competitive Programming Camp City University portal. A Next.js 16 client-side rendered web app with Tailwind CSS 4.

- **Live site**: https://cpccu.club/
- **This app is the whole platform**: frontend **and** API (Next.js App Router route handlers under `src/app/api/**`), deployed as a single Vercel project
- **`cpccu-server`** (the retired Express backend, a separate repo) is a read-only historical reference. Nothing in this repository depends on it at build time or runtime — do not add a dependency on it, and do not document running it.
- **Current branch**: `dev` (all feature branches should branch from `dev`; `release` is used for contributor automation)

## Commands

```bash
npm run dev        # Start dev server (localhost:3000) — pages AND API
npm run build      # Production build
npm run start      # Start production server
npm run lint       # ESLint (flat config in eslint.config.mjs)
npm test           # node --test over test/*.test.js — no framework dependency
```

Bun variants also exist: `bun-dev`, `bun-build`, `bun-start`.

## Architecture

### Tech Stack

- **Next.js 16** (App Router) with `src` directory
- **React 19**, **Tailwind CSS 4**
- **Redux Toolkit + RTK Query** for state management and API layer
- **Radix UI** unstyled primitives (shadcn-style components in `src/components/ui/`)
- **Framer Motion** for animations
- **Zod** for validation
- **Sonner** + **SweetAlert2** for notifications
- **Recharts** for admin dashboard charts
- **Embla Carousel** for homepage carousels
- **date-fns** + **React Day Picker** for dates
- **react-easy-crop** for avatar cropping
- **upload-js** for Cloudinary image uploads

### Directory Structure

```
src/
  app/                  # Next.js App Router pages
    (main)/             # Main site pages with shared layout (Header + NavBar + Footer + GoToTop)
    api/                # THE API — 53 route.js files, 65 endpoints, at /api/** and /api/v1/**
                        #   v1/<module>/<path>/route.js  — a defineRoute({...}) declaration and nothing else
                        #   visitor/route.js             — the unversioned compatibility mount
    login/, signup/     # Auth pages
    reset-password/[code]/[token]/
    admin/              # Admin panel routes (client-guarded layout)
    verify/[certificateId]  # Redirects to /certificate/[certificateId]
    redux/              # store.js, ProviderWrapper.js (rootReducer.js is STALE, unused)
    not-found.jsx       # 404 page
    ScrollToTop.jsx     # Global scroll-to-top behavior
  lib/server/           # Server foundation for the API (server-only modules)
                        #   handler.js (defineRoute), http.js (apiRoute: owns the order + every
                        #   security step), shim.js (Express-shaped (req,res) adapter),
                        #   auth.js, request.js (CSRF, IP, cookies, body caps), env.js,
                        #   errors.js, rateLimit.js, adminAuth.js, constants.js, db.js,
                        #   cloudinary.js, sendEmail.js, models/, controllers/, services/, email/
  components/
    PROFILE/            # Active profile sections (ProfileHero, AboutSection, SkillsSection,
                        #   ProjectsSection, CertificatesSection, ContributionsSection,
                        #   ContactSection, QuickStats, SectionCard, ...)
    CERTIFICATE/        # Certificate portal (verify-form, certificate-stats, badges, theme-provider)
    Global/             # Header, NavBar, Footer, GoToTop, Pagination, SideProfile
    Layout/             # Profile.jsx (active), JobPipeline.jsx, Home, Blog, Contact, Event, Gallery,
                        #   AboutLayout/... — Profile1.jsx is UNUSED legacy
    [Domain folders]    # ABOUT, ADMIN, ALERT, BLOG, CONTACT, CONTRIBUTORS, DONATORS, EVENT,
                        #   GALLERY, HOME, JobPipeline, LOGINSIGNUP, BOOTCAMPLEADERBOARD
    ui/                 # shadcn/ui-style components (Radix UI primitives)
    admin-*.jsx         # Admin-specific components (admin-layout, admin-sidebar, admin-data-table, ...)
  Context/              # Scroll section contexts: BlogScroll, ContactScroll, EventScroll, GalleryScroll, OurMessionScroll
  features/             # Feature modules (auth, certificate, members, posts, users, content, contact, admin)
                        #   Each has <name>Api.js (RTK Query endpoints) + optional <name>Slice.js
  hooks/                # use-admin-content.js, use-mobile.js, use-toast.js
  proxy.ts              # Next.js 16 proxy (security headers middleware)
  services/             # baseApi.js — single RTK Query base API (all features inject into it)
  lib/                  # Utilities (roles.js, certificates/, public-content.js, id-validation.js, ...)
data/                   # Static JSON data files (fallback content)
scripts/                # update_contributors.py
test/                   # node --test suite — server foundation + client/server endpoint parity
```

### Routing & Layout

- Root layout (`src/app/layout.jsx`) wraps everything in Redux Provider + AuthHydrator.
- `(main)` route group uses its own layout with Header → NavBar → Footer → GoToTop chrome.
- `not-found.jsx` for 404 handling.
- Admin routes under `src/app/admin/` each import `src/components/admin-layout.jsx`, the client-side guard (redirects to `/login` once hydration completes; blocks non-admin roles with an "Admin access required" screen). `src/app/admin/layout.jsx` is only a metadata pass-through.
- Static JSON data in `data/` is imported directly into components as fallback.

### State Management

- **Single base API**: `src/services/baseApi.js` with tag types:
  ```
  ['Auth', 'Users', 'Posts', 'Projects', 'PublicContent', 'AdminOverview',
   'AdminMembers', 'AdminContent', 'AdminContributors', 'AdminStatistics',
   'AdminCertificates', 'AdminSystemSettings', 'AdminRoles']
  ```
  Feature API files (e.g., `features/auth/authApi.js`) extend it via `baseApi.injectEndpoints()`.
- **Redux slices** live alongside their APIs in `features/<name>/`.
- **Active store** (`src/app/redux/store.js`) registers: `api` (baseApi), `auth`, `certificate`. `serializableCheck` is disabled. There is no longer a `publicApi` entry — the second instance was removed during the Express → Next.js migration.
- `userSlice.js`, `memberSlice.js`, `postSlice.js` exist in `features/` but are **not registered** in the store.
- **Auth hydration**: `ProviderWrapper` calls `useGetCurrentUserQuery` (`GET /users/user`) on mount with **no `skip` gate and no `localStorage` read** — the `httpOnly` cookie is sent automatically, so there is nothing client-side to gate on. It then dispatches `setCredentials` with the server's user, or `clearCredentials` on any error. `GET /users/user` is the sole authority on session identity.
- API base URL: the hard-coded relative literal `/api/v1` in `src/services/baseApi.js`. **There is no base-URL environment variable** — `NEXT_PUBLIC_API_BASE_URL` was deleted in the cutover, and `test/client-endpoint-parity.test.js` fails if a `process.env` read reappears in that file.
- **Client/server endpoint parity is enforced by a test, not by convention.** `test/client-endpoint-parity.test.js` joins every URL declared in `src/features/**` and `src/lib/**` against every `route.js` under `src/app/api/**` and asserts the method matches; `test/route-method-declaration.test.js` asserts each route file's `defineRoute('…')` agrees with its `export const` name. Run `npm test` whenever you add, rename, move or re-method an endpoint on either side.
- **Public certificate verification** needs no separate instance: it is served by the single `baseApi` at `GET /api/v1/certificates/verify/:certificateId` (`public: true`, no auth required). The `publicApi` instance this file used to describe — a second `createApi` at a base URL with the `/api/v1` suffix stripped, built solely to reach the Express backend's root-level `/verify/:certificateId` (`cpccu-server/src/app.js:76`) — has been **deleted** along with its store registration. `grep -rn "createApi(" src/` now returns exactly one hit, `src/services/baseApi.js`.

### Key Patterns

- Components import static JSON directly (e.g., `import data from "@/data/Committee.json"`).
- Tailwind uses `@/lib/utils` (`cn`) for class merging (root `lib/cn.js` is an equivalent fallback).
- Font Awesome + Lucide React for icons.
- API calls go through RTK Query — not fetch/axios directly — except the visitor counter, bootcamp leaderboard, and the server-side certificate metadata fetch.
- `scripts/update_contributors.py` + `.github/workflows/update-contributors.yml` auto-update `data/contributors.json` daily on the `release` branch from commits in **both** `cpccu/cpccu-client` and `cpccu/cpccu-server` (bots excluded, `batch`/`linkedin` preserved).
- **Contributors admin is GitHub-synced, NOT generic content:** `/admin/contributors` uses `GET /admin/contributors` + `PATCH /admin/contributors/:githubUsername` (backend GitHub Contents API, requires `CONTRIBUTOR_GITHUB_TOKEN`). Only `batch`/`linkedin` are editable; role is fixed as `Contributor`.
- Admin content uses generic CRUD endpoints: `GET/POST /admin/content/:resource`, `PATCH/DELETE /admin/content/:resource/:id`.
- Admin image uploads go to Cloudinary via `POST /admin/uploads/image` using the `uploadAdminImage` mutation.
- `useAdminContent(resource, fallback)` manages local state for admin content tables with fallback JSON data.
- `useToast()` / `toast()` provide global toast notifications (limit 1).
- `useIsMobile()` provides mobile breakpoint detection (768px).

### Auth & Security

- **The session is an `httpOnly` cookie.** The client holds **no token**: nothing in `src/` stores a session credential, no `Authorization` header is attached, and the login/refresh response bodies carry no token. `localStorage` holds only a cached `user` object, which is a cache for first paint and **never** proof of a session.
- **`GET /api/v1/users/user` is the sole authority on session identity** — `ProviderWrapper` calls it on every page load and dispatches `clearCredentials` on a 401 (or any error). When "everything is logged out", that request is the thing to debug.
- **The API is same-origin**, so unsafe methods are CSRF-checked in-process by `assertSameOrigin` (`src/lib/server/request.js`) against an allow-list seeded from **`WEB_DOMAIN`** and **`NEXT_PUBLIC_SITE_URL`**. Getting either wrong 403s every `POST`/`PATCH`/`DELETE` while reads keep working — this is the single most common deploy misconfiguration, so it is the first thing to check. `test/csrf.test.js` covers the decision table.
- **No refresh-token flow and no Google OAuth flow on the client** — do not document or assume otherwise. `GET /auth/refresh-token` exists server-side and is never called by this app; transparent renewal happens inside the server, which re-issues the access-token cookie.
- **`POST /api/v1/auth/logout`**, not `GET`. It was `GET` until the cutover, and `GET` is exempt from the CSRF check, so a cross-site `<img src>` could force-log a victim out and revoke their refresh token for seven days.
- **Email verification is enforced by the server.** Unverified login returns `403` with the error code `EMAIL_NOT_VERIFIED`; `Login.jsx` detects the code and reopens the OTP popup (`OtpVerifyPopup`) without storing credentials. Server enforcement is the security authority — do not implement client-side-only verification gates.
- `src/proxy.ts` is the Next.js 16 proxy (middleware) applying CSP (production only), X-Frame-Options DENY, HSTS, Referrer-Policy, Permissions-Policy, and COOP/COEP/CORP headers.

### Admin Roles

Three-tier system role system:
- **Admin**: Full access to all modules and write actions (including Alumni, Committees, Contributors, Donators, Jobs, Audit Logs, Messages, System Settings).
- **Moderator**: Dashboard, Posts, Events, Gallery, Statistics, Account Settings (content-focused).
- **Mentor**: Dashboard, Members, Certificates, Statistics, Account Settings (read-oriented).

Official CPCCU position roles (President, Vice President, etc.) are **display-only** and managed via `/admin/roles` API endpoints from the Members page.

### Profile System

- Route `/profile/[id]`; legacy alias `/users/profile/[id]`.
- Active layout: `src/components/Layout/Profile.jsx`; sections in `src/components/PROFILE/`.
- Certificates are fetched dynamically by student ID (`recipientId: uniID`) via `useLazyVerifyCertificateQuery` — they are **not** stored on the user.
- Projects are fetched via `getProjects` (owner) / `getPublicProjects` (visitor).
- Contributions widget matches the member's GitHub URL against `data/contributors.json`.
- Job pipeline states: `hidden` (default) → `pending` → `approved` | `rejected` → removable → `hidden`.

### Key Library Modules

#### `src/lib/roles.js`
- `normalizeRole(name)`, `isOfficialRole(role)`, `getDisplayRole(officialRole)`, `roleIcon(role)`, `roleBadgeColor(role)`, `sortRoles(roles)`, `DEFAULT_CPCCU_ROLES`.

#### `src/lib/certificates/`
- `badges.js` — badge color/size config; `parser.js` — `getCertificatesFromResponse`; `permissions.js` — stubs (all false); `sorting.js` — sort helpers; `index.js` — re-exports.

#### `src/lib/public-content.js`
- Public content mappers (`chooseLiveItems`, `toPublicContributor`, `toPublicEvent`, `toPublicDeveloperProfile`, `groupGalleryItemsByEvent`, ...) and GitHub helpers (`extractGithubUsername`, `findContributorByGithub`, `parseContributionInfo`).

#### `src/lib/id-validation.js` & `src/lib/password-validation.js`
- Student ID rules (`isValidStudentId`, scientific-notation guards) and password strength rules.

## Known File Inconsistencies (verified)

- `src/features/certificate/certificateSlise.js` — typo in filename (should be `certificateSlice.js`), but wired correctly.
- `src/features/posts/postApi.js` — empty; posts handled via generic admin content API.
- `src/app/redux/rootReducer.js` — stale (imports files that don't exist); not used by the active store.
- `src/features/users/userSlice.js`, `src/features/members/memberSlice.js`, `src/features/posts/postSlice.js` — not registered in the store.
- `src/features/members/memberApi.js` — provides a `Members` tag not declared in `baseApi.tagTypes`.
- `userApi.js` `createUser` (`POST /users/user`) / `deleteUser` (`DELETE /users/:id`) and `memberApi.js` `fetchMemberById` (`GET /users/member/:id`) — these had **no matching route in either backend** and have now been **deleted**, with the reason recorded in place (`userApi.js:13`, `userApi.js:71`, `memberApi.js:11`). Do not reintroduce them; `test/client-endpoint-parity.test.js` will fail if a URL with no route comes back.
- `src/components/ADMIN/AdminPanel.jsx` — unused (dashboard is `dashboard-content.jsx`).
- `src/components/Layout/Profile1.jsx` + legacy `PROFILE` components (`ProfileCard`, `ProfileDetails`, `ProfileID`, `ProfileBlog`, `Profile_Blog_Modal`, `ProfileNotFound`) — unused.
- There is **no** `generateCertificateId.js` file; `generateCertificateId` is a local function inside `src/components/certificates-content.jsx`.
- `render.yaml` / `_render.yaml` were the old Render deploy blueprints. They are **deleted, on purpose** — the project deploys on **Vercel**. Do not restore them; the reasoning is in `BACKEND_MIGRATION.md` §10.3.1.
- `test/` holds a `node --test` suite covering the server foundation and the client/server seam. There is no test framework dependency. `BACKEND_MIGRATION.md` §11 records what it still leaves uncovered.
