import { logoutHandler } from '@/lib/server/controllers/auth.controller';
import { defineRoute } from '@/lib/server/handler';

/**
 * `GET /api/v1/auth/logout` — revoke this device's refresh token and clear cookies.
 *
 * AUTHENTICATED, which here means simply OMITTING `public`. That is the whole
 * point of the inverted default in `apiRoute`: there is no `auth: true` to
 * forget. A route is locked unless it says `public: true` in a way a reviewer
 * can see and a reviewer can question. The Express original listed `verifyToken`
 * explicitly in the chain; here the absence of `public` is the lock.
 *
 * `GET`, not `POST`, because that is how the Express original registered it.
 * NOTE THE CSRF CONSEQUENCE, since it is a real one and is preserved rather than
 * "fixed": `GET` is in `SAFE_METHODS`, so a cross-site request to this URL is not
 * blocked by `assertSameOrigin`. An attacker who can get a victim's browser to
 * issue a top-level `GET` (an `<img>`, a redirect) can therefore log that victim
 * out — a denial of convenience, not a compromise, and the attacker's own
 * browser is not logged out because the `refreshToken` cookie is scoped to the
 * origin the request was made from. Changing this to `POST` would be a client
 * contract change, not a porting decision, so it is recorded here instead.
 */

// `nodejs` because this route reaches `mongoose` and `jsonwebtoken`, neither of
// which is Edge-compatible. `force-dynamic` because it reads the auth cookies and
// must never be prerendered or cached.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = defineRoute({
  method: 'GET',
  controller: logoutHandler,
});
