import 'server-only';

import { AsyncLocalStorage } from 'node:async_hooks';

import { ApiError } from '@/lib/server/errors';
import { apiRoute } from '@/lib/server/http';
import { createShim } from '@/lib/server/shim';

/**
 * ============================================================================
 * WHY THIS FILE EXISTS — ONE PLACE WHERE THE COMPOSITION IS DEFINED
 * ============================================================================
 * There are ~44 non-admin endpoints. Written by hand, each `route.js` would
 * have to repeat the same four steps in the same order:
 *
 *     apiRoute({
 *       handler: async (ctx) => {
 *         const { req, res, collect } = await createShim(request, ctx, {
 *           params: routeContext.params,
 *         });
 *         await someController(req, res);
 *         return collect.result();
 *       },
 *       ...
 *     });
 *
 * and every one of those repetitions is a place to forget a security step.
 * `http.js`'s own docblock states the invariant it exists to enforce — "a route
 * that does not go through `apiRoute` has no CSRF check, no error shaping and no
 * security headers" — but the invariant has a gap at the *inner* step: the shim
 * call, and above all the `params` plumbing that decides which dynamic segment
 * a controller reads. `forgottenPasswordHandler` reads `req.params.email`;
 * `updatePostHandler` reads `req.params.id`; `verifyCertificatePublic` reads
 * `req.params.certificateId`. A route that forgets `params: routeContext.params`
 * compiles, passes a smoke test, and 400s on every real request with "Post ID is
 * required" — a 44-place footgun.
 *
 * So each route file is a declarative one-liner, and the wiring below is the
 * ONLY place it is written. A route file states WHAT the endpoint is
 * (its controller, its method, whether it is public) and never HOW.
 *
 * ============================================================================
 * THE COMPOSITION CONTRACT — VERIFIED AGAINST THE FOUNDATION, STATED HERE SO A
 * REVIEWER DOES NOT HAVE TO RE-DERIVE IT
 * ============================================================================
 *
 * 1. `res.cookie()` QUEUES; THE SHIM FLUSHES. `shim.js` deliberately does not
 *    write cookies — a Route Handler's natural output is a BARE `Response`, and
 *    `response.cookies` does not exist on one. `res.cookie()` pushes onto
 *    `collected.cookies`, and `collect.result()` replays them through the same
 *    `next/headers` store via `applyQueuedCookies` (`shim.js:345,537,582`). That
 *    is why `collect.result()` is AWAITED below and why the route returns it:
 *    from Next 15 `cookies()` returns a promise, and a cookie write that is not
 *    awaited before the response is serialised is a write that may never flush.
 *
 * 2. `http.js` KEEPS THE REFRESH COOKIE IN A CLOSURE AND APPLIES IT AFTER.
 *    `verifyToken` RETURNS a `{ name, value, options }` instruction; `apiRoute`
 *    holds it in a `refreshCookie` variable declared BEFORE its `try` and hands
 *    it to `finalizeResponse` on the success path AND the throw path
 *    (`http.js:321,380,391,398`). The closure placement is load-bearing: it is
 *    what lets a refreshed access token survive a handler that throws AFTER
 *    authenticating. Because `finalizeResponse` runs after our handler returns,
 *    the AUTH-LAYER cookie wins over a controller-queued cookie of the same
 *    name — correct, since `verifyToken` validated the token against live
 *    session state moments earlier. The route author passes nothing here and
 *    `createShim`'s `collect.refreshCookie` is always `null`; it is not a second
 *    channel, it is a forward-compatible getter.
 *
 * 3. `adminAuth.js` DERIVES ITS ROUTING CONTEXT INTERNALLY. A route author
 *    NEVER passes `resource` or the mount-relative `path`. `requireAdminAction`
 *    takes only `{ method, pathname }`, derives everything else from
 *    `request.nextUrl.pathname` via `describeAdminRoute` (`adminAuth.js:177,206,
 *    242`), and `apiRoute` supplies both facts itself. This is deliberate: an
 *    earlier version of `adminAuth.js` accepted a caller-supplied `resource`,
 *    which is a fail-OPEN footgun — a route that computed `pathname` correctly
 *    but hardcoded `resource: 'events'` on a `/content/gallery` route would GRANT
 *    a moderator a write, and nothing in the signature would flag it. Nothing
 *    this file builds can reintroduce that, because it has no way to supply a
 *    resource.
 *
 * 4. `toErrorResponse` SHAPES EVERY THROWN ERROR. `apiRoute`'s catch turns any
 *    throw from steps 1–6 into the `{ status, message, errors? }` envelope the
 *    frontend already parses, and its inner catch returns a bare 500 if even
 *    that fails. The route author therefore NEVER writes a try/catch: a
 *    controller's `throw new ApiError(...)` is the whole error story, which is
 *    exactly how `asyncHandler(...).catch(next)` behaved in Express.
 * ============================================================================
 */

