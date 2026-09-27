import { sendOtpHandler } from '@/lib/server/controllers/auth.controller';
import { authEmailRateLimiter } from '@/lib/server/rateLimit';
import { defineRoute } from '@/lib/server/handler';

/**
 * `POST /api/v1/auth/send-otp` — (re)send the registration OTP to an address.
 *
 * `public: true` because the endpoint is the recovery path for a registration
 * that was never completed, i.e. it is used before any session exists.
 *
 * `authEmailRateLimiter` is the ONLY control on outbound mail here, which makes
 * it the one route where the in-memory store's Vercel caveat bites hardest: see
 * the module docblock in `rateLimit.js` — each function instance is a separate
 * process with its own `Map`, so on Vercel this 5-per-15-minute cap is
 * effectively unenforced across instances and fails silently (no error, no log).
 * It is kept because it is what the Express original had, and `setRateLimitStore`
 * is the documented injection point that makes it real.
 */

// `nodejs` because this route reaches `mongoose` and the Resend SDK, neither of
// which is Edge-compatible. `force-dynamic` because it reads the body and must
// never be prerendered.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = defineRoute('POST', {
  public: true,
  limiter: authEmailRateLimiter,
  controller: sendOtpHandler,
});
