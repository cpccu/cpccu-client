import { refreshAccessToken } from '@/lib/server/controllers/auth.controller';
import { defineRoute } from '@/lib/server/handler';

/**
 * `GET /api/v1/auth/refresh-token` — mint a new access token from the refresh cookie.
 *
 * `public: true`, and the justification is the whole reason this route is easy
 * to get wrong: the ACCESS token is what has expired. Requiring authentication
 * here would be a deadlock — `verifyToken` would try to refresh the very token
 * whose expiry triggered the call. The credential is the `refreshToken` COOKIE,
 * verified inside the handler against the live token list on the user document
 * (so a logged-out or rotated token is rejected), not the `apiRoute` gate.
 *
 * It is also why this route has no rate limiter: it is not a guessing surface
 * (the refresh token is a 7-day signed JWT checked against a stored list, not a
 * short secret), and throttling it would log every user out roughly every 15
 * minutes once per access-token lifetime — the exact "random ~50% logout" symptom
 * the transparent-refresh path in `auth.js` exists to prevent.
 *
 * `GET`, not `POST`, because that is how the Express original registered it, and
 * because `GET` is in `SAFE_METHODS` so the CSRF check is a no-op for a route
 * that only reads a `SameSite=Lax` cookie and returns a token to the same-origin
 * caller that already holds it.
 */

// `nodejs` because this route reaches `mongoose` and `jsonwebtoken`, neither of
// which is Edge-compatible. `force-dynamic` because it reads the `refreshToken`
// cookie and must never be prerendered or cached.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = defineRoute({
  method: 'GET',
  public: true,
  controller: refreshAccessToken,
});
