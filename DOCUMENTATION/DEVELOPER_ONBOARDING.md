# Developer Onboarding

*"I just joined the CPCCU development team. What do I do?"*

This guide gets you from zero to running the CPCCU frontend locally and understanding where everything lives. Read it top to bottom once — then use [ARCHITECTURE.md](./ARCHITECTURE.md) and the [Documentation Index](./README.md) as references.

---

## 1. Project overview

**CPCCU** (Competitive Programming Camp City University) is the official web portal of the CPCCU club at City University. The platform has:

- A **public site** (homepage, members, profiles, certificates, events, gallery, contributors, job pipeline, bootcamp leaderboard, …)
- An **admin panel** (`/admin`) with role-based access for club officers
- A **backend API** (`cpccu-server`) that owns all data and authentication

Live site: https://cpccu.club/

## 2. Repository overview

CPCCU is split into two repositories:

| Repo | Role | Host |
| :--- | :--- | :--- |
| `cpccu/cpccu-client` (**this repo**) | Next.js frontend — UI, routing, state | Vercel |
| `cpccu/cpccu-server` | Express + MongoDB backend — API, auth, email, uploads | Render |

The frontend talks to the backend over HTTP using `NEXT_PUBLIC_API_BASE_URL` (default `http://localhost:5000/api/v1`).

## 3. Prerequisites

