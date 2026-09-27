import 'server-only';

import { getDb } from '@/lib/server/db';
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
 *       handler: async (ctx, request, routeContext) => {
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
 *    (`http.js:384,388,446,508,518`). The closure placement is load-bearing: it is
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
 * WHERE THE `Request` AND THE ROUTE CONTEXT COME FROM, AND WHY THEY ARE NOT
 * LOOKED UP AMBIENTLY.
 *
 * `ctx` alone is NOT enough to run a ported controller. `ctx` is
 * `buildRateLimitContext(request, body)` plus `ctx.user`, i.e.
 * `{ ip, body, headers, userAgent, method, path, user }`; it deliberately does
 * NOT carry the `Request` or `{ params }`, and it cannot: `body` is only
 * populated when a limiter exists, and no field can stand in for a one-shot body
 * stream or for the dynamic segments. `createShim` needs both — it calls
 * `readMultipart(request)` / `readBody(request)`, which need the real stream, and
 * it reads `options.params`.
 *
 * They are therefore ORDINARY PARAMETERS. `apiRoute` has both in scope — they
 * ARE its own `routeHandler(request, routeContext)` parameters — and forwards
 * them: `await handler(ctx, request, routeContext)`.
 *
 * THIS IS NOT COSMETIC. A single warm function instance serves requests
 * CONCURRENTLY, so a module-level "current request" variable — the obvious
 * cheaper-looking alternative — races: two in-flight requests share one slot and
 * a controller can be handed ANOTHER request's body. This module previously
 * bridged the values through an `AsyncLocalStorage` store for that reason. Plain
 * parameters remove the hazard at the root rather than managing it: the only way
 * `runController` can see a `Request` is the one its own invocation was given,
 * because it is an argument to that call and nothing else can substitute for it.
 * There is no store to initialise, no store to leak across an `await`, and no
 * fail-loud guard needed for a store that a correct call site always populates.
 */

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
 * WHY `method` IS THE FIRST POSITIONAL ARGUMENT AND NOT A `config` PROPERTY.
 * The App Router registers a route under its EXPORT NAME, not under anything the
 * route file declares — `export const GET = defineRoute(…)` is a `GET` endpoint
 * because the binding is called `GET`. A `method` property sat two lines below the
 * export name, so a copy-paste that carried a `GET` handler into a file whose
 * export is `POST` produced a route that registered as `POST`, ran a `GET`
 * controller, and passed the per-request assertion below — because the assertion
 * compared the DECLARED method against the arriving request, and a caller
 * hitting the `POST` export arrives with `POST`. The declared `'GET'` and the
 * observed `'POST'` were never compared. Putting the method in the argument
 * position puts it on the SAME LINE as the export name, so a mismatch is visible
 * in review rather than only at runtime.
 *
 * @param {string}   method            the HTTP method this route is registered
 *                                      under, upper-case, matching the export
 *                                      name it is assigned to. Used for the
 *                                      assertion and for diagnostics ONLY;
 *                                      never for access control
 * @param {object}   config
 * @param {Function} config.controller  the ported `(req, res)` Express handler
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
function defineRoute(method, config) {
  // A MISSING CONFIG IS CHECKED EXPLICITLY rather than left to the destructuring
  // pattern below. Destructuring `undefined` throws `TypeError: Cannot
  // destructure property 'controller' of 'undefined'`, which points at this
  // function's own internals and says nothing about the caller's mistake.
  // `defineRoute('GET')` is a half-finished edit or a missing brace in a route
  // file, and like every other configuration mistake here it is cheapest to catch
  // while the module is being evaluated during `next build`.
  if (typeof config !== 'object' || config === null) {
    // THE OLD SHAPE IS NAMED EXPLICITLY, because a route file still written as
    // `defineRoute({ method: 'GET', … })` passes its config object as the METHOD
    // and arrives here with nothing in the second position. That is the exact
    // failure a half-finished migration of the 53 route files produces, and
    // without this branch the author would be told only that a config object was
    // missing — with the offending object, and the correct call, printed nowhere
    // near it. The object is NOT stringified here: a config may carry a
    // controller function and a limiter, and a function is not JSON.
    if (typeof method === 'object' && method !== null) {
      throw new TypeError(
        'defineRoute: `method` is now the FIRST POSITIONAL ARGUMENT. This call ' +
          'passes a config object as the method, which is the OLD ' +
          "`defineRoute({ method: '…', … })` signature. Rewrite it as " +
          "`defineRoute('GET', { … })` — the method must match the export name " +
          'it is assigned to.',
      );
    }

    throw new TypeError(
      'defineRoute: the second argument must be a config object, e.g. ' +
        "`defineRoute('GET', { controller })`. Got " +
        (config === undefined ? 'nothing.' : `${JSON.stringify(config)}.`),
    );
  }

  const {
    controller,
    auth,
    public: isPublic = false,
    admin = false,
    limiter,
    userLimiter,
    fileField,
    maxFiles,
    rejectMultipart = false,
  } = config;

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

  const composedLimiter = composeLimiters(limiter);

  // Composed through the SAME factory as `limiter`, so a list of per-user
  // limiters gets identical validation and identical first-denial-wins
  // semantics, and so a single one is passed through unwrapped (preserving the
  // limiter-function identity `http.js`'s parse-failure `WeakMap` keys on).
  const composedUserLimiter = composeLimiters(userLimiter);

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
   * Called by `apiRoute` as step 7, i.e. AFTER the body-size gate, CSRF, rate
   * limiting, authentication and admin authorisation. Nothing here may
   * re-implement any of those.
   *
   * `request` and `routeContext` are the invocation's OWN values, received as
   * parameters from `apiRoute`'s forwarded call. They are not looked up from any
   * ambient or module-level state, so two concurrent invocations of this route —
   * or of two different routes — cannot see each other's request. See the module
   * docblock above.
   *
   * There is deliberately NO try/catch: a controller's `throw` must reach
   * `apiRoute`'s catch so `toErrorResponse` shapes it into the envelope the
   * frontend parses. Catching here would turn a controller 400 into a 200 with a
   * `null` body.
   */
  async function runController(ctx, request, routeContext) {
    // ==========================================================================
    // OPEN THE DATABASE CONNECTION BEFORE ANY CONTROLLER RUNS
    // ==========================================================================
    // PLACEMENT, AND WHY IT IS HERE AND NOT IN `apiRoute`. `apiRoute` is the
    // lower wrapper, and putting the connect in its step 7 would be the more
    // obvious-looking place to fix this. It would be WRONG, because
    // `src/app/api/v1/route.js` — the `GET /api/v1` health probe — calls
    // `apiRoute` DIRECTLY (`route.js:47-54`) and deliberately bypasses
    // `defineRoute`, because its body is a raw `text/html` string that
    // `createShim`'s `collect.result()` cannot produce. A connect in `apiRoute`
    // would therefore make the health probe depend on Mongo being reachable —
    // i.e. it would go red exactly when the database is down, which is the one
    // moment a health probe exists to stay green. The rule this encodes is
    // narrow and worth stating as such: CONTROLLERS NEED THE DATABASE; THE
    // HEALTH PROBE DOES NOT AND MUST NOT BE COUPLED TO IT.
    //
    // `runController` is reached ONLY through `defineRoute` (`handler.js:464`),
    // which is by construction the set of routes that run a ported
    // `(req, res)` controller. Every one of those controllers, or a service it
    // calls, reads or writes Mongoose, so this is the correct blast radius: the
    // whole database surface and nothing outside it.
    //
    // A SECOND, FREE CONSEQUENCE OF THE SAME PLACEMENT, worth knowing so nobody
    // later "optimises" the connect up into `apiRoute`: `runController` is
    // `apiRoute`'s step 7, so every earlier short-circuit — the oversized-body
    // gate, CSRF, a rate-limit 429, an authentication 401, an admin 403 — is
    // answered WITHOUT opening a connection. An unauthenticated flood is
    // rejected by the auth step and never reaches Mongo at all.
    //
    // WHY THE CONNECT IS HERE AND NOT AT THE TOP OF `defineRoute`: it is
    // per-INVOCATION state, not per-MODULE state, and route modules ARE
    // evaluated during `next build` — that is exactly where the module-load
    // configuration assertions above fire. A module-scope connect would
    // therefore run at build time, with no production secrets in the build
    // environment, and would fail the build of every route in the app.
    //
    // WHY IT MUST BE AN EXPLICIT AWAIT AND NOT `mongoose.connect().then(...)`:
    // Mongoose does not fail fast when it has no connection — it BUFFERS the
    // command and rejects only after the default 10 s `bufferTimeoutMS`. Every
    // request would therefore hang for ten seconds and 500 with a misleading
    // `MongooseError: Operation ... buffering timed out after 10000ms` before a
    // single query ran. Awaiting the real connection converts that into an
    // honest `serverSelectionTimeoutMS` connect failure (8 s, set in
    // `db.js:47-50`) on the FIRST request instead of a phantom per-query hang.
    // The response shape, status code and error envelope are unchanged: this
    // throw lands in `apiRoute`'s catch exactly like the controller's own throw
    // would, and `toErrorResponse` shapes it the same way.
    //
    // `bufferCommands: false` IS DELIBERATELY NOT SET as the fix. It would turn a
    // slow failure into an immediate one and would forfeit the buffering window
    // that lets a cold start succeed while the connect is still in flight.
    //
    // COST: effectively zero. `getDb()` is memoised on `globalThis.__mongoose`
    // (`db.js:18,60-90`), so after the first successful call this is an await on
    // an already-resolved promise — a microtask — and it does NOT open a second
    // connection pool. A rejected connect clears the memo (`db.js:94-100`) so the
    // next invocation retries from a clean slate rather than replaying a
    // poisoned promise, and a `disconnected` event clears it too
    // (`db.js:120-125`).
    //
    // THERE IS NO try/catch, and that is deliberate for the same reason the
    // controller call below has none: a connect failure must reach `apiRoute`'s
    // catch so `toErrorResponse` shapes it into the `{ status, message, errors? }`
    // envelope the frontend already parses. Catching here would produce a bare
    // 500 with no envelope.
    await getDb();

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
    handler: (ctx, request, routeContext) => runController(ctx, request, routeContext),
    limiter: composedLimiter,
    userLimiter: composedUserLimiter,
    public: isPublic,
    admin,
    auth,
  });

  /**
   * The exported route handler.
   *
   * THE METHOD ASSERTION, AND WHY IT IS STILL HERE NOW THAT `method` IS
   * POSITIONAL. Making the method an argument put it on the same line as the
   * export name, which is what makes a copy-paste between two `route.js` files
   * VISIBLE IN REVIEW: `export const POST = defineRoute('GET', { … })` is a
   * contradiction on one line. This assertion remains as the runtime half of the
   * same guard, because a mismatch can also arrive from something review cannot
   * see — a route re-exported through a barrel, a `route.js` that binds the same
   * `defineRoute(...)` result to a second export name, a hand-written request to
   * the wrong verb. Nothing in an ES module can compare a declared method to its
   * own export name at load time (a module cannot enumerate its own exports), so
   * the only remaining comparison is the declared method against the method of
   * the request that actually arrives.
   *
   * IT CONVERTS A SILENT FAILURE MODE INTO A LOUD ONE. A `GET` controller
   * registered as `POST` compiles, builds, and answers `POST` requests by running
   * a read as a write. The assertion makes that a thrown `TypeError` on the very
   * first request, shaped into a 500 by `toErrorResponse`, with a message that
   * names both the declared method and the request's own.
   *
   * `HEAD` IS ACCEPTED ON A `GET` ROUTE, AND THAT EXCEPTION IS REQUIRED. Next
   * auto-derives a `HEAD` handler from every `GET` route and invokes it with
   * `method: 'HEAD'` (`auto-implement-methods.js` in
   * `next/dist/server/route-modules/app-route/`), so a strict equality test
   * would 500 every single GET endpoint in the app on a HEAD probe. `HEAD` is a
   * safe method with no body and the same authorisation as `GET` (see
   * `SAFE_METHODS` in `request.js`), so treating it as `GET` is faithful rather
   * than a loosening.
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

    return inner(request, routeContext);
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
 *
 * The `method` parameter this used to take was DEAD and has been removed. It was
 * read by nothing in the body, and a dead parameter on a function whose whole
 * purpose is to take ONE meaningful input is worse than a missing one: the next
 * reader reasonably assumes the composed limiter keys or branches on the method.
 * It does not, and must not — see the "IT MUST NOT BE USED TO AUTHORISE
 * ANYTHING" note on `defineRoute`.
 */
function composeLimiters(limiter) {
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
