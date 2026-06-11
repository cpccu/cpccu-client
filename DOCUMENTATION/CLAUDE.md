# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**CPCCU** — Competitive Programming Camp City University portal. A Next.js 15 client-side rendered web app with Tailwind CSS 4, deployed on Render.

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

- **Next.js 15** (App Router) with `src` directory
- **React 19**, **Tailwind CSS 4**
- **Redux Toolkit + RTK Query** for state management and API layer
- **Radix UI** unstyled primitives
- **Framer Motion** for animations

### Directory Structure

```
src/
  app/                  # Next.js App Router pages
    (main)/             # Main site pages with shared layout (Header + NavBar + Footer)
    login/, signup/     # Auth pages
    redux/              # Redux store, rootReducer, ProviderWrapper
  features/             # Feature modules (auth, certificate, members, posts, users)
    Each has:  <name>Api.js (RTK Query endpoints), <name>Slice.js (Redux slice)
  components/
    Global/             # Shared UI: Header, NavBar, Footer, GoToTop, Pagination, SideProfile
    Layout/             # Page-level layout components (Home, Blog, Contact, Event, Gallery, Profile, etc.)
    [Domain folders]    # ABOUT, BLOG, CONTACT, EVENT, GALLERY, HOME, PROFILE, etc. — feature-specific components
  Context/              # React context for scroll-based sections (BlogScroll, ContactScroll, EventScroll, etc.)
  services/             # baseApi.js — single RTK Query base API (all features inject into it)
  hooks/                # use-mobile.js, use-toast.js
  lib/                  # cn.js (tailwind-merge utility)
data/                   # Static JSON data files (Committee, Alumni, Donators, BlogPost, Gallery, etc.)
```

### Routing & Layout

- Root layout (`src/app/layout.jsx`) wraps everything in Redux Provider + AuthHydrator
- `(main)` route group uses its own layout with Header → NavBar → Footer → GoToTop chrome
- Static JSON data in `data/` is imported directly into components

### State Management

- **Single base API**: `src/services/baseApi.js` — the single RTK Query baseApi with tag types `['Auth', 'Users', 'Posts']`. Feature API files (e.g., `features/auth/authApi.js`) extend this by injecting endpoints via `baseApi.injectEndpoints()`
- **Redux slices** live alongside their APIs in `features/<name>/`
- Currently active slices in store: `api`, `auth`, `certificate`. `members` and `users` exist in `features/` but their slices are not registered in the store yet
- **Auth hydration**: `ProviderWrapper` reads `user` and `token` from localStorage on mount and dispatches `setCredentials`
- API base URL: `NEXT_PUBLIC_API_BASE_URL` env var, defaults to `http://localhost:5000/api/v1`

### Key Patterns

- Components import static JSON directly (e.g., `import data from "@/data/Committee.json"`)
- Tailwind uses `@/lib/cn` utility for class merging
- Font Awesome + Lucide React for icons
- API calls go through RTK Query, not fetch/axios directly
- `scripts/update_contributors.py` auto-updates contributors on commits