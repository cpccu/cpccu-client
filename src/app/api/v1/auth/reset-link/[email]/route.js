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
 * `authEmailRateLimiter` (5 per 15 min) is the outbound-mail control. Per
 * `rateLimit.js` it is best-effort on Vercel because the store is per-instance
 * in memory. The handler's own mitigation is the one that matters most: it
 * returns an IDENTICAL success response for "no such account" and for a real
 * one, so this endpoint is not an account-existence oracle regardless of the
 * limiter.
 */

// `nodejs` because this route reaches `mongoose` and the Resend SDK, neither of
// which is Edge-compatible. `force-dynamic` because it reads a dynamic route
// segment and must never be prerendered.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = defineRoute({
  method: 'GET',
  public: true,
  limiter: authEmailRateLimiter,
  controller: forgottenPasswordHandler,
});
