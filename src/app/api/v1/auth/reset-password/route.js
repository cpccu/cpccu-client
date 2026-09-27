import { resetPasswordHandler } from '@/lib/server/controllers/auth.controller';
import { passwordResetRateLimiter } from '@/lib/server/rateLimit';
import { defineRoute } from '@/lib/server/handler';

/**
 * `PATCH /api/v1/auth/reset-password` — set a new password using code + token.
 *
 * `public: true` because the credential here is the emailed `code`/`token` pair
 * in the body, not a session — the user is by definition locked out. The token
 * is verified inside the handler against `PASSWORD_TOKEN_SECRET` with a single
 * attempt budget, and a successful reset revokes live refresh tokens.
 *
 * `passwordResetRateLimiter` (10 per 15 min, per IP) bounds guesses against the
 * reset code. Best-effort on Vercel per `rateLimit.js`'s store caveat.
 *
 * `PATCH` and not `POST` is the Express original's verb, preserved.
 *
 * THE DESTINATION PAGE IS UNRELATED TO THIS ROUTE. `src/app/reset-password/
 * [code]/[token]/page.jsx` is the form that renders, and it POSTs here — a page
 * and a route at different segments, which App Router allows. (Contrast with
 * `/verify/[certificateId]`, where a `page.jsx` and a `route.js` would collide at
 * the SAME segment; see the certificate routes for that case.)
 */

// `nodejs` because this route reaches `mongoose`, `bcryptjs` and
// `jsonwebtoken`, none of which are Edge-compatible. `force-dynamic` because it
// reads the body and must never be prerendered.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const PATCH = defineRoute('PATCH', {
  public: true,
  limiter: passwordResetRateLimiter,
  controller: resetPasswordHandler,
});
