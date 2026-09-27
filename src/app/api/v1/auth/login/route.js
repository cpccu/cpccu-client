import { loginHandler } from '@/lib/server/controllers/auth.controller';
import { loginRateLimiter } from '@/lib/server/rateLimit';
import { defineRoute } from '@/lib/server/handler';

/**
 * `POST /api/v1/auth/login` — exchange email + password for cookies.
 *
 * `public: true` because the endpoint IS the credential exchange: there is no
 * session to present on the way in.
 *
 * `loginRateLimiter` (per IP, 10 per 15 min) is the brute-force control. Per
 * `rateLimit.js` it is best-effort on Vercel for the reason documented there, so
 * it must never be the only thing standing between an attacker and a password
 * corpus — the controller's own failure messaging and the password policy are
 * the other layers.
 *
 * `rejectMultipart: true` REPRODUCES `upload.none()`, WHICH THE EXPRESS ROUTER
 * RAN BEFORE THE LIMITER. `upload.none()` rejects any multipart body with a
 * `MulterError`; that error matched none of the four branches of the Express
 * error handler, so the observable original behaviour was a 500 whose body
 * carried multer's text, `'Unexpected field'` — which is why the bridge throws
 * `ApiError(500, 'Unexpected field')` rather than a 415.
 *
 * The INTENT was "a login is JSON, refuse anything else", and the check is kept
 * rather than dropped because without it the shim would PARSE a multipart body
 * into `req.body` and let the login SUCCEED. That would be a widening of an auth
 * endpoint's accepted content types introduced by a migration whose entire
 * premise is that it does not change behaviour.
 *
 * ORDERING NOTE, PRESERVED: in Express, `upload.none()` ran BEFORE
 * `loginRateLimiter`, so a multipart flood was rejected by content type without
 * consuming rate-limit budget. In this composition `assertSameOrigin` and the
 * size gate run first (from `apiRoute`), then the limiter, then the multipart
 * rejection inside the handler — so a rejected multipart login DOES consume one
 * of the ten slots. That is the one place the order differs, and it fails in the
 * safe direction (a rejected request is counted), not the loose one.
 */

// `nodejs` because this route reaches `mongoose`, `bcryptjs` and `jsonwebtoken`,
// none of which are Edge-compatible. `force-dynamic` because it reads the body
// and writes cookies, so it must never be prerendered or statically cached.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = defineRoute('POST', {
  public: true,
  limiter: loginRateLimiter,
  rejectMultipart: true,
  controller: loginHandler,
});
