# CPCCU Frontend Architecture Documentation

This document summarizes the current architecture of the cpccu-client repository.

## 1. Technology Stack

The versions below are based on the current package configuration.

* **Framework**: Next.js 16 (App Router)
* **Runtime UI**: React 19
* **Language**: JavaScript (ES modules, JSX)
* **State Management**: Redux Toolkit
* **Server State / Data Fetching**: RTK Query
* **Styling**: Tailwind CSS 4, Tailwind CSS Animate, Tailwind Merge
* **UI Component System**: Radix UI primitives + `class-variance-authority` for component variants
* **Animation**: Framer Motion
* **Icons**: Font Awesome, Lucide React, React Icons
* **Validation**: Zod, Zod Validation Error
* **Date Handling**: date-fns, React Day Picker
* **Charts**: Recharts
* **Carousels**: Embla Carousel React
* **Notifications**: Sonner, SweetAlert2
* **Command Palette**: cmdk
* **OTP Input**: input-otp
* **Upload**: upload-js (Cloudinary)
* **Scroll**: react-scroll, react-scroll-trigger
* **Panels**: react-resizable-panels
* **Counters**: react-countup

## 2. Repository Layout

Top-level layout (simplified):

```
data/              Static JSON content sources (fallback data)
DOCUMENTATION/     Project docs
public/            Static assets
scripts/           Utility scripts (e.g., update_contributors.py)
src/
  app/             Next.js App Router pages/layouts
  components/      Feature and shared UI components
  Context/         Scroll-based section contexts (Blog, Contact, Event, Gallery, OurMission)
  features/        Redux slices and RTK Query endpoint modules
  hooks/           Reusable hooks (use-admin-content, use-mobile, use-toast)
  lib/             Utilities (cn.js — tailwind-merge helper)
  services/        RTK Query base API setup
```

## 3. Routing Architecture (App Router)

### 3.1 Root Shell

* Root layout in `src/app/layout.jsx` wraps the app with the Redux Provider wrapper and global styles from `src/app/globals.css`.
* `src/app/ScrollToTop.jsx` provides global scroll-to-top behavior.
* `src/app/not-found.jsx` renders the custom 404 page.

### 3.2 Main Public Route Group

* Route group: `src/app/(main)/`
* Shared shell for public pages in `src/app/(main)/layout.jsx`:
    * Header
    * NavBar
    * Footer
    * GoToTop
    * ScrollToTop behavior
* Current pages include:
    * home, blog, event, gallery, committee, alumni, contributors, donators
    * member, history, certificate, contact, job-pipeline
    * bootcamp-leaderboard
    * dynamic profile routes: `profile/[id]`, `users/profile/[id]`

### 3.3 Auth and Utility Routes

Outside the main group, the app includes:

* `login` — Login page
* `signup` — Registration page with OTP verification
* `reset-password/[code]/[token]` — Password reset page
* `verify/[certificateId]` — Public certificate verification page
* `not-found` — 404 error page

### 3.4 Admin Routes

* Admin area under `src/app/admin/`
* Separate admin layout at `src/app/admin/layout.jsx`
* Admin sections include:
    * dashboard (`/admin`)
    * members (`/admin/members`)
    * posts (`/admin/posts`)
    * messages (`/admin/messages`)
    * events (`/admin/events`)
    * gallery (`/admin/gallery`)
    * jobs (`/admin/jobs`)
    * alumni (`/admin/alumni`)
    * contributors (`/admin/contributors`)
    * donators (`/admin/donators`)
    * committees (`/admin/committees`)
    * certificates (`/admin/certificates`)
    * statistics (`/admin/statistics`)
    * audit-logs (`/admin/audit-logs`)
    * settings/account (`/admin/settings/account`)
    * settings/system (`/admin/settings/system`)

## 4. State Management and Data Flow

### 4.1 Active Store Configuration

The active store is configured in `src/app/redux/store.js`.

Registered reducers:

* `api`: RTK Query reducer from `baseApi`
* `publicApi`: RTK Query reducer for public certificate verification
* `auth`: auth slice
* `certificate`: certificate slice

Middleware:

* `baseApi.middleware`
* `publicApi.middleware`
* `serializableCheck` is disabled

### 4.2 Auth Hydration Flow

`ProviderWrapper` in `src/app/redux/ProviderWrapper.js` performs hydration on app load:

1. Wraps the app in Redux Provider.
2. `AuthHydrator` reads the token from `localStorage`.
3. If a token exists, it calls `useGetCurrentUserQuery` to validate the session.
4. On success, dispatches `setCredentials` with user and token.
5. On failure (invalid/expired token), dispatches `clearCredentials` and removes localStorage items.
6. Dispatches `setHydrated` in all cases to unblock auth-aware UI.

### 4.3 Slice Responsibilities

* **auth slice** (`src/features/auth/authSlice.js`):
    * Fields: `user`, `token`, `hydrated`, `loading`, `error`
    * Actions: `setCredentials`, `clearCredentials`, `setHydrated`
    * Persistence helpers for `localStorage`
* **certificate slice** (`src/features/certificate/certificateSlise.js`):
    * Certificate search form state (`searchData`)
    * Certificate verification result state (`result`)
    * Actions: `setSearchData`, `setCertificateResult`, `clearCertificateResult`
