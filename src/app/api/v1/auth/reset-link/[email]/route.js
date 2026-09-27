import { forgottenPasswordHandler } from '@/lib/server/controllers/auth.controller';
import { authEmailRateLimiter } from '@/lib/server/rateLimit';
import { defineRoute } from '@/lib/server/handler';

/**
 * `GET /api/v1/auth/reset-link/:email` — email a password-reset link.
 *
 * `public: true` because the caller has no session — this is how a locked-out
 * user starts the recovery flow.
 *
 * THE EMAIL IS A PATH SEGMENT, not a body field, which is why the file lives at
 * `[email]/`. `forgottenPasswordHandler` reads `req.params.email`; the bridge
 * passes `params: routeContext.params` to `createShim` on EVERY route, which is
 * what makes that read work. Omitting it is the classic migration 400 ("Email is
 * required") and it is the failure mode the bridge exists to prevent.
 *
 * NOTE THE CSRF CONSEQUENCE, and it is the SAME trade `auth/logout/route.js:13-21`
 * documents for its own `GET` — stated here because this endpoint's blast radius
 * is the mailbox rather than the session:
 *
 *   - `GET` is in `SAFE_METHODS`, so `assertSameOrigin` is a NO-OP on this route.
 *     The same-origin check is the app's only CSRF defence and it is inert here.
 *   - The target address comes from the URL, not from a body the attacker would
 *     have to get past preflight or a form post. So any cross-site `<img src>`
 *     or top-level navigation is sufficient to fire it — no XHR, no CORS, no
 *     form. A "forgot your password" email is trivially a phishing lure, so this
 *     is more than a nuisance: the endpoint will mail a real, branded reset link
 *     to an arbitrary address on an attacker's say-so.
 *   - `authEmailRateLimiter` (5 per 15 min) bounds how often, but see below.
 *
 * THE MITIGATION THAT ACTUALLY HOLDS is in the handler, not in the limiter:
 * `forgottenPasswordHandler` returns an IDENTICAL success response for "no such
 * account" and for a real one, and returns before `sendOTP` in the first case
 * (`auth.controller.js:604-608` vs `:635-637`). So this endpoint is NOT an
 * account-existence oracle — status and body are byte-identical — and an
 * attacker cannot use it to enumerate who has an account here. TIMING IS NOT
 * IDENTICAL and is not claimed to be: the real path also does a `findOne`, a
 * token generation, a `sendOTP` round trip and a `save`, so a careful attacker
 * can still get a coarse signal. That is an accepted residual, not a defence —
 * the response-shape property is the one that holds. Either property must be
 * preserved: a future "improvement" that returns 404 for an unknown address, or
 * that only mails on success, would be a REGRESSION even though it reads as
 * friendlier.
 *
 * THE LIMITER IS BEST-EFFORT. Per `rateLimit.js` the store is in-memory and
 * per-instance, so on Vercel every warm lambda has its own counter: 5 requests
 * per instance is not 5 requests for the deployment, and a cold start resets the
 * count entirely. Treat `authEmailRateLimiter` as a friction reducer against
 * accidental double-clicks, NOT as the control that keeps this endpoint safe.
 *
 * MIGRATING THIS TO `POST` IS A PRODUCT DECISION, NOT A FIX TO SLIP IN. `POST`
 * would take the route out of `SAFE_METHODS` and re-arm `assertSameOrigin`, which
 * is the correct end state — but it changes the method every client uses to call
 * it (the login page's forgot-password flow), so it is a CLIENT CONTRACT CHANGE
 * that has to be shipped with the frontend, reviewed, and coordinated. It is
 * recorded here rather than applied for the same reason `auth/logout/route.js`
 * records its equivalent. Comment-only: the method and the handler are
 * deliberately unchanged.
 */

// `nodejs` because this route reaches `mongoose` and the Resend SDK, neither of
// which is Edge-compatible. `force-dynamic` because it reads a dynamic route
// segment and must never be prerendered.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = defineRoute('GET', {
  public: true,
  limiter: authEmailRateLimiter,
  controller: forgottenPasswordHandler,
});
