import { logoutHandler } from '@/lib/server/controllers/auth.controller';
import { defineRoute } from '@/lib/server/handler';

/**
 * `POST /api/v1/auth/logout` — revoke this device's refresh token and clear cookies.
 *
 * AUTHENTICATED, which here means simply OMITTING `public`. That is the whole
 * point of the inverted default in `apiRoute`: there is no `auth: true` to
 * forget. A route is locked unless it says `public: true` in a way a reviewer
 * can see and a reviewer can question. The Express original listed `verifyToken`
 * explicitly in the chain; here the absence of `public` is the lock.
 *
 * `POST`, NOT `GET` — CHANGED 2026-09 IN THE CUTOVER, and the previous `GET`
 * was a real hole that this docblock used to preserve rather than fix. `GET` is
 * in `SAFE_METHODS`, so `assertSameOrigin` no-ops on it: a cross-site
 * top-level `GET` — an `<img src="/api/v1/auth/logout">`, a redirect, a
 * `<link rel=prefetch>` — was not blocked at all, and an attacker who could get
 * a victim's browser to issue one logged that victim out. The original comment
 * called this "a denial of convenience, not a compromise", which understated
 * it in one specific way: logout also REVOKES the refresh token from
 * `user.refreshTokens`, so the victim is signed out for the full seven days
 * with no way back but logging in again.
 *
 * WHY CHANGING THE VERB IS SUFFICIENT. `assertSameOrigin` runs on every method
 * outside `SAFE_METHODS` (`src/lib/server/request.js`), so `POST` is the first
 * verb this endpoint has ever been behind. The browser sends
 * `Sec-Fetch-Site: same-origin` and an `Origin` this deployment allows on a
 * same-origin `fetch`, so the first-party client passes; a cross-site request
 * that somehow avoided a preflight carries neither and is 403'd.
 *
 * THE CLIENT VERB LIVES IN EXACTLY ONE PLACE — `method: 'POST'` in
 * `src/features/auth/authApi.js` — and `test/route-method-declaration.test.js`
 * asserts that this file's declared method matches its export name, so the two
 * halves cannot drift apart silently. Do not "restore GET for compatibility":
 * there is no third-party caller to be compatible with, and doing so re-opens
 * the hole.
 */

// `nodejs` because this route reaches `mongoose` and `jsonwebtoken`, neither of
// which is Edge-compatible. `force-dynamic` because it reads the auth cookies and
// must never be prerendered or cached.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = defineRoute('POST', {
  controller: logoutHandler,
});