* **users slice** (`src/features/users/userSlice.js`):
    * Exists but is **not registered in the active store**.
* **members slice** (`src/features/members/memberSlice.js`):
    * Exists but is **not registered in the active store**.
* **posts slice** (`src/features/posts/postSlice.js`):
    * Exists but is **not registered in the active store** (and `postApi.js` is empty).

## 5. API Layer Design

### 5.1 Base API

`baseApi` in `src/services/baseApi.js` defines:

* Base URL from `NEXT_PUBLIC_API_BASE_URL` (fallback `http://localhost:5000/api/v1`)
* `credentials: include` for cookies
* Automatic Bearer token injection from Redux auth state
* JSON content-type by default, except multipart upload endpoints (`userImageUpload`, `uploadAdminImage`)
* Centralized tag types for cache invalidation:
    * `Auth`, `Users`, `Posts`, `PublicContent`
    * `AdminOverview`, `AdminMembers`, `AdminContent`
    * `AdminStatistics`, `AdminCertificates`, `AdminSystemSettings`

### 5.2 Endpoint Injection Modules

Feature modules inject endpoints into `baseApi`:

* `authApi` — Authentication (login, register, OTP, logout, password reset, current user)
* `userApi` — User management (CRUD, image upload, job pipeline, password change, account deletion)
* `memberApi` — Public member directory
* `certificateApi` — Private certificate endpoints (search, stats, recent)
* `contentApi` — Public content and statistics
* `adminApi` — Admin dashboard, members, content, statistics, system settings, certificates, image uploads
* `contactApi` — Contact form submission

Additionally:

* `publicApi` (separate `createApi` instance) handles unauthenticated certificate verification route at `/verify/:certificateId`.

### 5.3 Non-RTK Fetch Calls

A small number of components use direct fetch:

* **Visitor counter** (`src/components/HOME/VisitorCounter.jsx`) — external hosted endpoint
* **Bootcamp leaderboard** (`src/components/BOOTCAMPLEADERBOARD/BootcampLeaderboard.jsx`) — direct API call

### 5.4 Hooks

* `useAdminContent(resource, fallback)` — Custom hook for admin generic content CRUD with local state management and fallback data.
* `useIsMobile()` — Mobile breakpoint detection (768px) using `matchMedia`.
* `useToast()` / `toast()` — Global toast notification system (limit 1, custom reducer-based state management).

## 6. UI Composition Patterns

* Feature-focused component folders under `src/components` (e.g., `BLOG`, `EVENT`, `GALLERY`, `PROFILE`, `HOME`, `ADMIN`, `CERTIFICATE`).
* Shared global components in `src/components/Global` (Header, NavBar, Footer, GoToTop, Pagination, SideProfile, UpComingEventCard).
* Shared layout wrappers in `src/components/Layout` (Home, Blog, Contact, Event, Gallery, Profile, JobPipeline, AboutLayout).
* Login/signup components in `src/components/LOGINSIGNUP`.
* Alert components in `src/components/ALERT` (ErrorAlert, SuccessAlert, OtpVerifyPopup).
* Admin-specific components at `src/components/` root level (admin-layout, admin-sidebar, admin-data-table, admin-image-upload-field, etc.).
* **Shadcn/ui-style components** in `src/components/CERTIFICATE/ui/` — built on Radix UI primitives with `class-variance-authority` and `tailwind-merge`. Includes: accordion, alert, alert-dialog, avatar, badge, breadcrumb, button, calendar, card, carousel, chart, checkbox, collapsible, command, context-menu, dialog, drawer, dropdown-menu, form, hover-card, input, input-otp, label, menubar, navigation-menu, pagination, popover, progress, radio-group, resizable, scroll-area, select, separator, sheet, skeleton, slider, sonner, switch, table, tabs, textarea, toast, toggle, toggle-group, tooltip, and more.
* Client-side interactive pages/components are widely used where stateful behavior is required.

## 7. Content Strategy

The frontend uses a hybrid content strategy:

* **Static JSON files** in `data/` for seeded and public content (fallback when database is empty).
* **API-driven content** through `contentApi` and `adminApi` for dynamic and managed content.
* Admin-managed content falls back to static JSON when the database collection is empty.
* Ordered public resources are sorted by `order` field to preserve page display order.

## 8. Context Providers

Scroll-based section contexts in `src/Context/`:

* `BlogScroll` — Blog page section navigation
* `ContactScroll` — Contact page section navigation
* `EventScroll` — Event page section navigation
* `GalleryScroll` — Gallery page section navigation
* `OurMessionScroll` — Home page mission section navigation

## 9. Current Notes and Inconsistencies

These are implementation details visible in the current repo:

* The certificate slice filename is `certificateSlise.js` (typo in filename, but currently wired and working).
* `src/features/posts/postApi.js` exists but is currently empty; posts are handled via the generic admin content API.
* `src/app/redux/rootReducer.js` appears stale and is **not** the reducer used by the active store configuration.
* `src/features/users/userSlice.js` and `src/features/members/memberSlice.js` exist but are **not registered** in the active store.
* Some endpoint URLs in `userApi.js` and `memberApi.js` omit the leading `/`, which is inconsistent with the rest of the codebase but still functional due to `fetchBaseQuery` path resolution.
