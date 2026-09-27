# CPCCU - Competitive Programming Camp City University

The official web portal for the Competitive Programming Camp at City University. This platform supports community engagement, member management, public content publishing, certificate verification, a full-featured admin panel, public member profiles, a developer job pipeline, and dynamic role management.

- **Live site**: https://cpccu.club/
- **Deployment**: Vercel — this repository serves **both** the frontend and the API (Next.js App Router route handlers under `src/app/api/**`, reached same-origin at `/api/v1`)
- **API architecture**: 65 endpoints in 53 route handlers, auth-by-default, with the handover record in [DOCUMENTATION/BACKEND_MIGRATION.md](./DOCUMENTATION/BACKEND_MIGRATION.md)

---

## 🚀 Features

### Public Site

- **Homepage**: Hero section, visitor counter, mission & responsibility, upcoming events, gallery preview, contributors carousel, donators carousel, statistics counters.
- **Member Management**: Public member directory (`/member`) with profiles, skill tracking, academic details, and admin-managed member records.
- **Authentication**: Login, registration with email OTP verification, password reset, and session hydration via an `httpOnly` cookie. Email verification is **enforced server-side** — an unverified account cannot log in (the login page reopens the OTP popup automatically).
- **Profile System**: Dynamic public profiles at `/profile/[id]` with Hero, About, Skills, Projects, Certificates, Contributions, Contact, and Quick Stats sections, plus owner-only edit mode.
- **Certificate System**: Public certificate verification portal at `/certificate` with search by certificate ID / recipient name / student ID, certificate statistics, recent certificates, and per-certificate detail pages (`/certificate/[certificateId]`).
- **Dynamic Content**: Blog posts, event pages, galleries, contributors, donators, and public site content managed via the admin panel.
- **Job Pipeline**: Public developer profile showcase with an approval workflow. Members can request to display their profile in the job pipeline.
- **Bootcamp Leaderboard**: Live leaderboard integration for bootcamp participants.
- **Alumni & Committee**: Dedicated pages for alumni profiles and current/previous committees.
- **Contact Page**: Public contact form with message submission.
- **History Page**: Club history and legacy information.
- **Not Found (404)**: Custom 404 error page.
- **Scroll-to-Top**: Global scroll-to-top button on all pages.

### Admin Panel (`/admin`)

- **Role-Based Access**: Three system roles — Admin (full access), Moderator (content management), Mentor (read-oriented operational data).
- **Dynamic Role Management**: Admins can create, update, toggle, and view official CPCCU position titles (President, Vice President, General Secretary, etc.) via `/admin/roles` endpoints from the Members page.
- **Dashboard**: Live overview with member status charts, content charts, and operational cards from the database.
- **Members**: Member approval, official-role assignment, and status management.
- **Content Management**: Generic CRUD for committees, donators, events, gallery, messages, posts, alumni, and profiles.
- **Contributors Management**: GitHub-synced contributor records — GitHub fields are read-only, only `batch`/`linkedin` are editable, and the role is fixed as Contributor.
- **Alumni Management**: Alumni profile CRUD with fallback to static JSON.
- **Event Management**: Event creation with date phases (remaining, running, ended), reward rules, and button links.
- **Gallery Management**: Image upload and gallery organization, including gallery-event groupings.
- **Certificates**: Certificate issue, bulk issue, update, delete, and public verification.
- **Statistics**: Live public statistics derived automatically from real site data (read-only — no manual counters).
- **System Settings**: Site metadata, maintenance mode, and appearance configuration.
- **Audit Logs**: Read-only log viewer for admin create/update/delete actions.
- **Job Pipeline Admin**: Review and approve/reject/remove member job pipeline requests.
- **Messages**: Contact message triage and management.
- **Cloudinary Uploads**: Direct image upload support for admin-managed content.
- **Account Settings**: Admin profile and password management.

### Profile System

- **Profile Page**: Dynamic user profile at `/profile/[id]` (legacy alias `/users/profile/[id]`) with modular sections: Hero, About, Skills, Projects, Certificates, Contributions, Contact, Quick Stats.
- **Profile Editing**: Users can update their profile info, upload and crop avatar images, manage skills, and manage projects.
- **Projects CRUD**: Users can create, update, and delete personal projects displayed on their profile.
- **Job Pipeline Request**: Users can request to appear in the public job pipeline; requests require admin approval.
- **Certificates are fetched dynamically**: The Certificates section queries the certificate API using the member's student ID — certificates are **not** stored in the user profile.