/**
 * The HTTP methods Next's App Router accepts as a `route.js` export. Used to
 * reject an unrecognised `method` at module load — a lowercase `'post'` or a
 * typo like `'DELTE'` is a configuration mistake that would otherwise be
 * invisible, because the method is not what registers the route (the EXPORT
 * NAME is) and so a wrong value produces no framework error.
 */
const APP_ROUTER_METHODS = new Set([
  'GET',
  'POST',
  'PUT',
  'PATCH',
  'DELETE',
  'HEAD',
  'OPTIONS',
]);

/**
 * Per-request ambient facts that `apiRoute` does not forward.
 *
 * WHY THIS EXISTS, AND WHY IT IS NOT A PARAMETER — `apiRoute` invokes its
 * handler as `handler(ctx)` (`http.js:391`) and nothing else. `ctx` is
 * `buildRateLimitContext(request, body)` plus `ctx.user`, i.e.
 * `{ ip, body, headers, userAgent, method, path, user }`. It deliberately does
 * NOT carry the `Request` or the route context, and it cannot: `body` is only
 * populated when a limiter exists, and there is no field that can stand in for a
 * one-shot body stream or for `{ params }`.
 *
 * Those two values are nevertheless REQUIRED by the shim — `createShim` calls
 * `readMultipart(request)` / `readBody(request)`, which need the real stream,
 * and it reads `options.params` for the dynamic segments. (The worked example in
 * `shim.js`'s own module docblock shows a handler that closes over `request`
 * and `routeContext`; that example cannot work with the current `apiRoute`
 * signature, which is a stale docblock in a foundation file and is reported
 * rather than edited.)
 *
 * A module-level "current request" variable would be the obvious fix and is
 * WRONG: a single warm function instance serves requests CONCURRENTLY, so two
 * in-flight requests would race on one slot and a controller could be handed
 * another request's body. `AsyncLocalStorage` is the concurrency-safe channel
 * for exactly this, and it is the only correct one available without editing
 * `http.js`. `als.run()` is entered once per invocation and its store is visible
 * to every `await` downstream, including the `await handler(ctx)` inside
 * `apiRoute`.
 *
 * THIS IS A STANDALONE ISLAND BY DESIGN. If a later phase widens `apiRoute` to
 * `handler({ ctx, request, routeContext })`, this module loses its only
 * non-obvious mechanism and becomes a thin, entirely obvious composition —
 * which is the shape it should have. Until then, the store is the bridge.
 */
const requestStore = new AsyncLocalStorage();

