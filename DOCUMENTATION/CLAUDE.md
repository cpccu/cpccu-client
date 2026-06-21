# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**CPCCU** — Competitive Programming Camp City University portal. A Next.js 16 client-side rendered web app with Tailwind CSS 4, deployed on Render.

- **Live site**: https://cpccu.club/
- **Current branch**: `dev` (all feature branches should branch from `dev`)

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
- **Radix UI** unstyled primitives
- **Framer Motion** for animations
- **Zod** for validation
- **Sonner** + **SweetAlert2** for notifications
- **Recharts** for admin dashboard charts
- **Embla Carousel** for homepage carousels
- **date-fns** + **React Day Picker** for dates
- **upload-js** for Cloudinary image uploads

### Directory Structure

```
src/
  app/                  # Next.js App Router pages
    (main)/             # Main site pages with shared layout (Header + NavBar + Footer + GoToTop)
    login/, signup/     # Auth pages
    admin/              # Admin panel routes
    redux/              # Redux store, ProviderWrapper, rootReducer
    not-found.jsx       # 404 page
    ScrollToTop.jsx     # Global scroll-to-top behavior
  components/
    Global/             # Shared UI: Header, NavBar, Footer, GoToTop, Pagination, SideProfile
    Layout/             # Page-level layout components (Home, Blog, Contact, Event, Gallery, Profile, JobPipeline, AboutLayout)
    [Domain folders]    # ABOUT, BLOG, CONTACT, EVENT, GALLERY, HOME, PROFILE, ADMIN, CERTIFICATE, LOGINSIGNUP, ALERT, etc.
    CERTIFICATE/ui/     # shadcn/ui-style components (accordion, alert, avatar, badge, button, card, carousel, chart, checkbox, dialog, dropdown, form, input, select, table, tabs, toast, tooltip, etc.)
    admin-*.jsx         # Admin-specific components (admin-layout, admin-sidebar, admin-data-table, admin-image-upload-field, etc.)
  Context/              # React contexts for scroll-based sections: BlogScroll, ContactScroll, EventScroll, GalleryScroll, OurMessionScroll
  features/             # Feature modules (auth, certificate, members, posts, users, content, contact, admin)
    Each has: <name>Api.js (RTK Query endpoints), <name>Slice.js (Redux slice)
  hooks/                # Reusable hooks: use-admin-content.js, use-mobile.js, use-toast.js
  services/             # baseApi.js — single RTK Query base API (all features inject into it)
  lib/                  # cn.js (tailwind-merge utility)
data/                   # Static JSON data files (Committee, Alumni, Donators, BlogPost, Gallery, etc.)
scripts/                # Utility scripts (update_contributors.py)
```

### Routing & Layout

- Root layout (`src/app/layout.jsx`) wraps everything in Redux Provider + AuthHydrator
- `(main)` route group uses its own layout with Header → NavBar → Footer → GoToTop chrome
- `not-found.jsx` for 404 handling
- `ScrollToTop.jsx` for global scroll-to-top button
- Static JSON data in `data/` is imported directly into components as fallback
- Admin routes under `src/app/admin/` with separate `admin/layout.jsx`

### State Management

- **Single base API**: `src/services/baseApi.js` — the single RTK Query baseApi with tag types `['Auth', 'Users', 'Posts', 'PublicContent', 'AdminOverview', 'AdminMembers', 'AdminContent', 'AdminStatistics', 'AdminCertificates', 'AdminSystemSettings']`. Feature API files (e.g., `features/auth/authApi.js`) extend this by injecting endpoints via `baseApi.injectEndpoints()`
- **Redux slices** live alongside their APIs in `features/<name>/`
- Currently active slices in store: `api`, `auth`, `certificate`. `members` and `users` exist in `features/` but their slices are not registered in the store yet
- **Auth hydration**: `ProviderWrapper` reads `token` from localStorage on mount, calls `useGetCurrentUserQuery` if token exists, and dispatches `setCredentials` or `clearCredentials` accordingly, then `setHydrated`
- API base URL: `NEXT_PUBLIC_API_BASE_URL` env var, defaults to `http://localhost:5000/api/v1`
- **Public certificate API** (`publicApi`): separate `createApi` instance at base URL without `/api/v1` suffix, for unauthenticated `/verify/:certificateId`

### Key Patterns

- Components import static JSON directly (e.g., `import data from "@/data/Committee.json"`)
- Tailwind uses `@/lib/cn` utility for class merging
- Font Awesome + Lucide React for icons
- API calls go through RTK Query, not fetch/axios directly (except visitor counter and bootcamp leaderboard)
- `scripts/update_contributors.py` auto-updates contributors on commits
- Admin content uses generic CRUD endpoints: `GET/POST /admin/content/:resource`, `PATCH/DELETE /admin/content/:resource/:id`
- Admin image uploads go to Cloudinary via `POST /admin/uploads/image` using `uploadAdminImage` mutation
- `useAdminContent(resource, fallback)` hook manages local state for admin content tables with fallback JSON data
- `useToast()` / `toast()` provide global toast notifications (limit 1)
- `useIsMobile()` provides mobile breakpoint detection (768px)

### Admin Roles

Three-tier role system on the backend:
- **Admin**: Full access to all modules and write actions
- **Moderator**: Dashboard, Posts, Events, Gallery, Statistics, Account Settings (content-focused)
- **Mentor**: Dashboard, Members, Certificates, Statistics, Account Settings (read-oriented)

### Known File Inconsistencies

- `src/features/certificate/certificateSlise.js` — typo in filename (should be `certificateSlice.js`), but wired correctly
- `src/features/posts/postApi.js` — currently empty; posts handled via generic admin content API
- `src/app/redux/rootReducer.js` — stale, not used by active store
- `src/features/users/userSlice.js` and `src/features/members/memberSlice.js` — not registered in store