### UI & UX

- **Responsive UI**: Optimized for desktop, laptop, and mobile using Tailwind CSS, Framer Motion, and Radix UI primitives.
- **Animations**: Framer Motion scroll animations, page transitions, and interactive effects.
- **Toast Notifications**: Global toast system using Sonner and SweetAlert2.
- **Image Handling**: Cloudinary-backed image uploads with react-easy-crop for profile images.
- **Accessibility**: Radix UI primitives for accessible dialogs, dropdowns, accordions, and more.

## 🛠️ Tech Stack

| Category | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router, `src/` directory) |
| Runtime UI | React 19 |
| Language | JavaScript (ES modules, JSX) |
| State Management | Redux Toolkit |
| Server State / Data Fetching | RTK Query |
| Styling | Tailwind CSS 4, Tailwind CSS Animate, Tailwind Merge |
| UI Component System | Radix UI primitives + `class-variance-authority` + `@gpfunk/tailwindcss-clsx` |
| Animation | Framer Motion |
| Icons | Font Awesome, Lucide React, React Icons |
| Forms & Validation | Zod |
| Date Handling | date-fns, React Day Picker |
| Charts | Recharts |
| Carousels | Embla Carousel React |
| Notifications | Sonner, SweetAlert2 |
| Command Palette | cmdk |
| OTP Input | input-otp |
| Image Crop | react-easy-crop |
| Upload | upload-js (Cloudinary) |
| Scroll | react-scroll, react-scroll-trigger |
| Panels | react-resizable-panels |
| Counters | react-countup |
| Spreadsheet Export | xlsx |
| Security | `src/proxy.ts` (Next.js 16 proxy/middleware) + the API route-handler wrapper (`src/lib/server/http.js`) |
| Package Manager | npm / Bun |

## 📂 Project Structure

For a detailed explanation of the architecture, see [ARCHITECTURE.md](./DOCUMENTATION/ARCHITECTURE.md).

```
cpccu-client/
├── .github/workflows/       # GitHub Actions (update-contributors.yml)
├── data/                    # Static JSON content sources (fallback data)
├── DOCUMENTATION/           # Project documentation
├── lib/                     # Root-level shared utilities (cn.js tailwind-merge)
├── public/                  # Static assets
├── scripts/                 # Utility scripts (update_contributors.py)
├── test/                    # node --test suite (server foundation + endpoint parity)
├── src/
│   ├── app/                 # Next.js App Router pages & layouts
│   │   ├── (main)/          # Public pages with shared layout
│   │   │   ├── alumni/      # Alumni page
│   │   │   ├── blog/        # Blog page
│   │   │   ├── bootcamp-leaderboard/  # Bootcamp leaderboard page
│   │   │   ├── certificate/ # Certificate verification portal
│   │   │   │   └── [certificateId]/   # Per-certificate detail page
│   │   │   ├── committee/   # Committee page
│   │   │   ├── contact/     # Contact page
│   │   │   ├── contributors/# Contributors page
│   │   │   ├── donators/    # Donators page
│   │   │   ├── event/       # Event page
│   │   │   ├── gallery/     # Gallery page
│   │   │   ├── history/     # Club history page
│   │   │   ├── job-pipeline/# Developer job pipeline page
│   │   │   ├── member/      # Member directory page
│   │   │   ├── profile/[id] # Public profile page
│   │   │   ├── users/profile/[id]     # Legacy profile alias
│   │   │   └── page.jsx     # Homepage
│   │   ├── api/             # THE API — 53 route.js files / 65 endpoints
│   │   │   ├── visitor/     # /api/visitor* compatibility mount
│   │   │   └── v1/          # /api/v1/* — the API the app calls
│   │   ├── admin/           # Admin panel routes (members, posts, events, gallery,
│   │   │                     #   certificates, jobs, alumni, contributors, donators,
│   │   │                     #   committees, statistics, audit-logs, messages,
│   │   │                     #   settings/account, settings/system)
│   │   ├── login/           # Login page
│   │   ├── signup/          # Signup page with OTP verification
│   │   ├── reset-password/[code]/[token]/  # Password reset
│   │   ├── verify/[certificateId]/         # Redirects to /certificate/[certificateId]
│   │   ├── redux/           # Redux store, ProviderWrapper (auth hydration)
│   │   ├── not-found.jsx    # 404 page
│   │   └── ScrollToTop.jsx  # Global scroll-to-top behavior
│   ├── components/          # Feature and shared UI components
│   │   ├── PROFILE/         # Profile page components (ProfileHero, AboutSection,
│   │   │                     #   SkillsSection, ProjectsSection, CertificatesSection,
│   │   │                     #   ContributionsSection, ContactSection, QuickStats, etc.)
│   │   ├── CERTIFICATE/     # Certificate portal components (verify-form, stats, badges, ...)
│   │   ├── ui/              # shadcn/ui-style components (Radix UI primitives)
│   │   ├── Global/          # Header, NavBar, Footer, GoToTop, Pagination, SideProfile
│   │   └── [other domains]  # ABOUT, ADMIN, ALERT, BLOG, CONTACT, CONTRIBUTORS,
│   │                         #   DONATORS, EVENT, GALLERY, HOME, JobPipeline, LOGINSIGNUP, ...
│   ├── Context/             # Scroll-based section contexts (Blog, Contact, Event, Gallery, OurMission)
│   ├── features/            # Redux slices and RTK Query endpoint modules
│   │   ├── auth/            # authApi.js (RTK Query) + authSlice.js (Redux)
│   │   ├── users/           # userApi.js (users, projects, job pipeline)
│   │   ├── members/         # memberApi.js
│   │   ├── certificate/     # certificateApi.js (public + private) + certificateSlise.js
│   │   ├── content/         # contentApi.js
│   │   ├── contact/         # contactApi.js
│   │   ├── admin/           # adminApi.js
│   │   └── posts/           # postApi.js (empty) + postSlice.js
│   ├── hooks/               # use-admin-content, use-mobile, use-toast
│   ├── lib/                 # Utilities (roles, certificates/, public-content, etc.)
│   │   └── server/          # Server foundation for the API (auth, request/CSRF,
│   │                       #   rate limiting, admin auth, models, controllers, email)
│   ├── proxy.ts             # Next.js 16 proxy (security headers middleware)
│   └── services/            # baseApi.js — RTK Query base API (relative /api/v1)
```

