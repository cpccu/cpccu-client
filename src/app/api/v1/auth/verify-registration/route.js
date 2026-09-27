import { verifyOTPHandler } from '@/lib/server/controllers/auth.controller';
import { otpVerificationRateLimiter } from '@/lib/server/rateLimit';
import { defineRoute } from '@/lib/server/handler';

/**
 * `POST /api/v1/auth/verify-registration` — exchange email + OTP for a session.
 *
 * `public: true` because the OTP is the credential here: the caller has no
 * session yet, and the handler verifies the code against the `pending` user it
 * then signs in.
 *
 * `otpVerificationRateLimiter` is a COARSE, PER-IP 5-per-10-minute cap, and it is
 * the wrong key for the threat on purpose. Guessing a single 6-digit code is
 * stopped by the per-OTP ATTEMPT BUDGET inside the handler
 * (`MAX_OTP_ATTEMPTS = 5` in `auth.controller.js`, which destroys the code when
 * it is reached), because a per-email limiter here would be keyed on
 * attacker-supplied input and would let the key space be sprayed without bound.
 * The IP limiter exists so the endpoint cannot be used to hammer the database
 * at all.
 */

// `nodejs` because this route reaches `mongoose` and `jsonwebtoken`, neither of
// which is Edge-compatible. `force-dynamic` because it reads the body and must
// never be prerendered.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = defineRoute('POST', {
  public: true,
  limiter: otpVerificationRateLimiter,
  controller: verifyOTPHandler,
});
