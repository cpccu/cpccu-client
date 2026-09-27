import { forgottenPasswordHandler } from '@/lib/server/controllers/auth.controller';
import { authEmailRateLimiter } from '@/lib/server/rateLimit';
import { defineRoute } from '@/lib/server/handler';

/**
 * `POST /api/v1/auth/reset-link` — email a password-reset link.
 *
 * `public: true` because the caller has no session — this is how a locked-out
 * user starts the recovery flow.
 *
 * ============================================================================
 * `GET` -> `POST`, AND THE ADDRESS MOVED FROM THE PATH INTO THE BODY
 * ============================================================================
 * CHANGED 2026-09. This was `GET /api/v1/auth/reset-link/:email`, served from
 * `reset-link/[email]/route.js`. Both the verb and the location of the address
 * changed together, and the previous docblock here described that as a PRODUCT
 * DECISION TO BE COORDINATED RATHER THAN A FIX. It has now been applied. What
 * follows records why it was a fix all along, because the reasoning is what
 * stops the next person from "restoring compatibility".
 *
 * THE HOLE THE `GET` LEFT OPEN. `GET` is in `SAFE_METHODS`, so
 * `assertSameOrigin` — the application's only CSRF defence — is a NO-OP on this
 * route. Worse, the target address was a PATH SEGMENT, so it did not have to
 * travel in a body the attacker would need to get past a CORS preflight, a form
 * post, or an `XHR`; a bare `<img src="…/reset-link/victim@example.edu">` or a
 * top-level navigation was sufficient. No script on the page, no XSS, and no
 * credential of the attacker's own was required.
 *
 * WHAT THAT BUYS AN ATTACKER, and it is more than a nuisance:
 *  - A MAIL-BOMB / QUOTA-BURN PRIMITIVE. Every hit sends a genuine,
 *    CPCCU-branded email through Resend. The sender quota is the resource being
 *    spent, and exhausting it denies password resets to every real user.
 *  - A PHISHING LURE. The message is a real reset mail from a real address. An
 *    attacker who has separately obtained a lookalike domain has a mail from
 *    this club, unsolicited and to a victim they chose, carrying a link the
 *    victim has been trained to click.
 *
 * The target is attacker-chosen, so this is a weapon aimed at anyone, and it
 * needs no access to the application at all.
 *
 * WHY `authEmailRateLimiter` IS NOT THE ANSWER. It is 5 per 15 minutes, which
 * sounds like a control, but per `rateLimit.js` the store is in-memory and
 * PER-INSTANCE: on Vercel every warm lambda has its own counter and a cold
 * start resets it, so "5" is not "5 per deployment". It is a friction reducer
 * against a double-clicked button. Treating it as the thing keeping this
 * endpoint safe was the reasoning that kept the `GET` in place.
 *
 * ============================================================================
 * NO `GET` FALLBACK MAY BE ADDED. READ THIS BEFORE "RESTORING COMPATIBILITY"
 * ============================================================================
 * There is no third-party caller to be compatible with: this endpoint is
 * reached from exactly one place, the login page's forgot-password flow
 * (`useSendPasswordResetLinkMutation` in `src/features/auth/authApi.js`), and
 * that call site was changed in the same commit. A `GET` alias would be a
 * complete re-opening of the hole above — a top-level navigation cannot set a
 * body, so a `GET` route could only read the address from the path, which is
 * the half of the design that makes it exploitable.
 *
 * `test/route-method-declaration.test.js` asserts that the method declared
 * below matches the export name it is assigned to, so the two halves of this
 * file cannot drift apart silently.
 *
 * ============================================================================
 * WHAT MUST NOT CHANGE HERE — THE ENUMERATION PROPERTY
 * ============================================================================
 * The one property that makes this endpoint safe against account enumeration is
 * that it answers IDENTICALLY for "no such account" and for a real one. That is
 * in the handler, not here: `forgottenPasswordHandler` returns the same
 * `ApiResponse(200, null, 'Reset link sent successfully!')` on both paths
 * (`auth.controller.js`, the early return for a missing user and the final
 * return after `sendOTP`), and deliberately does NOT raise the 404. Answering
 * differently would let anyone enumerate registered addresses by watching which
 * requests come back 200-with-mail versus 200-without — so a future
 * "improvement" that returns 404 for an unknown address, or that declines to
 * send on an unknown address, is a REGRESSION even though it reads as
 * friendlier. `test/auth-reset-link.test.js` asserts the byte-identical
 * property on both paths.
 *
 * TIMING IS NOT IDENTICAL AND IS NOT CLAIMED TO BE. The real path also does a
 * `findOne`, a token generation, a `sendOTP` round trip and a `save`, so a
 * careful attacker can still extract a coarse signal from response time. That
 * is an ACCEPTED RESIDUAL and is deliberately not addressed here: closing a
 * timing channel means adding a constant delay, which trades a real availability
 * and cost problem (every request, including the overwhelmingly common
 * no-such-account one, waits) for a defence against an attacker who can already
 * measure over a network. The response-SHAPE property is the one that holds and
 * the one that is enforced.
 *
 * ============================================================================
 * WHY THE ADDRESS IS IN THE BODY, AND THE ONE THING THAT CHANGED WITH IT
 * ============================================================================
 * Moving off the path is the part that actually re-arms the protection: a `POST`
 * body cannot be produced by an `<img>`, a link, or a cross-site navigation, and
 * a cross-origin `POST` carrying `application/json` is preflighted, so
 * `assertSameOrigin` is now armed and can refuse the request before any mail is
 * sent. The `Cookie` header that makes the CSRF check meaningful is still
 * `SameSite=Lax`, so it rides along on the same-origin `fetch` this client
 * makes.
 *
 * The consequence is that this file no longer has a dynamic segment, so the
 * `params: routeContext.params` bridge that `req.params.email` depended on is
 * gone with it. The handler now reads `req.body.email` — a documented change to
 * the controller, and the reason it is called out here is that a route file
 * which silently stopped passing `params` would 400 on every real request
 * ("Email is required") rather than fail at build time.
 */

// `nodejs` because this route reaches `mongoose` and the Resend SDK, neither of
// which is Edge-compatible. `force-dynamic` because it consumes a request body
// and must never be prerendered.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = defineRoute('POST', {
  public: true,
  limiter: authEmailRateLimiter,
  controller: forgottenPasswordHandler,
});
