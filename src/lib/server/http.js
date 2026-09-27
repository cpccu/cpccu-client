import 'server-only';

import { requireAdminAction } from '@/lib/server/adminAuth';
import { applyAuthCookie, verifyToken } from '@/lib/server/auth';
import { isResponsePair, toErrorResponse } from '@/lib/server/errors';
import {
  assertBodySizeWithinLimit,
  assertSameOrigin,
  readBody,
} from '@/lib/server/request';
import { ApiResponse } from '@/lib/server/response';
import {
  buildRateLimitContext,
  rateLimitResponse,
} from '@/lib/server/rateLimit';

/**
 * ============================================================================
 * DECLARED DIVERGENCES FOUND BY THE PHASE 1.5/2 CODE REVIEW
 * ============================================================================
 * These are NOT in the original divergence declaration. They are recorded here,
 * at the top of the module that implements them, so they are visible rather than
 * buried in a docblock. Each is a deliberate, reviewed change — not a bug.
 *
 * (a) JSON BODY-SIZE REJECTION — status AND message. The Express original
 *     answered an oversized `application/json` body with a **500** carrying
 *     body-parser's raw `'request entity too large'`: `PayloadTooLargeError`
 *     matched none of the four branches of `app.js:78-117` and fell through to
 *     the catch-all. This port answers **400** with a message naming the real
 *     limit. It also stops applying the UPLOAD cap to JSON at all, which was
 *     returning "Profile picture must be at most 4MB" to callers that sent no
 *     file. See `assertBodySizeWithinLimit` in `request.js`.
 *
 * (b) `DEFAULT_MAX_KEYS = 50000` ON THE IP-KEYED LIMITERS, where the Express
 *     source used `Infinity`. The in-process `Map` this replaces died with the
 *     process; a warm Vercel instance does not, and an unbounded key space on a
 *     2 GB instance is an OOM. See `rateLimit.js`. (The per-email limiter's
 *     explicit `maxKeys: 10000` is unchanged.)
 *
 * (c) `escapeHtml(otp)` in `registrationEmail.js`. The original interpolated
 *     the OTP raw. It is a 6-digit `crypto.randomInt` value today, so escaping
 *     is a no-op — it is applied because this is a single-factor credential
 *     rendered into HTML, and the cost of being wrong is a live account reset.
 *
 * (d) THE `assertSameOrigin` CSRF LAYER ITSELF. It has no Express counterpart:
 *     the original was structurally CSRF-vulnerable (`sameSite: 'none'`, cookie
 *     read before `Authorization`, `express.urlencoded()` mounted). The declared
 *     divergence list covered only the `sameSite: 'lax'` flip; the header check
 *     built on top of it is new and is stated here so nobody reads the cookie
 *     change as the whole of the CSRF story.
 * ============================================================================
 */

/**
 * Normalises a handler result into a `Response`.
 *
 * FOUR accepted return shapes, because this codebase already has four
 * incompatible envelopes (see `response.js`) and normalising them HERE is what
 * lets each route port its handler faithfully instead of rewriting it:
 *  - a `Response`     → passed through; its headers are copied by
 *                       `finalizeResponse` (it never mutates the object a handler
 *                       handed it, see the immutability note there);
 *  - an `ApiResponse` → serialised to `{ statusCode, data, message, success }`;
 *  - a BRANDED `{ status, body }` pair → the shape `toErrorResponse` produces,
 *                       recognised by `isResponsePair` (see below);
 *  - a literal `{ status, body }` → the shape `shim.js`'s `collect.result()`
 *                       returns, accepted as a fallback.
 * Anything else is treated as a 200 JSON body, which is what a ported controller
 * that returns its data directly does.
 */
