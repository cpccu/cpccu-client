# Deployment Guide

This document describes how the CPCCU platform is deployed in production.

| App | Repository | Host | Production URL |
| --- | --- | --- | --- |
| Frontend | `cpccu/cpccu-client` | **Vercel** | https://cpccu.club/ |
| Backend | `cpccu/cpccu-server` | **Render** | e.g. `https://cpccu-server.onrender.com` |

---

## 1. Frontend — Vercel

The Next.js frontend is deployed on Vercel with automatic deployments from the git provider (push to `main`/`release` triggers production).

### 1.1 Project Configuration

| Setting | Value |
| --- | --- |
| Framework Preset | Next.js (auto-detected from `package.json`) |
| Build Command | `npm run build` (or `bun run build`) |
| Output Directory | `.next` (default; `output: "export"` is commented out in `next.config.mjs`) |
| Install Command | `npm install` (or `bun install`) |
| Node Version | 20.9+ (Next.js 16 `engines` requirement) |

`next.config.mjs` sets `reactStrictMode: true` and allows image optimization for any remote hostname (Cloudinary, ui-avatars, etc.) via `images.remotePatterns`.

### 1.2 Environment Variables (Vercel)

Set these in the Vercel project dashboard (**Settings → Environment Variables**):

| Variable | Required | Value (production) | Purpose |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | ✅ | `https://cpccu-server.onrender.com/api/v1` | Base URL of the backend API. Must be publicly reachable. |

> ⚠️ `NEXT_PUBLIC_*` variables are inlined at build time on Vercel — a redeploy is required after changing them. Do **not** prefix backend-only secrets with `NEXT_PUBLIC_`.

### 1.3 Security Headers

- `src/proxy.ts` (Next.js 16 proxy) applies CSP (production only), `X-Frame-Options: DENY`, HSTS, `Referrer-Policy`, `Permissions-Policy`, and COOP/COEP/CORP headers on every route except `_next/static` and `_next/image`.
- HSTS is applied automatically because the Vercel hostname is not `localhost`.
- CORS for the deployed site is configured on the **backend** (Render) to allow `https://cpccu.club`.

### 1.4 Redirects

- `public/_redirects` exists for static-hosting redirects; on Vercel, use the `vercel.json`/framework redirects instead.
- Legacy certificate route: `/verify/[certificateId]` redirects to `/certificate/[certificateId]` (handled in the app router, no config needed).

### 1.5 Legacy Files (can be ignored on Vercel)

- `render.yaml` / `_render.yaml` — leftover Render config from the previous frontend hosting. If the frontend ever returns to Render, the `render.yaml` `web` service uses `bun install; bun run build` and `bun run start`.
- `.htaccess` — Apache rewrite rules from the even older static/`out` deployment; unused by Vercel and Render.
- `public/_redirects` — Netlify-style redirects; unused by Vercel.

---

## 2. Backend — Render

The backend (`cpccu-server`) is a separate repository deployed on Render as a web service.

### 2.1 Reference Configuration (from `render.yaml`)

```yaml
services:
  - type: web
    name: cpccu-server
    runtime: node
    buildCommand: <backend build command>
    startCommand: <backend start command>
```

### 2.2 Backend Environment Variables (server-side only)

Variables the frontend references indirectly or that the backend needs:

| Variable | Purpose |
| --- | --- |
| `NODE_ENV` | `production` |
| `MONGODB_URI` | MongoDB connection string (used by the seed/migration scripts) |
| `GOOGLE_SHEETS_API_KEY` | Google Sheets API key used by the bootcamp leaderboard data source |
| `BOOTCAMP_SHEET_ID` | Google Sheets ID for the bootcamp leaderboard |

> `GOOGLE_SHEETS_API_KEY` and `BOOTCAMP_SHEET_ID` are **backend-only**; the frontend leaderboard page shows a hint to add them when the leaderboard API errors.

### 2.3 CORS

The backend must allow:

- `Origin`: `https://cpccu.club` (and `http://localhost:3000` in development)
- `Credentials`: cookies/session headers as needed

---

## 3. Development / Local Setup

1. Clone the frontend repo and install dependencies (`npm install` or `bun install`).
2. Create `.env`:
   ```env
   NEXT_PUBLIC_API_BASE_URL=http://localhost:5000/api/v1
   ```
3. Run the backend locally on port 5000 (or point `NEXT_PUBLIC_API_BASE_URL` at a deployed instance).
4. Start the frontend: `npm run dev`.

---

## 4. Production URLs

| Purpose | URL |
| --- | --- |
| Production site | https://cpccu.club/ |
| Frontend metadata base | https://www.cpccu.club (set in `src/app/layout.jsx`) |
| Backend API (reference) | `https://cpccu-server.onrender.com/api/v1` |