- **Node.js v20.9+** (required by Next.js 16)
- **npm** (or [Bun](https://bun.sh/))
- The **backend** running locally (or a deployed instance) — the frontend needs it for most features. See the backend [SETUP](https://github.com/cpccu/cpccu-server/blob/dev/docs/SETUP.md).
- A GitHub account (for contributing)

## 4. Clone & setup

```bash
git clone https://github.com/cpccu/cpccu-client.git
cd cpccu-client
npm install        # or: bun install
```

## 5. Environment variables

Create `.env` in the project root (copy of `.env.sample`):

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:5000/api/v1
```

That is the **only** variable this repository needs. All other configuration (MongoDB, Resend, Cloudinary, Firebase, GitHub token) belongs to `cpccu-server`. The full cross-repo list is in the backend's [ENVIRONMENT.md](https://github.com/cpccu/cpccu-server/blob/dev/docs/ENVIRONMENT.md).

> ⚠️ `NEXT_PUBLIC_*` values are inlined at build time — changing them requires restarting `npm run dev` (and a redeploy in production).

## 6. Run the frontend

```bash
npm run dev        # http://localhost:3000
```

Other scripts:

```bash
npm run build      # production build
npm run start      # serve the production build
npm run lint       # ⚠️ currently broken (next lint removed in Next.js 16) — see §13
```

## 7. Run the backend (required for full functionality)

Follow the backend [SETUP](https://github.com/cpccu/cpccu-server/blob/dev/docs/SETUP.md):

```bash
git clone https://github.com/cpccu/cpccu-server.git
cd cpccu-server
npm install
cp .env.sample .env   # fill in MONGODB_URI, Cloudinary, Firebase, JWT secrets, ...
npm run dev            # http://localhost:3000 by default
```

> ℹ️ **Port note:** the backend listens on `PORT` (default `3000`), but the frontend's default `NEXT_PUBLIC_API_BASE_URL` points at port `5000`. For the defaults to line up, set `PORT=5000` in `cpccu-server/.env` (or change the frontend variable).

The backend refuses to start without Cloudinary + Firebase credentials and needs a MongoDB instance.

## 8. Connect frontend ↔ backend

- Keep `NEXT_PUBLIC_API_BASE_URL` pointing at the backend (`http://localhost:5000/api/v1` locally — match it to whatever `PORT` the backend is actually running on).
- The backend's CORS allow-list already includes `http://localhost:3000`.
- Authentication cookies require HTTPS + `credentials: 'include'` (already set in `src/services/baseApi.js`); locally, the access token in `localStorage` is what actually drives sessions.

## 9. Database requirements

- MongoDB (local or Atlas) — required by the backend.
- Seeding optional content: from `cpccu-server`, run `npm run data:seed` (requires a sibling `cpccu-client/data` checkout). Collections start empty otherwise, and most public pages fall back to the JSON files in `data/`.

## 10. External services

| Service | Used for | Owned by |
| :--- | :--- | :--- |
| Resend | OTP / reset / welcome emails | backend |
| Cloudinary | Image uploads | backend |
| Firebase Admin | Google OAuth endpoints (not used by the frontend UI) | backend |
| GitHub API | Contributor sync (Actions + admin write-back) | both |
| Google Sheets | Bootcamp leaderboard | backend |

You can develop the frontend without any of these if the backend is up — features that depend on them simply show fallback data or errors.

## 11. Authentication testing

To test the full auth lifecycle:

1. **Register** at `/signup` — the backend emails a 6-digit OTP (check the backend logs/console or your mailbox; locally you can read the email HTML from the Resend call).
2. **Verify** in the popup → account becomes `isValid: true`, welcome email fires.
3. **Login** at `/login`.
4. Try logging in **before** verifying → expect the backend's `403 EMAIL_NOT_VERIFIED` and the OTP popup reopening. This is the backend-enforced verification flow — don't "fix" it client-side.

Useful URLs: `/login`, `/signup`, `/reset-password/[code]/[token]`, `/profile/[uniID]`, `/admin` (admin/moderator/mentor roles only).

## 12. Useful routes

| Route | What it is |
| :--- | :--- |
| `/` | Homepage |
| `/member` | Public member directory |
| `/profile/[id]` | Public profile (also `/users/profile/[id]`) |
| `/certificate`, `/certificate/[certificateId]` | Certificate verification portal |
| `/contributors` | Contributors page |
| `/job-pipeline` | Approved developer profiles |
| `/event`, `/gallery`, `/committee`, `/alumni`, `/blog`, `/contact`, `/history`, `/bootcamp-leaderboard` | Content pages |
| `/admin/*` | Admin panel |

## 13. Testing

**There are no frontend automated tests.** The verification steps are:

```bash
npm run build   # production build — the main check
```

> ⚠️ `npm run lint` (Next.js ESLint) is currently **broken**: `next lint` was removed in Next.js 16 and ESLint 10 requires a flat config that this repo does not provide. Don't rely on it until the toolchain is updated.

The **backend** has a real `node:test` suite (`npm test` in `cpccu-server`) — see its [TESTING.md](https://github.com/cpccu/cpccu-server/blob/dev/docs/TESTING.md). Run it when you change API contracts.

## 14. Build

```bash
npm run build && npm run start
```

`next.config.mjs` keeps `output: "export"` commented out — the app deploys as a standard Next.js server build on Vercel.

## 15. Debugging

- **Network tab**: all API traffic goes to `NEXT_PUBLIC_API_BASE_URL` with `Authorization: Bearer <token>`.
- **Redux DevTools**: RTK Query cache + auth state under `state.api` / `state.auth`.
- **Backend logs**: LogSphere dashboard at `http://localhost:<PORT>/logs` (3000 by default — use whatever port the backend runs on).
- If pages show fallback JSON instead of live data, the corresponding backend collection is empty or the API call failed (check the Network tab).

## 16. Deployment basics

- Frontend → **Vercel** (production https://cpccu.club/), backend → **Render**. See [DEPLOYMENT.md](./DEPLOYMENT.md).
- `NEXT_PUBLIC_API_BASE_URL` on Vercel must point at the deployed backend (`https://<render-service>.onrender.com/api/v1`).
- The contributor GitHub Action runs on the `release` branch — don't expect contributor changes from a `dev`-only PR.

## 17. Contribution workflow

1. Branch from `dev`: `git checkout -b feat-{name}` (or `fix-`, `refactor-`, `chore-`).
2. Make your change; run `npm run build` to verify it compiles (frontend lint is currently broken — see §13).
3. Push and open a PR to `dev` with a clear description.
4. If your change alters API usage, env vars, or architecture, update the relevant docs (see [CONTRIBUTION.md](./CONTRIBUTION.md)).

## 18. Code organization (where do I go for X?)

| I want to change… | Look here |
| :--- | :--- |
| Login / signup / OTP | `src/app/login`, `src/app/signup`, `src/components/LOGINSIGNUP/`, `src/components/ALERT/OtpVerifyPopup.js` |
| Auth state / session hydration | `src/features/auth/`, `src/app/redux/` |
| API endpoints the app calls | `src/features/*/*Api.js`, `src/services/baseApi.js` |
| Profile page | `src/app/(main)/profile/[id]`, `src/components/Layout/Profile.jsx`, `src/components/PROFILE/` |
| Certificate verification | `src/app/(main)/certificate/`, `src/features/certificate/`, `src/components/CERTIFICATE/`, `src/lib/certificates/` |
| Admin panel | `src/app/admin/`, `src/components/admin-layout.jsx`, `src/components/admin-sidebar.jsx`, `src/components/*-content.jsx`, `src/features/admin/adminApi.js` |
| Contributors (GitHub-synced) | `src/components/contributors-content.jsx`, `src/features/admin/adminApi.js`, `data/contributors.json`, `scripts/update_contributors.py`, `.github/workflows/update-contributors.yml` |
| Static/fallback content | `data/*.json` |
| Security headers | `src/proxy.ts` |
| Shared UI | `src/components/ui/` (Radix/shadcn-style) |

## 19. Common mistakes

- **Forgot `.env`** → API calls fall back to `http://localhost:5000/api/v1`; if your backend runs on another port, set `NEXT_PUBLIC_API_BASE_URL`.
- **Backend not running** → every API-backed page shows fallback data or errors. Start `cpccu-server`.
- **Changed `NEXT_PUBLIC_*` but dev server didn't reload** → restart `npm run dev`.
- **Logging in before verifying email** → you get `EMAIL_NOT_VERIFIED`; verify via the popup first.
- **Editing contributors** → only `batch`/`linkedin` are editable; the backend needs `CONTRIBUTOR_GITHUB_TOKEN`.
- **Contributor data not updating** → the workflow only runs on the `release` branch (daily + manual dispatch).
- **Unused files are real** — `rootReducer.js`, `userSlice.js`, `memberSlice.js`, `postSlice.js`, `postApi.js`, `Profile1.jsx`, legacy `PROFILE` components, `AdminPanel.jsx`, and the dead `createUser`/`deleteUser`/`fetchMemberById` endpoints are leftovers; don't rely on them (see [ARCHITECTURE.md](./ARCHITECTURE.md#18-current-notes-and-inconsistencies)).

## 20. Next steps

1. Read [ARCHITECTURE.md](./ARCHITECTURE.md) — the detailed map.
2. Read the backend [ARCHITECTURE](https://github.com/cpccu/cpccu-server/blob/dev/docs/ARCHITECTURE.md) so you understand the API side.
3. Pick a small issue, branch from `dev`, and open a PR.