/**
 * Declares one App Router route handler from a declarative description of it.
 *
 * `method` IS THE HTTP METHOD THE ROUTE IS FOR. It is used for exactly two
 * things: the assertion below, and a log line on a method mismatch. IT MUST
 * NOT BE USED TO AUTHORISE ANYTHING. "The method drives who may call this" is
 * the tempting and wrong instinct — it was the shape of the Express middleware
 * chain, where a route listed `verifyToken` and `authorizeAdminAction` in a
 * particular position, and reproducing that shape here would re-create the
 * exact silent-authorisation-failure mode `adminAuth.js` documents in detail
 * (a method/path derivation that is wrong in either direction neither throws nor
 * logs). In this composition, access is decided by exactly two inputs:
 * `public` (the default-deny authentication switch owned by `apiRoute`) and
 * `admin` (delegated wholesale to `adminAuth.js`, which derives its own routing
 * context from the pathname). `method` has no influence on either.
 *
 * @param {object}   config
 * @param {Function} config.controller  the ported `(req, res)` Express handler
 * @param {string}   config.method      the HTTP method this route is registered
 *                                      under. Used for the assertion and for
 *                                      diagnostics ONLY; never for access control
 * @param {boolean}  [config.public]    `true` to make the route ANONYMOUS. Every
 *                                      use must be justified in the route file.
 *                                      Omit it (the default) and the route is
 *                                      AUTHENTICATED.
 * @param {boolean}  [config.admin]     require an admin action (implies auth)
 * @param {Function|Function[]} [config.limiter]
 *                                      one rate limiter, or several applied IN
 *                                      ORDER (see `composeLimiters`). Runs
 *                                      BEFORE authentication, so it can only key
 *                                      on client identity.
 * @param {Function|Function[]} [config.userLimiter]
 *                                      as `limiter`, but evaluated AFTER
 *                                      authentication and admin authorisation,
 *                                      with `ctx.user` on the context. Use it
 *                                      for limits that must be per ACCOUNT
 *                                      rather than per address — see
 *                                      `userUploadRateLimiter` in `rateLimit.js`
 *                                      for why the member-facing upload routes
 *                                      need this and the admin one does not.
 *                                      `public: true` + `userLimiter` is refused
 *                                      at module load by `apiRoute`.
 * @param {string}   [config.fileField] the ONE multipart field to treat as the
 *                                      upload. Reproduces multer's field FILTER
 *                                      — `upload.single('image')` and
 *                                      `upload.array('media', 20)` both filter
 *                                      to their named field, so a route that
 *                                      mounts either one passes this. Omitting it
 *                                      collects every file part, which is
 *                                      correct only for a single-file consumer.
 * @param {number}   [config.maxFiles]  documentary only — see the warning below
 * @param {boolean}  [config.rejectMultipart]
 *                                      reject a `multipart/form-data` body
 *                                      outright, reproducing `upload.none()`.
 *                                      Used by exactly one route (`login`).
 * @returns {Function} `(request, routeContext) => Promise<Response>`
 * @throws {TypeError} at MODULE LOAD, not per request, on a bad config
 */
