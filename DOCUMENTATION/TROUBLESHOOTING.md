# Troubleshooting

Real problems you are likely to hit with the CPCCU platform, based on the actual architecture. Each entry states the symptom, the likely cause, and the fix.

> Backend-side issues (MongoDB, Resend, Cloudinary, Render) have their own troubleshooting table in [cpccu-server/docs/SETUP.md](https://github.com/cpccu/cpccu-server/blob/dev/docs/SETUP.md).

---

## 1. Frontend cannot connect to the backend

**Symptoms:** every API-backed page shows fallback data; Network tab shows failed requests to `.../api/v1/...`; the visitor counter stays 0.

**Causes & fixes:**

1. **Backend isn't running** — start `cpccu-server` (`npm run dev`). Verify with `curl http://localhost:<PORT>/` (the backend's port — `3000` by default, or `5000` if you set `PORT=5000` in `cpccu-server/.env`) — expect the plain-text heartbeat.
2. **Wrong `NEXT_PUBLIC_API_BASE_URL`** — check `.env` (frontend) matches the backend origin + `/api/v1`. Default is `http://localhost:5000/api/v1`. Remember: changes to `NEXT_PUBLIC_*` require a dev-server restart / redeploy.
3. **Deployed mismatch** — on Vercel the variable must point at the Render service (`https://<service>.onrender.com/api/v1`), not localhost. See [DEPLOYMENT.md](./DEPLOYMENT.md#2-backend--render).
4. **CORS blocking** — the browser console shows a CORS error. The backend allow-list includes `localhost:3000..3002`, `cpccu.club`, `cpccu.pro.bd`, and the Vercel preview domain. If you run the frontend on a different origin, add it to the backend's `CORS_ORIGIN` env var (no code change needed).

## 2. OTP email not arriving

**Causes & fixes:**

1. **`RESEND_API_KEY` missing/invalid on the backend** — check backend logs (`Failed to send registration OTP` / `Resend API error`). Resend rejects unverified sender domains; `noreply@cpccu.club` must be verified in the Resend account.
2. **Emails in spam** — check spam/junk; the sender is `CPCCU <noreply@cpccu.club>`.
3. **Wrong email case** — registration lowercases the email, but `send-otp` looks it up by the raw input. Submit the same casing you registered with (known debt, see [SECURITY.md](./SECURITY.md)).
4. **Rate limited** — `POST /auth/send-otp` allows 5 requests / 15 min per IP (`429`). Wait and retry.

## 3. Verification popup issues

- **"Invalid OTP"** — OTPs are exactly 6 numeric digits and expire after 2 minutes; use the latest email. The popup's 6 boxes accept letters too, but the backend only generates digits.
- **"OTP has expired" (`419`)** — request a resend (button appears after the 60s countdown).
- **Popup won't open after signup** — signup triggers the popup via `OtpVerifyPopup` in `src/components/LOGINSIGNUP/Signup.jsx`. If you closed it, resend from the login screen: attempt login with the unverified account → the backend returns `403 EMAIL_NOT_VERIFIED` → `Login.jsx` reopens the popup automatically.

## 4. Login fails with "Please verify your email to continue"

This is **by design** — the backend enforces email verification (`403` + code `EMAIL_NOT_VERIFIED`) and issues no session for unverified accounts. Complete the OTP verification (popup should open automatically), then log in again. This is the current security contract — do not weaken it client-side.

## 5. Session / token issues

- **"Session expired" / redirected to login after refresh** — the frontend stores only the access token in `localStorage` (`token`). On app load, `ProviderWrapper` validates it via `GET /users/user`; if invalid, credentials are cleared. Log in again.
- **No auto-refresh on the frontend** — there is no refresh-token flow in this repo. The backend renews the access-token cookie transparently for cookie-based requests, but the `localStorage` bearer token is not refreshed. If you need longer sessions, that's a planned architecture change (see [ADR.md](./ADR.md#adr-012--future-decisions-planned-not-implemented)).

## 6. Admin panel problems

- **"Admin access required"** — your account's `roles.role` is not `admin`/`moderator`/`mentor`. Have an existing admin change it in `/admin/members`.
- **Admin page redirects to `/login`** — you're not authenticated (or hydration hasn't finished); log in first.
- **Contributors page shows "Live sync unavailable" / amber banner** — the backend couldn't fetch `data/contributors.json` from GitHub. Causes: `CONTRIBUTOR_GITHUB_TOKEN` missing/expired on the server (returns `503`), the token lacks access, or GitHub rate limits. The page falls back to the bundled JSON. Fix the token on Render; see [DEPLOYMENT.md](./DEPLOYMENT.md).
- **Saving a contributor fails** — only `batch` and `linkedin` are writable; role and GitHub fields are read-only by design. A `404` means the GitHub username wasn't found in `data/contributors.json` (it may not be synced yet — run the workflow).
- **Statistics show zeros** — statistics are **derived** from real data (members, gallery, events, certificates, visitor counter, verification logs). Empty collections = zeros. Seed data with `npm run data:seed` (from `cpccu-server`) or add real records. There is no manual edit form (no `PATCH /admin/statistics`).