function toResponse(result) {
  if (result instanceof Response) return result;

  if (result instanceof ApiResponse) {
    return Response.json(
      {
        statusCode: result.statusCode,
        data: result.data,
        message: result.message,
        success: result.success,
      },
      { status: result.statusCode },
    );
  }

  // THE BRAND IS LOAD-BEARING, NOT AN OPTIMISATION. The obvious check here is
  // `typeof result === 'object' && 'status' in result`, and it is a genuine
  // production bug in this codebase: `status` is a REAL SCHEMA FIELD on the very
  // documents this wrapper exists to serve — `Event.status` ('upcoming'),
  // `ContactMessage.status` ('unread'), `DeveloperProfile.status` ('pending'),
  // `Project.status` — so a handler returning a single `Event` was treated as an
  // error pair and serialised as `Response.json(null, { status: 'upcoming' })`.
  // A non-numeric `ResponseInit.status` is a `RangeError`, so the client got a
  // 500 with a `null` body and no clue. Arrays were unaffected, which is exactly
  // why this presents as "single-document GETs are broken" and not as a
  // serialisation bug.
  //
  // `toErrorResponse` therefore stamps every pair it returns with a
  // module-private symbol (`isResponsePair` in `errors.js`), and a structural
  // check is used ONLY as the fallback for a hand-built literal from the shim.
  if (isResponsePair(result) || isLiteralResponsePair(result)) {
    return Response.json(result.body ?? null, { status: result.status ?? 200 });
  }

  return Response.json(result ?? null);
}

/**
 * The narrowed, duck-typed fallback for a `{ status, body }` pair that was NOT
 * produced by `errors.js` — i.e. the one `shim.js`'s `collect.result()` builds.
 *
 * BOTH conditions are required and each is load-bearing:
 *  - `typeof status === 'number'`. Every `status` field on a domain document in
 *    this codebase is a `String` (`adminContent.model.js`, `post.model.js`,
 *    `project.model.js` all declare `type: String`), so a document can never
 *    satisfy this. It is also the condition that prevents the `RangeError`
 *    described in `toResponse`.
 *  - a `body` key. No model in `src/lib/server/models/**` declares a `body`
 *    field, so no serialised domain document can satisfy this either.
 *
 * The conjunction is still a shape check and could in principle be defeated by a
 * future model that gains both a numeric `status` and a `body` field. The brand
 * exists precisely so that day does not matter for the error path; this fallback
 * should be deleted the day the shim returns a branded pair.
 */
function isLiteralResponsePair(result) {
  return (
    !!result &&
    typeof result === 'object' &&
    'body' in result &&
    typeof result.status === 'number'
  );
}

/**
 * Turns whatever a handler (or the error shaper) produced into the outgoing
 * `Response`, then applies the cache header, the security headers and the
 * refreshed auth cookie. Split out of `apiRoute` so both the success and the
 * throw path go through EXACTLY the same three steps — a divergence there is how
 * a 401 ends up cacheable or a refreshed cookie gets dropped on the error path.
 */
async function finalizeResponse(result, refreshCookie) {
  return applyAuthCookie(withApiHeaders(toResponse(result)), refreshCookie);
}

/**
 * Produces a NEW `Response` carrying the original's status, body and headers
 * plus the two this API guarantees on every response.
 *
 * IT BUILDS A NEW RESPONSE RATHER THAN MUTATING THE ONE IT WAS GIVEN, and that
 * is a correctness requirement, not a style preference. `response.headers` is
 * only mutable when the `Response` was constructed from a `Headers` init or by
 * `Response.json()`; the responses produced by `Response.redirect()`,
 * `Response.error()` and `NextResponse.next()` carry an IMMUTABLE headers guard,
 * and `headers.set(...)` on any of them throws `TypeError: immutable`. A
 * handler or shim path that produced such a response — `res.redirect(...)` is the
 * obvious one — therefore turned a working endpoint into a 500, and it did so
 * inside the error path, where `finalizeResponse` is the only thing standing
 * between the caller and Next's HTML error page. Copying sidesteps the whole
 * class.
 *
 * The original headers are copied first so a handler's deliberate values
 * (`Retry-After` from the rate limiter, `Content-Disposition` on a download)
 * survive; the two guarantees below then OVERWRITE, because "no API response may
 * be cached" and "an API response is never sniffed into HTML" are policies, not
 * preferences a route may opt out of.
 */