function defineRoute({
  controller,
  method,
  auth,
  public: isPublic = false,
  admin = false,
  limiter,
  userLimiter,
  fileField,
  maxFiles,
  rejectMultipart = false,
}) {
  // Every check below runs while the ROUTE MODULE is being evaluated, i.e.
  // during `next build`. A configuration mistake caught here costs nothing;
  // the same mistake caught on a live request costs an incident.
  if (typeof controller !== 'function') {
    throw new TypeError(
      `defineRoute: \`controller\` must be the ported (req, res) handler, got ${typeof controller}`,
    );
  }

  if (typeof method !== 'string' || !APP_ROUTER_METHODS.has(method)) {
    throw new TypeError(
      `defineRoute: \`method\` must be one of ${[...APP_ROUTER_METHODS].join(', ')} (upper-case), got ${JSON.stringify(method)}`,
    );
  }

  if (
    fileField !== undefined &&
    (typeof fileField !== 'string' || !fileField)
  ) {
    throw new TypeError(
      'defineRoute: `fileField` must be a non-empty multipart field name when present',
    );
  }

  const composedLimiter = composeLimiters(limiter, method);

  // Composed through the SAME factory as `limiter`, so a list of per-user
  // limiters gets identical validation and identical first-denial-wins
  // semantics, and so a single one is passed through unwrapped (preserving the
  // limiter-function identity `http.js`'s parse-failure `WeakMap` keys on).
  const composedUserLimiter = composeLimiters(userLimiter, method);

  /**
   * Bridges the shim to THIS route's controller.
   *
   * DEFINED INSIDE `defineRoute` RATHER THAN AT MODULE SCOPE, and that is
   * load-bearing rather than stylistic: it closes over `controller`, `fileField`
   * and `rejectMultipart`, which are THIS route's configuration. A module-level
   * function cannot see them — they are `defineRoute`'s destructured parameters —
   * and the failure mode is a `ReferenceError` on the first request rather than a
   * load-time error, because an unresolved identifier is NOT a syntax error and
   * `node --check` passes it. Every route would 500 on first contact, which is
   * exactly the class of bug this bridge exists to make impossible.
   *
   * Called by `apiRoute` as step 6, i.e. AFTER the body-size gate, CSRF, rate
   * limiting, authentication and admin authorisation. Nothing here may
   * re-implement any of those.
   *
   * There is deliberately NO try/catch: a controller's `throw` must reach
   * `apiRoute`'s catch so `toErrorResponse` shapes it into the envelope the
   * frontend parses. Catching here would turn a controller 400 into a 200 with a
   * `null` body.
   */
  async function runController(ctx) {
    const store = requestStore.getStore();

    // Only reachable if the returned function is invoked without going through the
    // `requestStore.run(...)` wrapper — i.e. a test that calls the inner handler
    // directly. Failing loudly is better than handing a controller an empty store
    // and letting it read `req.body` as `null`.
    if (!store) {
      throw new TypeError(
        'defineRoute: no request context. The handler must be invoked as ' +
          '`(request, routeContext)` by Next, not called directly.',
      );
    }

    const { request, routeContext } = store;

    // `upload.none()` REPRODUCTION. In the Express router, `POST /login` ran
    // `upload.none()` BEFORE the rate limiter, and `upload.none()` rejects any
    // multipart body with a `MulterError`. That error matched NONE of the four
    // branches of the Express error handler, so the observable behaviour was a
    // **500** whose body carried multer's own message, `'Unexpected field'`. The
    // intent was never "handle files on login" — it was "a login is JSON, refuse
    // anything else" — and without the check the shim would instead parse the
    // multipart body into `req.body` and let the login SUCCEED, which is a
    // widening of an auth endpoint's accepted content types smuggled in by a
    // migration whose whole premise is that it does not change behaviour.
    //
    // The 500 (rather than a 415) is deliberate fidelity to the original's
    // fall-through. `ApiError` is used rather than a bare `Error` so the message
    // survives `toErrorResponse`'s production redaction; the cost is an `errors:
    // []` key the original 500 branch did not carry, which `errors.js` documents
    // as the one intentional asymmetry between the two 500 shapes.
    if (
      rejectMultipart &&
      (request?.headers?.get('content-type') || '').includes(
        'multipart/form-data',
      )
    ) {
      throw new ApiError(500, 'Unexpected field');
    }

    // `params` IS ALWAYS PASSED, EVEN FOR A ROUTE WITH NO DYNAMIC SEGMENT. It is
    // a promise from Next 15 onward, `createShim` awaits it internally, and on a
    // static route it resolves to `{}` — which is the same thing `req.params` held
    // in Express. Passing it unconditionally is the point of this bridge: eight
    // controllers in this migration read `req.params`, and the failure mode of
    // omitting it is a 400 on every request rather than an error.
    const { req, res, collect } = await createShim(request, ctx, {
      params: routeContext?.params,
      fileField,
    });

    // The controller's own return value is IGNORED. Every ported controller ends
    // with `return res.status(n).json(...)`, and `shim.js`'s `res.json` resolves
    // (rather than returning a `Response`) precisely so this line can be a bare
    // `await` — the route then reads `collect.result()` instead of having to
    // branch on which of four incompatible return shapes it got.
    await controller(req, res);

    // MUST BE AWAITED. It flushes the queued cookies through `next/headers`
    // (`applyQueuedCookies`) and only then returns the `{ status, body }` pair
    // `toResponse` knows how to serialise.
    return collect.result();
  }

  // `maxFiles` CANNOT BE ENFORCED HERE, and pretending otherwise would be the
  // most dangerous kind of documentation. Read out of `shim.js`: `createShim`
  // accepts EXACTLY two options — `{ params, fileField }` — and its
  // `splitFormData` collects every part matching `fileField` with no count
  // ceiling anywhere in the file. `maxFiles` is therefore recorded here for the
  // reader and NOTHING MORE, and a one-time warning is emitted so the value can
  // never be mistaken for an enforced cap. Enforcing it after `createShim` would
  // be theatre: the bytes are already resident, so the rejection would happen
  // after the memory cost it exists to prevent.
  //
  // WHAT ACTUALLY BOUNDS A MULTI-FILE UPLOAD, then, is the platform: Vercel
  // rejects any request body over 4.5 MB with `413
  // FUNCTION_PAYLOAD_TOO_LARGE` at the edge, and `readMultipart` additionally
  // rejects any single file over `MAX_UPLOAD_BYTES` (4 MiB). So `upload.array(
  // 'media', 20)`'s 20-file ceiling is unreachable in practice — a request large
  // enough to hit the file count is rejected for its size first. Reported for
  // the shim to grow, not fixed here.
  if (maxFiles !== undefined) {
    if (!Number.isInteger(maxFiles) || maxFiles < 1) {
      throw new TypeError(
        'defineRoute: `maxFiles` must be a positive integer when present',
      );
    }
    warnUnenforceableMaxFiles(method, maxFiles);
  }

  // `auth` IS FORWARDED VERBATIM, DELIBERATELY, INCLUDING THE `undefined` CASE.
  // `apiRoute` owns the rule ("the `auth` option was removed — authentication is
  // now the DEFAULT") and its message names the replacement, so re-implementing
  // the check here would duplicate a security rule in two places and risk the two
  // messages disagreeing. `auth: false` (a route author asking for anonymous
  // access) must keep failing LOUDLY at module load rather than silently
  // becoming the strictest possible route. `public: true` + `admin: true` is
  // likewise left to `apiRoute`, for the same single-source-of-truth reason.
  const inner = apiRoute({
    handler: (ctx) => runController(ctx),
    limiter: composedLimiter,
    userLimiter: composedUserLimiter,
    public: isPublic,
    admin,
    auth,
  });

  /**
   * The exported route handler.
   *
   * THE METHOD ASSERTION, AND WHY IT IS HERE RATHER THAN AT MODULE LOAD.
   * `method` is the method the author DECLARED; the method the route is
   * REGISTERED under is the export name (`export const POST = …`), and an ES
   * module cannot enumerate its own exports — so the two cannot be compared
   * while the module is being evaluated. What CAN be compared is the declared
   * method against the method of the request that actually arrives, and that is
   * the check below.
   *
   * IT EXISTS BECAUSE OF A SPECIFIC, SILENT FAILURE MODE. Copy-pasting a `GET`
   * handler into a `route.js` whose export is `POST` produces a route that
   * compiles, builds, and returns a clean **405** for the only request anyone
   * makes — a method mismatch with no clue anywhere as to why, and one that
   * looks exactly like a client bug. Worse in the other direction: a handler
   * copied into the WRONG FILE still executes happily over the wrong method. The
   * assertion converts both into a thrown `TypeError` on the very first request,
   * shaped into a 500 by `toErrorResponse` with a message that names both the
   * declared method and the request's own.
   *
   * `HEAD` IS ACCEPTED ON A `GET` ROUTE. Next auto-derives a `HEAD` handler from
   * every `GET` route and invokes it with `method: 'HEAD'`, so a strict equality
   * test would 500 every single GET endpoint in the app. `HEAD` is a safe method
   * with no body and the same authorisation as `GET` (see `SAFE_METHODS` in
   * `request.js`), so treating it as `GET` is faithful rather than a loosening.
   */
  return function routeHandler(request, routeContext) {
    if (
      request.method !== method &&
      !(method === 'GET' && request.method === 'HEAD')
    ) {
      throw new TypeError(
        `defineRoute: this route declares \`method: '${method}'\` but was ` +
          `invoked with ${request.method}. The EXPORT NAME decides the method a ` +
          'route is registered under — check that `export const ' +
          `${method} = …\` matches the controller that was pasted in.`,
      );
    }

    return requestStore.run({ request, routeContext }, () =>
      inner(request, routeContext),
    );
  };
}