## 7. Certificate page problems

- **"Certificate not found"** — search is exact on `certificateId`, partial case-insensitive on `recipientName`, case-insensitive on `recipientId`. IDs are entered manually by admins in `/admin/certificates`; there is no auto-generation.
- **Profile shows no certificates** — the profile fetches certificates by the member's student ID (`uniID`). If the certificate's `recipientId` doesn't exactly match the user's `uniID` (case/spacing), nothing shows.
- **Verification statistics don't change** — success/failure counts come from `CertificateVerificationLog`; they update as people use the verify page.

## 8. Vercel / Render environment mismatch

- **Site works locally but not on Vercel** — check the Vercel project's `NEXT_PUBLIC_API_BASE_URL` (Environment Variables) and redeploy after changing it (it's inlined at build time).
- **Backend deployed but frontend errors** — confirm the Render service is up (`https://<service>.onrender.com/` heartbeat) and that `NODE_ENV=production` is set on Render (enables HSTS).
- **CORS errors on the live site** — the backend allow-list must include your exact frontend origin (including `https://`). Use `CORS_ORIGIN` for anything not in the built-in list.

## 9. Contributor GitHub Action failure

The `update-contributors.yml` workflow (frontend repo, `release` branch, daily 19:05 UTC + manual dispatch) fails when:

- **`CONTRIBUTOR_GITHUB_TOKEN` secret is missing/expired** in the repo's Actions secrets (script exits with "GitHub token: not configured" or a 401/403 fetch error).
- **The token lacks read access** to `cpccu/cpccu-client` and the **private** `cpccu/cpccu-server` (404/403 on fetch).
- **No commits on `release`** — the script still succeeds but writes an empty/unchanged list; check the workflow run log for "Successfully updated N contributors".

The workflow commits `data/contributors.json` directly to `release`. If the JSON looks stale, re-run the workflow manually (Actions → Update Contributors → Run workflow).

## 10. Build / lint failures

- **`npm run build` fails on image domains** — `next.config.mjs` allows all remote patterns; if you add a new image host, verify it's reachable over HTTPS (CSP `img-src` in `src/proxy.ts` allows `https:`).
- **`npm run lint` doesn't run at all** — `next lint` was removed in Next.js 16, and the installed ESLint 10 needs a flat config (`eslint.config.js`) while the repo only has `.eslintrc.cjs`. This is a pre-existing toolchain issue, not your code — verify with `npm run build` instead until the repo migrates to flat config.
- **CSP blocks a new external origin at runtime** — update `connect-src` in `src/proxy.ts` (production CSP) when adding new API/font/CDN origins.

## 11. Misc

- **Bootcamp leaderboard errors** — `GOOGLE_SHEETS_API_KEY` / `BOOTCAMP_SHEET_ID` are backend vars; if missing, the backend returns `500` and the page shows a hint.
- **Image uploads fail** — uploads go through the backend (`POST /admin/uploads/image` for admin, `PATCH /users/user/upload-image/:key` for profile images) → Cloudinary. Check backend Cloudinary credentials and the 5 MB file limit.
- **"Unable to Load Profile" / "Profile Not Found"** — the profile page couldn't fetch the user (backend down) or the `id` (ObjectId or `uniID`) doesn't exist.