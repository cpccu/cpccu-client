# CPCCU - Competitive Programming Camp City University

The official web portal for the Competitive Programming Camp at City University. This platform supports community engagement, member management, public content publishing, certificate verification, a full-featured admin panel, public member profiles, a developer job pipeline, and dynamic role management.

- **Live site**: https://cpccu.club/
- **Frontend deployment**: Vercel
- **Backend deployment**: Render (`cpccu-server`)

---

## 🚀 Features

### Public Site

- **Homepage**: Hero section, visitor counter, mission & responsibility, upcoming events, gallery preview, contributors carousel, donators carousel, statistics counters.
- **Member Management**: Public member directory (`/member`) with profiles, skill tracking, academic details, and admin-managed member records.
- **Authentication**: Login, registration with email OTP verification, password reset, and persistent session hydration.
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
- **Content Management**: Generic CRUD for committees, contributors, donators, events, gallery, messages, posts, alumni, and profiles.
- **Alumni Management**: Alumni profile CRUD with fallback to static JSON.
- **Event Management**: Event creation with date phases (remaining, running, ended), reward rules, and button links.
- **Gallery Management**: Image upload and gallery organization, including gallery-event groupings.
- **Certificates**: Certificate issue, bulk issue, update, delete, and public verification.
- **Statistics**: Editable public statistics displayed on the site.
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
| Security | `src/proxy.ts` (Next.js 16 proxy/middleware) on the frontend; helmet on the backend |
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
│   ├── proxy.ts             # Next.js 16 proxy (security headers middleware)
│   └── services/            # baseApi.js — RTK Query base API
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
    Create a `.env` file in the root directory (see `.env.sample`):
    ```env
    NEXT_PUBLIC_API_BASE_URL=http://localhost:5000/api/v1
    ```

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
- **Linting**:
    ```bash
    npm run lint
    ```

## 🔐 Environment Variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | Yes (prod) | Base URL of the CPCCU backend API. Defaults to `http://localhost:5000/api/v1`. |

> The bootcamp leaderboard page reads `GOOGLE_SHEETS_API_KEY` and `BOOTCAMP_SHEET_ID`, but these are **backend** (`cpccu-server`) environment variables — the frontend only needs `NEXT_PUBLIC_API_BASE_URL`.

See [DEPLOYMENT.md](./DOCUMENTATION/DEPLOYMENT.md) for full production environment configuration.

## 📖 Documentation

- [Architecture Overview](./DOCUMENTATION/ARCHITECTURE.md) — Deep dive into folder structure, routing, state management, data flow, and all major systems (Profile, Certificate, Job Pipeline, Roles, Projects, Contributors).
- [Architecture Decision Records](./DOCUMENTATION/ADR.md) — Why the project is built this way (deployment, certificates, roles, profile, job pipeline, auth, and planned decisions).
- [API Documentation](./DOCUMENTATION/API_DOCUMENTATION.md) — List of integrated endpoints and request contracts.
- [Admin Panel Implementation](./DOCUMENTATION/CPCCU_Admin_Panel_Implementation_Documentation.md) — Admin roles, data flow, content management, and migration notes.
- [Deployment Guide](./DOCUMENTATION/DEPLOYMENT.md) — Vercel (frontend) and Render (backend) deployment.
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

- The app uses a shared public layout (`src/app/(main)/layout.jsx`) for main site pages (Header, NavBar, Footer, GoToTop) and a separate admin area under `/admin` with its own client-side access guard.
- API requests are driven through RTK Query with a shared `baseApi` and a separate unauthenticated `publicApi` for public certificate verification.
- Public content is split between static JSON data in `data/` and API-backed managed content. Admin-managed content falls back to JSON when the database is empty.
- **Authentication**: the access token is stored in `localStorage` (`token`) and sent as a `Bearer` token via RTK Query headers (`credentials: 'include'` is also set for cookie-based flows). There is **no refresh-token or Google OAuth flow implemented on the frontend** — if the stored token becomes invalid, the session is cleared on the next `getCurrentUser` call.
- The `certificateSlise.js` filename contains a typo (`Slise` vs `Slice`) but is currently wired and working.
- `src/features/posts/postApi.js` exists but is currently empty (posts are handled via the generic admin content API).
- `src/app/redux/rootReducer.js` is stale (imports files that do not exist) and is **not** used by the active store (`src/app/redux/store.js`).
- `src/features/users/userSlice.js`, `src/features/members/memberSlice.js`, and `src/features/posts/postSlice.js` exist but are **not registered** in the active store.
- Admin image uploads go through Cloudinary via `POST /api/v1/admin/uploads/image`.
- Certificate verification attempts are logged server-side to `CertificateVerificationLog` for analytics.
- Security headers are applied via `src/proxy.ts` (Next.js 16 proxy) on the frontend and `helmet` middleware on the backend.
- `src/components/Layout/Profile1.jsx` and the legacy `PROFILE` components it imports (`ProfileCard`, `ProfileDetails`, `ProfileID`, `ProfileBlog`, `Profile_Blog_Modal`) are **unused** — the active profile is `src/components/Layout/Profile.jsx`. `src/components/ADMIN/AdminPanel.jsx` is also unused (the dashboard is `src/components/dashboard-content.jsx`).
- The visitor counter and bootcamp leaderboard use direct `fetch` calls instead of RTK Query.

## 📄 License

This project is licensed under the ISC License.

---
Collaborated & Developed with ❤️ by the [**Open Source Software Community City University**](https://ossccu.pro.bd/)