/**
 * Accepts one limiter or a list of them and returns the single limiter function
 * `apiRoute` accepts.
 *
 * WHY A LIST IS NEEDED AT ALL. `POST /auth/register` runs TWO limiters with
 * DIFFERENT KEYS and DIFFERENT PURPOSES:
 *
 *   1. `registrationRateLimiter`   — per IP, 100/hour. Caps how much
 *      registration VOLUME one network origin can produce. It is deliberately
 *      generous (a single university NAT was observed to host ~50 students), so
 *      it is a flood control, not a credential control.
 *   2. `registrationEmailRateLimiter` — per TARGET EMAIL, 5/hour. Caps how many
 *      OTPs can be sent to one address. This is the control that actually stops
 *      an attacker hammering a single victim's inbox (and burning the sender's
 *      Resend quota).
 *
 * `createRateLimiter` takes one, and `apiRoute` takes one, so a two-limiter
 * route has to be expressed as a list somewhere. This is that somewhere, and
 * putting it here rather than in the route file is what keeps all ~44 routes from
 * re-implementing the same "which denial wins" question.
 *
 * THE ORDER IS `[per-IP, per-email]`, WHICH IS THE EXPRESS ORDER
 * (`auth.route.js` registered `registrationRateLimiter,
 * registrationEmailRateLimiter, registrationHandler`), AND THE ORDER MATTERS:
 *
 *   - IP FIRST IS THE SPRAY CONTROL. The per-email limiter has `maxKeys:
 *     10000` and evicts its own oldest key when full. If it ran FIRST, an
 *     attacker sending 10,000 distinct emails would drive that eviction, and
 *     because eviction is scoped to `${limiter}:` prefixes it would not touch
 *     the IP counters — but the per-IP limiter would never be consulted at all
 *     for those requests, which is precisely the "cross-limiter" failure
 *     `rateLimit.js` documents in detail. Running IP-first means a flood is
 *     stopped by a control whose key is not attacker-controlled.
 *   - EMAIL SECOND IS THE TARGETED CONTROL, and it is what the honest client
 *     actually trips: a legitimate user retrying registration, or an attacker
 *     targeting one address, clears the 100/hour IP ceiling and is stopped at
 *     5/hour by the second limiter with the email-specific 429 message.
 *   - SWAPPING THEM WOULD CHANGE THE 429 A CLIENT SEES on a flood (the per-email
 *     message once per sprayed address, instead of one per-IP message), which is
 *     an observable API change, not a refactor.
 *
 * SHORT-CIRCUITS, EXACTLY AS EXPRESS DID. Express middleware is a chain: a
 * limiter that returned `next()`-less 429 ended the chain, so the second limiter
 * was never invoked and did not consume a slot. Returning on the FIRST denial
 * reproduces that, which matters because "a rejected request still counts
 * against the per-email budget" would be a silent weakening of the targeted
 * control: a client hammering one address would exhaust its own 5/hour budget
 * faster than the limit describes, and the message would be right while the
 * arithmetic was not.
 */
