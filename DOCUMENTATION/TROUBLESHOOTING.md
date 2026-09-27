# Troubleshooting

Real problems you are likely to hit with the CPCCU platform, based on the actual architecture. Each entry states the symptom, the likely cause, and the fix.

> **The frontend and the API are the same application.** Pages are served from the Next.js app and the API is mounted at `/api/v1` inside it, reached same-origin. There is no separate backend to start, no second host, and no CORS to configure. Anything below that used to tell you to start a second process is history.

---

## 1. The frontend cannot reach the API

**Symptoms:** every API-backed page shows fallback data; the Network tab shows failed requests to `/api/v1/...`; the visitor counter stays 0.

**Causes & fixes:**

1. **The app isn't running** — start it with `npm run dev` (pages *and* API on `http://localhost:3000`). Verify with `curl http://localhost:3000/api/v1` — expect the plain-text heartbeat. If that fails, the route handlers did not build or serve; check the server console first.
2. **The base path was changed** — it is the hard-coded relative literal `/api/v1` in `src/services/baseApi.js`. There is no environment variable to fix, and a stale absolute origin cannot be reintroduced without failing `test/client-endpoint-parity.test.js`.
3. **Missing secrets → 500s, not 401s.** `MONGODB_URI`, `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET` and `PASSWORD_TOKEN_SECRET` are validated **lazily**, on first use, so a missing one builds green and fails at runtime. The 500's message names the missing variables — read it rather than assuming a code bug.
4. **No database** — `MONGODB_URI` pointing at a reachable but empty database is *not* an error; most public pages fall back to `data/*.json` and the site looks healthy. Confirm with `GET /api/v1/content/events` before concluding the API is broken.
5. **CORS is not a possible cause.** The browser never makes a cross-origin API request, so there is no allow-list to extend and no preflight to satisfy. If you are seeing a CORS error, you are pointed at some *other* host, which means the base path is wrong.

## 2. OTP email not arriving

**Causes & fixes:**

1. **`RESEND_API_KEY` missing/invalid** — check the server logs (`Failed to send registration OTP` / `Resend API error`). Resend rejects unverified sender domains; `noreply@cpccu.club` must be verified in the Resend account. The client is constructed lazily, so a missing key fails the first send rather than the build.
2. **Emails in spam** — check spam/junk; the sender is `CPCCU <noreply@cpccu.club>`.
3. **Wrong email case** — registration lowercases the email, but `send-otp` looks it up by the raw input. Submit the same casing you registered with (known debt, see [SECURITY.md](./SECURITY.md)).
4. **Rate limited** — `POST /auth/send-otp` allows 5 requests / 15 min per IP (`429`). Wait and retry. Note that the store behind that limiter is in-process, so on a multi-instance deployment the limit is enforced **intermittently** — see [BACKEND_MIGRATION.md](./BACKEND_MIGRATION.md) §8.

## 3. Verification popup issues

- **"Invalid OTP"** — OTPs are exactly 6 numeric digits and expire after 2 minutes; use the latest email. The popup's 6 boxes accept letters too, but the backend only generates digits.
- **"OTP has expired" (`419`)** — request a resend (button appears after the 60s countdown).
- **Popup won't open after signup** — signup triggers the popup via `OtpVerifyPopup` in `src/components/LOGINSIGNUP/Signup.jsx`. If you closed it, resend from the login screen: attempt login with the unverified account → the backend returns `403 EMAIL_NOT_VERIFIED` → `Login.jsx` reopens the popup automatically.

## 4. Login fails with "Please verify your email to continue"

This is **by design** — the server enforces email verification (`403` + code `EMAIL_NOT_VERIFIED`) and issues no session for unverified accounts. Complete the OTP verification (popup should open automatically), then log in again. This is the current security contract — do not weaken it client-side.

## 5. Session issues

The session is the **`httpOnly` cookie**. The client holds no token, so most "my token expired" reasoning from before the cutover does not apply.