## 🚦 Getting Started

### Prerequisites

- Node.js (v20.9+ — required by Next.js 16)
- npm or [Bun](https://bun.sh/)

### Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/cpccu/cpccu-client.git
    cd cpccu-client
    ```

2.  Install dependencies:
    ```bash
    npm install
    # OR
    bun install
    ```

3.  Set up environment variables:
    Create a `.env` in the root directory (copy `.env.sample`, which documents every variable inline) and fill in **at minimum the four hard-required ones**:

    ```bash
    cp .env.sample .env
    ```

    > ⚠️ Use `.env`, not `.env.local` — `.gitignore` covers exactly `.env`, so a `.env.local` would be committable with your secrets in it.

    ```env
    MONGODB_URI=mongodb+srv://...
    ACCESS_TOKEN_SECRET=<openssl rand -base64 48>
    REFRESH_TOKEN_SECRET=<a different one>
    PASSWORD_TOKEN_SECRET=<a third different one>
    ```

    These four are validated **lazily, on first use**, so a deployment missing them builds green and fails at runtime. You will also want `WEB_DOMAIN` and `NEXT_PUBLIC_SITE_URL` (they seed the CSRF origin allow-list — getting them wrong 403s every `POST`/`PATCH`/`DELETE` while reads still work), and the feature variables for Cloudinary, Resend, the contributor sync and the bootcamp leaderboard. See [DEVELOPER_ONBOARDING.md](./DOCUMENTATION/DEVELOPER_ONBOARDING.md) §5 for the full list.

    **There is no API base URL variable to set.** The API is this application and is reached at the hard-coded relative path `/api/v1`.

### Running the Project

- **Development Mode**:
    ```bash
    npm run dev
    # OR
    bun run dev
    ```
- **Production Build**:
    ```bash
    npm run build
    npm run start
    # OR
    bun run build
    bun run start
    ```
- **Tests**: `npm test` — a `node --test` suite over `test/*.test.js` (no framework dependency) covering the server foundation and the client/server endpoint parity.
- **Linting**: `npm run lint` — ESLint over the flat config in `eslint.config.mjs`. It is warn-first for advisory rules, so a large warning count is the recorded pre-existing backlog; `error` still fails the command.

## 🔐 Environment Variables

[`.env.sample`](./.env.sample) is the authoritative list and documents each variable inline. Summary:

**Hard-required** (validated by `src/lib/server/env.js`, lazily, on first use — a deploy missing them builds green and fails at runtime with 500s rather than 401s):

| Variable | Purpose |
| --- | --- |
| `MONGODB_URI` | The database |
| `ACCESS_TOKEN_SECRET` | Signs the access token |
| `REFRESH_TOKEN_SECRET` | Signs the refresh token |
| `PASSWORD_TOKEN_SECRET` | Signs the password-reset `code`/`token` pair |

**Required for the app to be usable** — a wrong or missing value here **403s every unsafe method** while reads keep working, because these seed the CSRF origin allow-list:

| Variable | Purpose |
| --- | --- |
| `WEB_DOMAIN` | Bare origin with scheme, no trailing slash. Password-reset link host, and a CSRF allow-list seed. |
| `NEXT_PUBLIC_SITE_URL` | CSRF allow-list seed. The `www.` sibling is derived automatically. **Inlined at build time** — changing it needs a rebuild. |
| `EXTRA_ALLOWED_ORIGINS` | Comma-separated extra hosts (staging, preview). Additive only. |

**Per feature:** `ACCESS_TOKEN_EXPIRE` / `REFRESH_TOKEN_EXPIRE` / `PASSWORD_TOKEN_EXPIRE`; `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` / `CLOUDINARY_UPLOAD_PRESET`; `RESEND_API_KEY`; `CONTRIBUTOR_GITHUB_TOKEN`; `GOOGLE_SHEETS_API_KEY` + `BOOTCAMP_SHEET_ID`; and `VERBOSE_ERRORS` for forcing raw or redacted error text on a real host.

> Do not set `NODE_ENV` by hand — Next sets it at build time and the platform sets it at runtime. Use `VERBOSE_ERRORS` to control error detail on a real host. All of these are read **server-side** in this repository; the leaderboard's Sheets variables are no longer backend-only, they are read by this app's own route handler.

See [DEPLOYMENT.md](./DOCUMENTATION/DEPLOYMENT.md) for full production environment configuration.

## 📖 Documentation

- [Documentation Index](./DOCUMENTATION/README.md) — Table of contents for all docs.
- [Developer Onboarding](./DOCUMENTATION/DEVELOPER_ONBOARDING.md) — "I just joined the team — what do I do?"
- [Architecture Overview](./DOCUMENTATION/ARCHITECTURE.md) — Deep dive into folder structure, routing, state management, data flow, and all major systems (Profile, Certificate, Job Pipeline, Roles, Projects, Contributors).
- [Architecture Decision Records](./DOCUMENTATION/ADR.md) — Why the project is built this way (deployment, certificates, roles, profile, job pipeline, auth, and planned decisions).
- [API Documentation](./DOCUMENTATION/API_DOCUMENTATION.md) — List of integrated endpoints and request contracts.
- [Admin Panel Implementation](./DOCUMENTATION/CPCCU_Admin_Panel_Implementation_Documentation.md) — Admin roles, data flow, content management, and migration notes.
- [Security](./DOCUMENTATION/SECURITY.md) — Security architecture, auth enforcement, and known debt.
- [Troubleshooting](./DOCUMENTATION/TROUBLESHOOTING.md) — Common problems and how to fix them.
- [Deployment Guide](./DOCUMENTATION/DEPLOYMENT.md) — single-origin Vercel deployment of the app and its API, env vars, and the post-deploy smoke test.
- [Backend Migration](./DOCUMENTATION/BACKEND_MIGRATION.md) — how the Express API was migrated into route handlers in this repo and cut over to same-origin; the endpoint table, the security review, and the open risks.
- [Contribution Guide](./DOCUMENTATION/CONTRIBUTION.md) — Branching strategy, development workflow, and pull request process.

## 🤝 Contributing

We welcome contributions! Please follow the steps outlined in our [Contribution Guide](./DOCUMENTATION/CONTRIBUTION.md).

Quick reference:
1.  Fork the project.
2.  Create your feature branch from `dev`: (`git checkout -b feat/AmazingFeature`).
3.  Commit your changes (`git commit -m 'feat: add some AmazingFeature'`).
4.  Push to the branch (`git push origin feat/AmazingFeature`).
5.  Open a Pull Request to the `dev` branch.

## Preview

### Desktop
![Desktop](https://res.cloudinary.com/dfspekq6u/image/upload/v1781070746/desktop_ss_fosk3x.png)

### Laptop
![Laptop](https://res.cloudinary.com/dfspekq6u/image/upload/v1781070746/laptop_ss_vilzut.png)

### Mobile
![Mobile](https://res.cloudinary.com/dfspekq6u/image/upload/v1781070745/mobile_ss_od0z5y.png)

## Logos
https://i.ibb.co.com/Nm3q6c0/Artboard-1.png

## 📌 Notes

- The app uses a shared public layout (`src/app/(main)/layout.jsx`) for main site pages (Header, NavBar, Footer, GoToTop) and a separate admin area under `/admin` guarded by `src/components/admin-layout.jsx`.
- API requests are driven through RTK Query with a single shared `baseApi` instance (`src/services/baseApi.js`) — there is no longer a separate unauthenticated `publicApi`. Public certificate verification was the only thing that instance ever existed for; it is now served by the same instance at `GET /api/v1/certificates/verify/:certificateId`. (The `publicApi` created here was removed during the Express → Next.js migration: it existed only because the Express backend mounted verification at the root path `/verify/:certificateId`, outside the `/api/v1` base URL, and that root path is no longer served.)
- Public content is split between static JSON data in `data/` and API-backed managed content. Admin-managed content falls back to JSON when the database is empty.
- **Authentication**: the session is an **`httpOnly` cookie** — the client holds no token, stores no credential, and attaches no `Authorization` header (`credentials: 'include'` lets the browser send the cookie). `GET /api/v1/users/user` is the **sole authority on session identity**: `ProviderWrapper` calls it on every page load with no `skip` gate and clears the session on any error. The `user` object mirrored into `localStorage` is a first-paint cache, never proof of a session. There is **no client-side refresh flow** (renewal is transparent and server-side) and **no Google OAuth**.
- The `certificateSlise.js` filename contains a typo (`Slise` vs `Slice`) but is currently wired and working.
- `src/features/posts/postApi.js` exists but is currently empty (posts are handled via the generic admin content API).
- `src/app/redux/rootReducer.js` is stale (imports files that do not exist) and is **not** used by the active store (`src/app/redux/store.js`).
- `src/features/users/userSlice.js`, `src/features/members/memberSlice.js`, and `src/features/posts/postSlice.js` exist but are **not registered** in the active store.
- Admin image uploads go through Cloudinary via `POST /api/v1/admin/uploads/image`.
- Certificate verification attempts are logged server-side to `CertificateVerificationLog` for analytics.
- Security headers are applied via `src/proxy.ts` (Next.js 16 proxy). API responses additionally get `Cache-Control: no-store` and `X-Content-Type-Options: nosniff` from the route-handler wrapper.
- `src/components/Layout/Profile1.jsx` and the legacy `PROFILE` components it imports (`ProfileCard`, `ProfileDetails`, `ProfileID`, `ProfileBlog`, `Profile_Blog_Modal`) are **unused** — the active profile is `src/components/Layout/Profile.jsx`. `src/components/ADMIN/AdminPanel.jsx` is also unused (the dashboard is `src/components/dashboard-content.jsx`).
- The visitor counter and bootcamp leaderboard use direct `fetch` calls to the same relative `/api/v1` path instead of RTK Query. Certificate page metadata no longer makes an HTTP request at all — it reads MongoDB through a server-side service.
- The API is **auth-by-default**: a route under `src/app/api/**` is authenticated unless it declares `public: true`. Nothing in the admin surface is public.
- **Hosting constraint:** every IP-keyed rate limiter trusts headers the Vercel edge overwrites. Deploying this app anywhere other than Vercel makes all of them forgeable — see [DEVELOPMENT_ONBOARDING](./DOCUMENTATION/DEVELOPER_ONBOARDING.md) §7 and [BACKEND_MIGRATION.md](./DOCUMENTATION/BACKEND_MIGRATION.md) §8.
- `cpccu-server` (the retired Express backend, a separate repository) is a **read-only historical reference**. Nothing here depends on it at build time or runtime.

## 📄 License

This project is licensed under the ISC License.

---
Collaborated & Developed with ❤️ by the [**Open Source Software Community City University**](https://ossccu.pro.bd/)
