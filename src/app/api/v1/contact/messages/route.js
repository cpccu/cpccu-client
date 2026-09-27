import { createContactMessage } from '@/lib/server/controllers/contact.controller';
import { contactRateLimiter } from '@/lib/server/rateLimit';
import { defineRoute } from '@/lib/server/handler';

/**
 * `POST /api/v1/contact/messages` — the public contact form.
 *
 * ============================ `public: true` — FLAGGED ============================
 * ANONYMOUS. The contact form is on a public page and collects no session, which
 * is why the Express route mounted only a rate limiter and no `verifyToken`.
 *
 * ===================== MASS ASSIGNMENT — NOW FIXED (H2) =====================
 * This route USED TO hand the WHOLE `req.body` to `ContactMessage.create()`,
 * unvalidated, which let an anonymous caller set the ADMINISTRATIVE fields on the
 * record: `status` (mark their own message read so it never reaches the inbox),
 * `receivedAt` (bury it), and `reply` / `repliedAt` (text the admin panel then
 * RENDERS AS IF THE CLUB HAD SENT IT — impersonation of the organisation to the
 * people reading the inbox). The controller now picks four fields EXPLICITLY
 * (`name`, `email`, `subject`, `message`) and validates each one, so those
 * administrative fields are not settable from this route at all.
 *
 * THAT IS A DECLARED DIVERGENCE from the Express original, and the full
 * argument is in `contact.controller.js`; the short version is that fidelity is
 * not owed to a mass-assignment primitive. The public form
 * (`src/components/CONTACT/ContactMain.jsx`) sends exactly those four fields and
 * reads nothing off the response but success, so no client change accompanies it.
 *
 * ==================== `contactRateLimiter` IS NOT A REAL LIMIT HERE ====================
 * It is the ONLY other control on this endpoint, and per `rateLimit.js`'s own
 * module docblock the default store is an IN-MEMORY `Map` INSIDE THE FUNCTION
 * INSTANCE. On Vercel every instance is a separate OS process, so two requests to
 * `/contact` are very likely counted by two different maps that cannot see each
 * other. The 3-per-minute cap is therefore EFFECTIVELY UNENFORCED ACROSS
 * INSTANCES, and it fails silently — no exception, no error response, no log line
 * — while appearing to work intermittently whenever a single warm instance
 * happens to receive a burst. H3 (a shared store) is DEFERRED by the owner, so
 * this is still true.
 *
 * `setRateLimitStore` is the documented injection point (Upstash / Vercel KV) that
 * makes it real; wiring it is a later phase because it needs credentials and a
 * failure-mode decision.
 */

// `nodejs` because this route reaches `mongoose` and the Resend SDK, neither of
// which is Edge-compatible. `force-dynamic` because it reads the request body and
// must never be prerendered.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = defineRoute({
  method: 'POST',
  public: true,
  limiter: contactRateLimiter,
  controller: createContactMessage,
});