function composeLimiters(limiter, method) {
  if (limiter === undefined) return undefined;

  const limiters = Array.isArray(limiter) ? limiter : [limiter];

  if (limiters.length === 0) {
    throw new TypeError('defineRoute: `limiter` array must not be empty');
  }

  for (const entry of limiters) {
    if (typeof entry !== 'function') {
      throw new TypeError(
        `defineRoute: every \`limiter\` must be a limiter function from \`@/lib/server/rateLimit\``,
      );
    }
  }

  // The common single-limiter case is passed through UNCHANGED rather than
  // wrapped, so `apiRoute`'s parse-failure log throttle (a `WeakMap` keyed on the
  // limiter function itself) keeps attributing failures to the real limiter, and
  // a stack trace through a one-limiter route stays one frame shorter.
  if (limiters.length === 1) return limiters[0];

  // The composed limiter is memoised per `defineRoute` call — i.e. per route
  // module, evaluated once — so the identity is stable and the `WeakMap` in
  // `http.js` that throttles "body failed to parse" logs is not defeated by a
  // limiter that is a different object on every request.
  return function composedLimiter(ctx) {
    for (const entry of limiters) {
      const decision = entry(ctx);

      if (!decision.allowed) return decision;
    }

    return { allowed: true };
  };
}

/**
 * Emits, once per route module, that `maxFiles` is not enforced.
 *
 * A silent no-op option is worse than a missing one: the next engineer to read
 * `maxFiles: 20` in a route file will reasonably believe the cap holds. The
 * warning is a module-load-time `console.warn` rather than a thrown error
 * because the option is DOCUMENTARY — refusing to load the route would be
 * refusing to serve a working endpoint over a limit the platform already
 * enforces by other means (see the `maxFiles` note in `defineRoute`).
 */
const warnedMaxFiles = new Set();

function warnUnenforceableMaxFiles(method, maxFiles) {
  if (warnedMaxFiles.has(method)) return;

  warnedMaxFiles.add(method);
  console.warn(
    `defineRoute: \`maxFiles: ${maxFiles}\` on the ${method} route is ` +
      'DOCUMENTARY ONLY. `createShim` accepts { params, fileField } and has no ' +
      'file-count ceiling; multi-file requests are bounded by the platform ' +
      '4.5 MB request cap and by MAX_UPLOAD_BYTES per file. See the `maxFiles` ' +
      'note in src/lib/server/handler.js.',
  );
}

export { defineRoute };