- **"Session expired" / redirected to login after a refresh** — the cookie is gone or expired. `ProviderWrapper` calls `GET /api/v1/users/user` on every page load; a 401 there dispatches `clearCredentials` and that is what "logged out" means. **This is the request to debug** — a failing auth check *is* `GET /api/v1/users/user` 401ing. The client cannot clear the cookies itself; they are cleared by `POST /auth/logout` or they expire.
- **Everything renders logged out, even right after logging in** — check whether `GET /api/v1/users/user` is actually being sent. It is called with **no `skip` gate**, because the credential is a cookie the browser sends automatically; a stale `skip: !localStorage.token` would make it never fire and the site permanently anonymous.
- **A stale `user` object in `localStorage` is not a session.** It is a cache for first paint and is overwritten by `GET /users/user` before anything trusts it. Never use it to decide whether someone is logged in — a logged-out visitor on a shared machine is in exactly that state.
- **No client-side refresh flow, and none is needed.** The server renews the access-token cookie transparently whenever an expired token is presented. `GET /auth/refresh-token` exists but the client never calls it.
- **Signing out did not clear everything** — the stale `localStorage` `token` key is removed on the first post-cutover sign-out, but a browser that has not signed out since the cutover may still hold one. It is dead weight: nothing reads it.

## 6. Admin panel problems

- **"Admin access required"** — your account's `roles.role` is not `admin`/`moderator`/`mentor`. Have an existing admin change it in `/admin/members`.
- **Admin page redirects to `/login`** — you're not authenticated (or hydration hasn't finished); log in first.
- **Contributors page shows "Live sync unavailable" / amber banner** — the server couldn't fetch `data/contributors.json` from GitHub. Causes: `CONTRIBUTOR_GITHUB_TOKEN` missing/expired on the server (returns `503`), the token lacks access, or GitHub rate limits. The page falls back to the bundled JSON. Fix the token in the Vercel environment variables; see [DEPLOYMENT.md](./DEPLOYMENT.md).
- **Saving a contributor fails** — only `batch` and `linkedin` are writable; role and GitHub fields are read-only by design. A `404` means the GitHub username wasn't found in `data/contributors.json` (it may not be synced yet — run the workflow).
- **Statistics show zeros** — statistics are **derived** from real data (members, gallery, events, certificates, visitor counter, verification logs). Empty collections = zeros, and most public pages fall back to `data/*.json` in the meantime. There is no seeder in this repository and no manual edit form (no `PATCH /admin/statistics`), so adding records through the admin panel or a script is the only route.

## 7. Certificate page problems

- **"Certificate not found"** — search is exact on `certificateId`, partial case-insensitive on `recipientName`, case-insensitive on `recipientId`. IDs are entered manually by admins in `/admin/certificates`; there is no auto-generation.
- **Profile shows no certificates** — the profile fetches certificates by the member's student ID (`uniID`). If the certificate's `recipientId` doesn't exactly match the user's `uniID` (case/spacing), nothing shows.
- **Verification statistics don't change** — success/failure counts come from `CertificateVerificationLog`; they update as people use the verify page.

## 8. Vercel deployment problems

**Check the CSRF allow-list first.** `WEB_DOMAIN` and `NEXT_PUBLIC_SITE_URL` seed the origin allow-list in `src/lib/server/request.js`, and a wrong or missing value **403s every unsafe method** — login, registration, profile edits, uploads, the admin panel — while reads and the homepage keep working perfectly. The site looks healthy and nothing saves. Both must be the **bare origin with the scheme and no trailing slash** (e.g. `https://cpccu.club`). The `www.` sibling is derived automatically, so listing one half of a pair is not the problem. For a host that is genuinely neither, add it to `EXTRA_ALLOWED_ORIGINS` (comma-separated, additive only).

Other deploy issues:

