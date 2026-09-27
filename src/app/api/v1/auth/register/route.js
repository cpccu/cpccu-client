import { registrationHandler } from '@/lib/server/controllers/auth.controller';
import {
  registrationEmailRateLimiter,
  registrationRateLimiter,
} from '@/lib/server/rateLimit';
import { defineRoute } from '@/lib/server/handler';

/**
 * `POST /api/v1/auth/register` — create a user in `pending` state and email the OTP.
 *
 * `public: true` because this is how an account comes INTO existence: it
 * necessarily runs before anyone holds a credential. It is the correct opt-out,
 * and it is the reason `public` is an explicit, greppable token on the route
 * rather than an absence.
 *
 * TWO LIMITERS, IN THIS ORDER, AND BOTH ARE NEEDED — they are different controls
 * with different keys, not redundant layers:
 *
 *   1. `registrationRateLimiter` — per IP, 100/hour. Caps registration VOLUME
 *      from one network origin. Deliberately generous, because a single
 *      university NAT was observed to host ~50 students registering at once, so
 *      it is a flood control and not a credential control.
 *   2. `registrationEmailRateLimiter` — per TARGET EMAIL, 5/hour. Caps how many
 *      OTPs can be pushed at one address. This is the control that actually
 *      protects a specific victim (and the sender's Resend quota) once the IP
 *      ceiling has been cleared.
 *
 * The order matches the Express chain exactly
 * (`registrationRateLimiter, registrationEmailRateLimiter, registrationHandler`),
 * and it is load-bearing — see the long note on `composeLimiters` in
 * `src/lib/server/handler.js`. In short: the IP limiter runs first because its
 * key is NOT attacker-controlled, and the email limiter runs second so a flood
 * of sprayed addresses is stopped before it can drive the email limiter's
 * `maxKeys: 10000` eviction. Swapping them would change which 429 message a
 * flooding client receives, which is an observable API change.
 */

// `nodejs` because this route reaches `mongoose`, `bcryptjs` and `jsonwebtoken`,
// none of which are Edge-compatible. `force-dynamic` because it reads the
// request body (and the per-email limiter keys on `body.email`), so it must
// never be prerendered.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = defineRoute('POST', {
  public: true,
  limiter: [registrationRateLimiter, registrationEmailRateLimiter],
  controller: registrationHandler,
});
