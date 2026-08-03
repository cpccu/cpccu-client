# CLAUDE.md

This file provides guidance to AI coding agents (Claude Code, Cursor, Copilot, etc.) when working with code in this repository.

> For the *reasoning* behind the architecture (why things are built this way), see [ADR.md](./ADR.md) — Architecture Decision Records.

## Project Overview

**CPCCU** — Competitive Programming Camp City University portal. A Next.js 16 client-side rendered web app with Tailwind CSS 4.

- **Live site**: https://cpccu.club/
- **Frontend**: deployed on **Vercel**
- **Backend** (`cpccu-server`): deployed on **Render**
- **Current branch**: `dev` (all feature branches should branch from `dev`; `release` is used for contributor automation)

## Commands

```bash
npm run dev        # Start dev server (localhost:3000)
npm run build      # Production build
npm run start      # Start production server
npm run lint       # Next.js lint
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
    login/, signup/     # Auth pages
    reset-password/[code]/[token]/
    admin/              # Admin panel routes (client-guarded layout)
    verify/[certificateId]  # Redirects to /certificate/[certificateId]
    redux/              # store.js, ProviderWrapper.js (rootReducer.js is STALE, unused)
    not-found.jsx       # 404 page
    ScrollToTop.jsx     # Global scroll-to-top behavior
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
```

### Routing & Layout

- Root layout (`src/app/layout.jsx`) wraps everything in Redux Provider + AuthHydrator.
- `(main)` route group uses its own layout with Header → NavBar → Footer → GoToTop chrome.
- `not-found.jsx` for 404 handling.
- Admin routes under `src/app/admin/` with a client-side guard in `src/app/admin/layout.jsx` (redirects to `/login` when unauthenticated; blocks non-admin roles).
- Static JSON data in `data/` is imported directly into components as fallback.

### State Management

- **Single base API**: `src/services/baseApi.js` with tag types:
  ```
  ['Auth', 'Users', 'Posts', 'Projects', 'PublicContent', 'AdminOverview',
   'AdminMembers', 'AdminContent', 'AdminStatistics', 'AdminCertificates',
   'AdminSystemSettings', 'AdminRoles']
  ```
  Feature API files (e.g., `features/auth/authApi.js`) extend it via `baseApi.injectEndpoints()`.
- **Redux slices** live alongside their APIs in `features/<name>/`.
- **Active store** (`src/app/redux/store.js`) registers: `api` (baseApi), `publicApi` (public certificate API), `auth`, `certificate`. `serializableCheck` is disabled.
- `userSlice.js`, `memberSlice.js`, `postSlice.js` exist in `features/` but are **not registered** in the store.
- **Auth hydration**: `ProviderWrapper` reads `token` from localStorage on mount, calls `useGetCurrentUserQuery` if a token exists, then dispatches `setCredentials` or `clearCredentials`, and finally `setHydrated`.
- API base URL: `NEXT_PUBLIC_API_BASE_URL` env var, defaults to `http://localhost:5000/api/v1`.
- **Public certificate API** (`publicApi`): separate `createApi` instance at the base URL without the `/api/v1` suffix, for unauthenticated `/verify/:certificateId`.

### Key Patterns

- Components import static JSON directly (e.g., `import data from "@/data/Committee.json"`).
- Tailwind uses `@/lib/utils` (`cn`) for class merging (root `lib/cn.js` is an equivalent fallback).
- Font Awesome + Lucide React for icons.
- API calls go through RTK Query — not fetch/axios directly — except the visitor counter, bootcamp leaderboard, and the server-side certificate metadata fetch.
- `scripts/update_contributors.py` + `.github/workflows/update-contributors.yml` auto-update `data/contributors.json` daily on the `release` branch.
- Admin content uses generic CRUD endpoints: `GET/POST /admin/content/:resource`, `PATCH/DELETE /admin/content/:resource/:id`.
- Admin image uploads go to Cloudinary via `POST /admin/uploads/image` using the `uploadAdminImage` mutation.
- `useAdminContent(resource, fallback)` manages local state for admin content tables with fallback JSON data.
- `useToast()` / `toast()` provide global toast notifications (limit 1).
- `useIsMobile()` provides mobile breakpoint detection (768px).

### Auth & Security

- Single access token stored in **localStorage** (`token`), sent as `Authorization: Bearer <token>` with `credentials: 'include'`.
- **No refresh-token and no Google OAuth flow exists on the frontend** — do not document or assume otherwise.
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
- `src/components/ADMIN/AdminPanel.jsx` — unused (dashboard is `dashboard-content.jsx`).
- `src/components/Layout/Profile1.jsx` + legacy `PROFILE` components (`ProfileCard`, `ProfileDetails`, `ProfileID`, `ProfileBlog`, `Profile_Blog_Modal`, `ProfileNotFound`) — unused.
- There is **no** `generateCertificateId.js` file; `generateCertificateId` is a local function inside `src/components/certificates-content.jsx`.
- `render.yaml` / `_render.yaml` are leftover from the old Render frontend deployment — the frontend now deploys on **Vercel**.