- **Site works locally but not on Vercel** — the usual cause is missing secrets. `validateEnv()` is lazy, so a deploy with none of the four required values set builds green and fails at runtime with 500s. Check them in **Settings → Environment Variables**, and remember they must each be a *different* random string.
- **Changed `NEXT_PUBLIC_SITE_URL` and nothing changed** — `NEXT_PUBLIC_*` values are **inlined at build time**. Editing the dashboard does not affect any already-built bundle; trigger a rebuild. (It is the only `NEXT_PUBLIC_*` variable left, and it is not an API URL.)
- **CORS errors on the live site** — not expected, and not fixable by configuration. The client is same-origin by design. A CORS error means something is being requested from a different host than the one serving the page.
- **`getClientIp` and rate limiting** — every IP-keyed limiter trusts `x-real-ip` / `x-vercel-forwarded-for` / `x-forwarded-for` because the Vercel edge overwrites them. Hosting this app anywhere else makes all of them forgeable with a single header; `src/lib/server/request.js` documents the requirement and the blast radius. Separately, the in-process rate-limit store is not shared across instances, so the limiters are only intermittently enforced — see [BACKEND_MIGRATION.md](./BACKEND_MIGRATION.md) §8 before declaring a deploy hardened.

## 9. Contributor GitHub Action failure

The `update-contributors.yml` workflow (frontend repo, `release` branch, daily 19:05 UTC + manual dispatch) fails when:

- **`CONTRIBUTOR_GITHUB_TOKEN` secret is missing/expired** in the repo's Actions secrets (script exits with "GitHub token: not configured" or a 401/403 fetch error).
- **The token lacks read access** to `cpccu/cpccu-client` and the **private** `cpccu/cpccu-server` (404/403 on fetch).
- **No commits on `release`** — the script still succeeds but writes an empty/unchanged list; check the workflow run log for "Successfully updated N contributors".

The workflow commits `data/contributors.json` directly to `release`. If the JSON looks stale, re-run the workflow manually (Actions → Update Contributors → Run workflow).

## 10. Build / lint / test failures

- **`npm run build` fails on an image host** — `next.config.mjs` allows exactly two remote patterns (`res.cloudinary.com`, `avatars.githubusercontent.com`). Adding a host means adding it there **explicitly**; do not widen it back to `hostname: "**"`, which is a real SSRF surface (see [BACKEND_MIGRATION.md](./BACKEND_MIGRATION.md) §5.14). The error is `Invalid src prop … hostname is not configured`.
- **`npm test` reports a client URL with no `route.js`** — you added, renamed, moved or re-methoded an endpoint on one side only. `test/client-endpoint-parity.test.js` joins the two; fix it by adding the route or repointing the client, and if the endpoint is genuinely not client-facing add a reasoned entry to `SKIPPED_NOT_CLIENT_FACING`. **Do not delete the assertion.**
- **`npm test` reports a retired origin under `src/`** — the string `localhost:5000` or `cpccu-server.onrender.com` has reappeared in a comment, a default or a config. The whole point of that check is that a stale origin gets pasted back in from stale docs.
- **ESLint** — `npm run lint` works. It is `eslint .` against the flat config in `eslint.config.mjs`; the old `next lint` script and `.eslintrc.cjs` are gone. The config is deliberately **warn-first** for advisory rules, so a large warning count is the recorded pre-existing backlog, not a regression; `error` still fails the command and CI.
- **CSP blocks a new external origin at runtime** — update `connect-src` in `src/proxy.ts` (production CSP) when adding new font/CDN origins.

## 11. Misc

- **Bootcamp leaderboard errors** — `GOOGLE_SHEETS_API_KEY` / `BOOTCAMP_SHEET_ID` are server-side variables read by the bootcamp leaderboard controller; if missing, the endpoint returns `500` and the page shows a hint.
- **Image uploads fail** — uploads go to Cloudinary via `POST /admin/uploads/image` (admin) and `PATCH /users/user/upload-image/:key` (profile images). Check the Cloudinary credentials, and note the cap is **4 MiB per file** (`MAX_UPLOAD_BYTES`), not 5 MB — the limit was lowered to sit just under Vercel's 4.5 MB edge cap so our code produces the documented 400 instead of an opaque platform error.
- **A write returns `403 Cross-origin request rejected` while reads work** — this is the CSRF allow-list, not a permissions problem. See §8.
- **"Unable to Load Profile" / "Profile Not Found"** — the profile page couldn't fetch the user (API or database unreachable) or the `id` (ObjectId or `uniID`) doesn't exist.