function withApiHeaders(response) {
  const headers = new Headers();

  for (const [name, value] of response.headers) headers.set(name, value);

  // No API response may be cached. These are authenticated, per-user payloads; a
  // cache that keeps one is a cross-user data leak, and `no-store` on an error
  // response also stops a 401 being replayed after a successful login.
  headers.set('Cache-Control', 'no-store');

  // THE ONLY SOURCE OF THESE TWO HEADERS ON AN API RESPONSE TODAY — BOTH OF
  // THEM. Do not read this line as "belt and braces" against `src/proxy.ts`:
  // `src/proxy.ts` does set `X-Content-Type-Options`, but the wrapper must not
  // rely on that, and the comment that previously claimed this set was
  // "redundant by design" was FALSE (the matcher contained an `api/` term that,
  // read as the regex it is, excluded nothing and silently left every API
  // response without the proxy's headers too — the full explanation is in the
  // `config.matcher` comment in `src/proxy.ts`).
  //
  // The wrapper is the one thing a route cannot opt out of: the moment the
  // matcher is edited, every route silently loses `nosniff`, and without it a
  // non-JSON API response can be sniffed into `text/html` and executed in this
  // site's origin. Keep this as a BACKSTOP that must not be removed, and do not
  // treat it as duplication of a guarantee made anywhere else.
  headers.set('X-Content-Type-Options', 'nosniff');

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * The single entry point every App Router route handler in this migration goes
 * through.
 *
 * THE INVARIANT THIS MODULE EXISTS TO ENFORVE:
 * **a route that does not go through `apiRoute` has no CSRF check, no error
 * shaping and no security headers, and a route that goes through it without
 * explicitly saying `public: true` is AUTHENTICATED.** Each of those is cheap to
 * forget and expensive to discover later — a hand-rolled
 * `export async function POST(request)` that reads a cookie, calls a controller
 * and returns `NextResponse.json(...)` looks entirely correct in review and
 * silently ships all three gaps. So the wrapper owns the ORDER and the route
 * author owns only the business logic.
 *
 * AUTH IS THE DEFAULT; `public: true` IS THE ONLY WAY OUT. This is inverted from
 * the opt-in `auth: true` flag it replaces, and the reason is which mistake is
 * likely. "A route that does not use the wrapper" is caught by convention and by
 * review. "A route that uses the wrapper and forgets `auth: true`" is caught by
 * NOTHING: it compiles, it passes a smoke test that exercises the happy path with
 * a valid session, and it ships a live unauthenticated endpoint that reads and
 * writes real data — so the old default was the dangerous one. Under this shape
 * forgetting the flag is impossible (the flag no longer exists), and opening a
 * route by accident is replaced by typing `public: true`, which is visible in
 * review and, if it contradicts the rest of the config, is REJECTED AT MODULE
 * LOAD below rather than discovered on a live request.
 *
 * `public: true` MUST BE DELIBERATE AND JUSTIFIED IN THE ROUTE'S OWN COMMENT: it
 * asserts the endpoint is meant to be anonymous, and the only review question
 * that matters is "why". `public: true` on a route that then does something
 * per-user is a data-disclosure bug, not a style issue.
 *
 * THE ORDER IS LOAD-BEARING and mirrors the middleware chain the Express
 * `app.js` produced per route:
 *
 *   1. OVERSIZED-BODY GATE — `Content-Length` is read and rejected BEFORE
 *      anything buffers the body. This has to be first: an oversized multipart
 *      upload costs ~35–40 MB of instance heap once `formData()` runs, and on a
 *      2 GB instance roughly 50 concurrent uploads OOM-kill every co-resident
 *      function. Doing it here, rather than only inside the upload handler, is
 *      what makes it impossible for a route author to forget.
 *   2. CSRF (`assertSameOrigin`) — before any credential is read, so a
 *      cross-site request never reaches the point where it could act as the
 *      user. Header-only, so it costs nothing.
 *   3. RATE LIMITING — before the expensive work (a DB lookup, a Cloudinary
 *      call), because preventing that work is the point. The body is read ONCE,
 *      here, via `readBody`, and the already-parsed value is what the key
 *      generator sees (see the ordering hazard in `createRateLimiter`). This
 *      step can only key on the CLIENT (ip, body, headers) because at this
 *      point nothing has been authenticated.
 *   4. AUTHENTICATION — after limiting, so an unauthenticated flood is stopped
 *      before it costs a `User.findById` per request.
 *   5. ADMIN AUTHORISATION — after authentication, because it needs the
 *      authenticated role. `requireAdminAction` derives its routing context from
 *      the pathname internally, so no caller can hand it a resource it should
 *      not have.
 *   6. PER-USER RATE LIMITING (`userLimiter`, opt-in) — see its own note at the
 *      call site for why it cannot be step 3, and why it sits after step 5
 *      rather than before it.
 *   7. HANDLER — the only part a route author writes.
 *   8. ENVELOPE SERIALISATION, 9. ERROR SHAPING, 10. `Cache-Control: no-store`,
 *      11. SECURITY HEADERS, 12. COOKIE APPLICATION — all in `finalizeResponse`,
 *      shared by the success and the throw path.
 *
 * @param {object}   config
 * @param {Function} config.handler   `(ctx, request, routeContext) => …`. The
 *                                    `Request` and Next's `{ params }` are
 *                                    FORWARDED verbatim from the arguments
 *                                    below — `createShim` needs the real one-shot
 *                                    body stream and the dynamic segments, and
 *                                    neither can be reconstructed from `ctx`.
 * @param {Function} [config.limiter] rate limiter, invoked with the built context
 *                                    BEFORE authentication, keyed on client
 *                                    identity (`ip`, `body`, `headers`)
 * @param {Function} [config.userLimiter]
 *                                    a second limiter, invoked AFTER
 *                                    authentication and admin authorisation with
 *                                    the SAME context plus `ctx.user`, for
 *                                    limits that must be keyed on the
 *                                    authenticated principal. See `userUploadRateLimiter`
 *                                    in `rateLimit.js` for the one current use.
 * @param {boolean}  [config.public]  `true` to make the route ANONYMOUS. Omit it
 *                                    (the default) and the route REQUIRES a valid
 *                                    access — or refreshable — token. Every
 *                                    opt-out must be justified in the route file.
 * @param {boolean}  [config.admin]   require an admin action (implies auth, and
 *                                    therefore cannot be combined with `public`)
 * @returns {Function} `(request, routeContext) => Promise<Response>`
 * @throws {TypeError} at module load, not per request, on an ambiguous config
 */
function apiRoute({
  handler,
  limiter,
  userLimiter,
  public: isPublic = false,
  admin = false,
  auth,
}) {
  if (typeof handler !== 'function') {
    throw new TypeError('apiRoute: a handler function is required');
  }

  // `auth` WAS THE OLD OPT-IN FLAG AND IT IS REJECTED, NOT IGNORED. Silently
  // accepting it would be the worst of both worlds: `auth: false` (a route author
  // asking for anonymous access) would quietly become the strictest possible
  // route, and `auth: true` would look like it were doing something when it is
  // now the default. Both are configuration MISTAKES, and a mistake that is
  // caught while the module loads — `next build` — is infinitely cheaper than
  // one that is caught on a live request. The message names the replacement so the
  // fix is obvious.
  if (auth !== undefined) {
    throw new TypeError(
      'apiRoute: the `auth` option was removed — authentication is now the ' +
        'DEFAULT. Delete it to keep the route authenticated, or pass ' +
        '`public: true` (with a justification) to make it anonymous.',
    );
  }

  // `public` MUST BE A BOOLEAN OR ABSENT. This check exists for ONE specific
  // typo, and it is the single remaining fail-OPEN mistake in an otherwise
  // fail-closed design: `public: 'false'` — the string, with the quotes left in
  // by muscle memory from the old `auth` flag, or from any config value that
  // arrives as a string. Every truthiness test downstream then sees a non-empty
  // string, `if (!isPublic)` at step 4 is FALSE, and the route is served to
  // ANONYMOUS callers. Nothing throws, nothing logs, and the route looks
  // correct in review because the text says "false".
  //
  // The other direction (`public: 'true'`, or any string) is fail-open too but
  // is a deliberate opt-out rather than a lie about one, which is why the check
  // rejects the whole class rather than special-casing `'false'`.
  //
  // Rejecting at MODULE LOAD, like the `auth` check above, is the point: a
  // mistake caught while `next build` evaluates the route module is free, and
  // the same mistake caught on a live request is an unauthenticated endpoint in
  // production.
  if (isPublic !== true && isPublic !== false) {
    throw new TypeError(
      'apiRoute: `public` must be a boolean (`true` or `false`) or absent. ' +
        'Got ' +
        JSON.stringify(isPublic) +
        ' — note that `public: "false"` is TRUTHY and would silently make the ' +
        'route anonymous.',
    );
  }

  // A route cannot be both anonymous and admin-gated. Which half would win
  // depends on the order the branches happen to be written in, so instead of
  // picking one, the combination is rejected at module load: it is always a
  // copy-paste slip, and a slip must never resolve to "the route is public".
  if (isPublic && admin) {
    throw new TypeError(
      'apiRoute: `public: true` cannot be combined with `admin: true` — an ' +
        'admin-gated route is authenticated by definition. Remove one of them.',
    );
  }

  // `userLimiter` ON A PUBLIC ROUTE IS REFUSED, NOT IGNORED. It is evaluated only
  // after `verifyToken`, so on a public route it would never receive a
  // `ctx.user` and would silently fall back to the IP key — becoming a second
  // copy of the pre-auth `limiter` with a different window, which is a silent
  // weakening of whatever the author believed they had configured. Rejecting it
  // at module load keeps the mistake as cheap as the other two above.
  if (userLimiter && isPublic) {
    throw new TypeError(
      'apiRoute: `userLimiter` cannot be combined with `public: true` — a ' +
        'per-user limit is evaluated after authentication, and a public route ' +
        'never authenticates. Use `limiter` (keyed on the client) instead.',
    );
  }

  if (userLimiter !== undefined && typeof userLimiter !== 'function') {
    throw new TypeError(
      `apiRoute: \`userLimiter\` must be a limiter function, got ${typeof userLimiter}`,
    );
  }

  return async function routeHandler(
    request,
    // The second argument is Next's per-route context (`{ params }`). It is
    // forwarded to `handler` UNCHANGED and nothing else: the foundation derives
    // every routing fact it needs from `request` alone (see `pathnameOf`), so it
    // must not branch on the route context. `defineRoute`'s handler closes over
    // nothing — it receives this by parameter — which is what makes a warm
    // instance's concurrent requests independent (see `handler.js`).
    routeContext,
  ) {
    // Captured outside the try so the cookie survives an error raised later —
    // see the step-11 note in `finalizeResponse`.
    let refreshCookie = null;

    try {
      // Step 1 — cheap, header-only rejection of an oversized body.
      assertBodySizeWithinLimit(request);

      // Step 2 — CSRF, before any credential is consulted.
      assertSameOrigin(request);

      // Step 3 — rate limiting, with the body read exactly once. An upload route
      // passes `multipart/form-data`, which `readBody` deliberately does not
      // consume (it would eat the stream the handler needs), so the limiter's key
      // generator sees `body: null` and falls back to the IP key. That is the
      // correct key for `uploadRateLimiter` anyway.
      //
      // A body that FAILS TO PARSE must not bypass the limiter. `readBody`
      // rejects on malformed JSON, and letting that propagate here would turn
      // the rate-limited endpoint into a 500 oracle that an attacker can trigger
      // with a single truncated byte — and, worse, would let a flood of
      // unparseable bodies consume no quota at all. The error is left cached on
      // the request (it is the same promise), so the handler still sees it and
      // reports it; the limiter simply falls back to the per-IP key, which is
      // exactly what `registrationEmailRateLimiter`'s own key generator documents
      // for malformed input.
      let body = null;
      if (limiter) {
        try {
          body = await readBody(request);
        } catch (parseError) {
          reportParseFailure(limiter, parseError);
        }
      }

      const ctx = buildRateLimitContext(request, body);

      if (limiter) {
        const decision = limiter(ctx);

        if (!decision.allowed) {
          // `rateLimitResponse` reproduces the Express 429 body and the
          // `Retry-After` header in seconds exactly; it is a `Response`, so it
          // flows through the same `finalizeResponse` as everything else and
          // still gets `no-store` and `nosniff`.
          return await finalizeResponse(
            rateLimitResponse(decision),
            refreshCookie,
          );
        }
      }

      // Steps 4 and 5 — authentication, then per-action admin authorisation.
      // The condition is `!isPublic`, not `auth || admin`: authentication is the
      // default and `public: true` is the only opt-out (see the invariant above),
      // so anything that is not explicitly public must be authenticated. An
      // `admin: true` route is covered by this without a second clause — the
      // role check needs an authenticated principal anyway.
      if (!isPublic) {
        const result = await verifyToken(request);
        ctx.user = result.user;
        refreshCookie = result.refreshCookie;

        if (admin) {
          requireAdminAction(result.user, {
            method: request.method,
            pathname: pathnameOf(request),
          });
        }
      }

      // Step 6 — PER-USER RATE LIMITING, opt-in and deliberately AFTER
      // authentication and admin authorisation.
      //
      // WHY IT CANNOT BE STEP 3. The `limiter` above runs before `verifyToken`,
      // so the only identity available to its `keyGenerator` is the client's.
      // Keying an upload limit per USER requires a verified user id, and there is
      // no honest way to get one earlier: reading the id out of an UNVERIFIED
      // JWT claim would let an attacker present a random `_id` and receive a
      // fresh bucket per request, which is not a rate limit at all. Waiting for
      // `verifyToken` is the only correct point.
      //
      // WHY IT IS AFTER `requireAdminAction` AND NOT BEFORE IT. A request that
      // is going to be refused with a 403 never reaches the handler and never
      // costs a Cloudinary call, so charging it against the caller's upload
      // budget would penalise them for something they could not have done. The
      // budget is spent only by requests that actually reach the work.
      //
      // The SAME `ctx` object is passed, so a `userLimiter`'s `keyGenerator`
      // sees everything the ordinary `limiter` sees PLUS `ctx.user`. It gets
      // its own `Retry-After` and the same 429 envelope, because it is the same
      // `rateLimitResponse` — a client cannot tell which of two limits fired
      // except by the message, which is why each limiter carries a distinct one.
      //
      // A `public: true` route can never reach this: `ctx.user` is only assigned
      // inside the `!isPublic` branch above, so `userLimiter` on a public route
      // would key on the IP fallback. That combination is a configuration
      // mistake, so it is refused at module load below rather than silently
      // degrading into a second copy of the pre-auth limiter.
      if (userLimiter) {
        const userDecision = userLimiter(ctx);

        if (!userDecision.allowed) {
          return await finalizeResponse(
            rateLimitResponse(userDecision),
            refreshCookie,
          );
        }
      }

      // Step 7 — the route author's business logic.
      //
      // `request` AND `routeContext` ARE FORWARDED VERBATIM, as parameters, and
      // that is the whole reason this is a plain call rather than an ambient
      // lookup. Both are per-invocation values that only exist here, inside
      // `routeHandler`'s own parameters; a warm instance runs many invocations
      // CONCURRENTLY, so any module-level "current request" slot would race and
      // hand one route another route's body. Passing them as arguments makes
      // that failure structurally impossible rather than merely unlikely: the
      // only way `handler` can see a `Request` is the one this invocation was
      // given. (`handler.js` therefore takes them as ordinary parameters and
      // needs no async-context bridge at all.)
      return await finalizeResponse(
        await handler(ctx, request, routeContext),
        refreshCookie,
      );
    } catch (error) {
      // Step 8 — anything thrown in 1–6 becomes the `{ status, message, errors? }`
      // envelope the frontend already parses. Without this, a controller's
      // `throw new Error('...')` becomes Next's HTML error page, which the API
      // client cannot read at all.
      try {
        return await finalizeResponse(toErrorResponse(error), refreshCookie);
      } catch (finalizeError) {
        // =============================================================
        // LAST LINE OF DEFENCE. If the error path ITSELF throws, the
        // exception escapes `apiRoute` and Next serves its HTML error
        // page — exactly the outcome this wrapper exists to prevent.
        //
        // IT IS NOT HYPOTHETICAL. `finalizeResponse` can fail in at
        // least three concrete ways:
        //   - `toErrorResponse` builds a `{ status, body }` pair and
        //     `Response.json` throws on a non-numeric `ResponseInit.status`
        //     (a `RangeError`) — e.g. a hand-built error carrying
        //     `status: 'unauthorised'`;
        //   - `JSON.stringify` on the error body THROWS for a circular
        //     payload, which a controller can produce by returning an
        //     object that references itself;
        //   - `applyAuthCookie` awaits `cookies()` from `next/headers`,
        //     which throws outside a request scope (and can throw for a
        //     cookie option Next rejects).
        // `withApiHeaders` removes the immutable-headers variant of this
        // (see its docblock) but cannot remove the other three.
        //
        // WHAT IT DELIBERATELY DOES NOT COVER, and why that is the right
        // boundary:
        //   - It does NOT re-attempt the original error shaping. Doing so
        //     would loop back through the code that just failed.
        //   - It does NOT guarantee the refreshed auth cookie is applied.
        //     A failure here happens on the error path, where dropping the
        //     cookie costs the user one re-login at worst — strictly
        //     better than a 500 HTML page they cannot parse.
        //   - It does NOT surface the real cause to the client. The
        //     original `error` is logged at `error` level; the client gets
        //     a fixed 500 envelope. Anything else re-leaks internals.
        // It is a floor, not a replacement for `finalizeResponse` working.
        // =============================================================
        console.error(
          'apiRoute: the error path itself failed; returning a bare 500:',
          finalizeError?.message ?? finalizeError,
        );

        // Hand-built rather than via `toResponse`/`Response.json`, because
        // both of those are exactly what may have just thrown. The body is a
        // fixed literal, so nothing here can fail to serialise.
        return new Response(
          JSON.stringify({ status: 500, message: 'Internal Server Error' }),
          {
            status: 500,
            headers: {
              'Content-Type': 'application/json; charset=utf-8',
              // Re-stated here even though `withApiHeaders` normally sets them:
              // this path deliberately does NOT go through `withApiHeaders`, and
              // these two are the guarantees a client is entitled to from ANY
              // response this API produces, including the last-ditch one.
              'Cache-Control': 'no-store',
              'X-Content-Type-Options': 'nosniff',
            },
          },
        );
      }
    }
  };
}

/**
 * Last-time-logged state per rate limiter, keyed by the limiter FUNCTION itself.
 *
 * A `WeakMap` keyed on the function is used rather than a limiter-name string
 * because the limiter is the only identity available at the call site, and a
 * `WeakMap` additionally guarantees the entry disappears with the limiter —
 * there is no unbounded map to reason about on a long-lived warm instance.
 */
const parseFailureLogState = new WeakMap();

/**
 * Minimum gap between two "body failed to parse" lines for the SAME limiter.
 *
 * ONE MINUTE. Long enough that a flood of 10k malformed bodies produces a handful
 * of lines instead of 10k; short enough that an operator watching a live
 * incident still sees a steady heartbeat rather than one line and silence.
 */
const PARSE_FAILURE_LOG_INTERVAL_MS = 60 * 1000;

/**
 * Reports an unparseable request body, THROTTLED per limiter.
 *
 * THE RATE-LIMIT DECISION IS STILL TAKEN — this only decides whether the
 * failure is worth a log line. The limiter has already been (or is about to be)
 * consulted, so suppressing the log does not open a bypass; it only removes the
 * attacker's free log volume.
 *
 * WHY THROTTLING IS REQUIRED, NOT POLISH. This line is reachable by an
 * UNAUTHENTICATED client on every rate-limited route, at whatever rate the
 * limiter itself allows, by sending one truncated byte. Unthrottled, a single
 * request flood produces one billed log line per request: on Vercel that is
 * charged log volume generated by the attacker, and — worse for debugging — it
 * buries the handful of real errors an operator is looking for. An operator
 * signal that an attacker can amplify at will is not a signal.
 *
 * The throttle counts what it suppressed and reports the total when the window
 * reopens, so a suppressed storm is still VISIBLE (as "N further failures
 * suppressed") rather than being silently dropped. That keeps the diagnostic
 * value while capping the cost.
 *
 * @param limiter     the limiter function whose key space saw the failure
 * @param parseError  whatever `readBody` rejected with
 */
function reportParseFailure(limiter, parseError) {
  const now = Date.now();
  const state = parseFailureLogState.get(limiter);
  const message = parseError?.message ?? String(parseError);

  if (state && now - state.lastLoggedAt < PARSE_FAILURE_LOG_INTERVAL_MS) {
    state.suppressed += 1;
    return;
  }

  if (state?.suppressed) {
    console.error(
      `Rate limit body parse failed: ${message} (${state.suppressed} further failure(s) suppressed in the last ${PARSE_FAILURE_LOG_INTERVAL_MS / 1000}s)`,
    );
  } else {
    console.error('Rate limit body parse failed:', message);
  }

  parseFailureLogState.set(limiter, { lastLoggedAt: now, suppressed: 0 });
}

/**
 * The request pathname. `nextUrl` is a `NextRequest` extension and is absent
 * from a plain `Request`; falling back to parsing `url` keeps this usable in both
 * a Route Handler and a plain-`Request` test.
 */
function pathnameOf(request) {
  return request?.nextUrl?.pathname || new URL(request.url).pathname;
}

export {
  apiRoute,
  finalizeResponse,
  // Exported for tests: the immutability behaviour it exists to work around
  // (a `Response.redirect()` / `Response.error()` response cannot have its
  // headers mutated) is not observable from the outside without calling it.
  withApiHeaders,
  toResponse,
};
