import 'server-only';

import { getClientIp, getUserAgent } from '@/lib/server/request';

/**
 * THE DEFAULT STORE IS NOT A REAL RATE LIMITER ON VERCEL.
 *
 * The port below keeps the original in-memory `Map` so the behaviour is
 * faithful, but be explicit about what that means in production:
 *
 * On Vercel each serverless function instance is a SEPARATE OS process with its
 * own module registry and its own heap. A `Map` lives in that heap. Two requests
 * to `/api/v1/auth/login` are very likely served by two different instances,
 * and neither can see the other's counters. The result is that
 * `loginRateLimiter` (10 / 15 min) and `contactRateLimiter` (3 / min) are
 * effectively UNENFORCED — and they fail SILENTLY: no exception, no error
 * response, no log line, nothing a health check would surface. The handler simply
 * always allows.
 *
 * It also fails in the OPPOSITE direction under a burst: a single warm instance
 * that happens to receive several requests DOES enforce the cap, so the limit
 * appears to work intermittently. That is worse than it never working, because
 * it presents as a flaky auth/contact bug rather than a missing shared store.
 *
 * `setRateLimitStore` is therefore PLUGGABLE. Inject a shared store (Upstash
 * Redis / Vercel KV, reached over their HTTP API) in `production` and the
 * limiters below become real. That is a deliberate later phase — it needs
 * credentials plus a failure-mode decision — so NO Redis dependency is added
 * here. Until then, treat these limits as best-effort and never as the only
 * defence on a credential-guessing endpoint.
 *
 * STORE INTERFACE (what an injected store must implement). Every method takes
 * the LIMITER IDENTITY alongside the key, which is NOT optional bookkeeping —
 * see "PER-LIMITER ISOLATION" below for what breaks without it:
 *
 *   hit({ limiter, key, windowMs, maxKeys }) -> { count, resetAt }
 *       `limiter` is the unique `name` given to `createRateLimiter`.
 *       `windowMs` and `maxKeys` are the calling limiter's configuration. A
 *       store physically cannot return `resetAt` without the window length, so
 *       these are passed in rather than configured on the store. `maxKeys` may
 *       be ignored by a store that bounds its own memory.
 *   reset({ limiter, key }) -> void
 *       Drops one counter. NO CALLER YET — nothing in the foundation resets a
 *       window today, exactly as nothing did in the Express original. It is
 *       declared and validated now so an injected store implements the full
 *       contract from day one and a later "clear the counter after a successful
 *       login / OTP verification" change is an additive one rather than a
 *       breaking interface change.
 *
 * PER-LIMITER ISOLATION IS MANDATORY, NOT COSMETIC. The Express original
 * created a SEPARATE `Map` inside `createRateLimiter`, so each of the seven
 * limiters owned a private counter store. Hoisting one module-global store — the
 * obvious refactor, and the one this file originally shipped — silently merged
 * all seven key spaces into one and produced two distinct security failures that
 * neither throws nor logs, so neither showed up in a test:
 *
 *  1. WINDOW COLLISION. `resetAt` is written by whichever limiter created the
 *     entry, and it is that entry's `resetAt` that decides when the window ends.
 *     With a merged store and 6 of 7 limiters keyed on the bare `ctx.ip`, a POST
 *     to `/contact` (60 s window) followed by a POST to `/login` leaves the LOGIN
 *     counter governed by a 60 s window — turning "10 per 15 minutes" into
 *     roughly "10 per minute", a ~15x weakening of the credential-guessing
 *     control, with the limiter still reporting itself as configured correctly.
 *
 *  2. CROSS-LIMITER EVICTION. `maxKeys` was documented and scoped as a property
 *     of the email limiter's OWN map, so on a merged store the eviction of
 *     "the oldest key" removes the oldest entry in the shared map REGARDLESS OF
 *     WHICH LIMITER OWNS IT. Spraying 10,000 distinct emails at the registration
 *     endpoint evicts every live per-IP counter in the process — including
 *     `loginRateLimiter`'s — which is an attacker-controlled bypass of the login
 *     limit requiring no clever payload, just volume.
 *
 * The fix is that every key is namespaced `${name}:${key}` and eviction scans only
 * the calling limiter's own prefix, with a per-limiter live count driving the
 * `maxKeys` check. `maxKeys` therefore means "at most this many keys for THIS
 * limiter", not "this many keys in total", which is what the original per-limiter
 * `Map` meant.
 */
function memoryStore() {
  const requests = new Map();
  // Live key count per limiter, so the `maxKeys` check is O(1) and scoped to one
  // limiter rather than counting every limiter's keys together.
  const keyCounts = new Map();
  // Smallest window any limiter has asked about so far. Drives the sweep
  // cadence: sweeping at the FINEST known window guarantees the coarsest
  // limiter still reclaims on time, and is a strict improvement on the previous
  // "at most once per the current caller's windowMs" which let a 1-minute caller
  // decide when a 15-minute caller swept.
  let finestWindowMs = Infinity;
  let lastSweep = Date.now();

  function trackKey(limiter) {
    keyCounts.set(limiter, (keyCounts.get(limiter) || 0) + 1);
  }

  function untrackKey(limiter) {
    const next = (keyCounts.get(limiter) || 1) - 1;
    if (next > 0) keyCounts.set(limiter, next);
    else keyCounts.delete(limiter);
  }

  function fullKey(limiter, key) {
    return `${limiter}:${key}`;
  }

  return {
    hit({ limiter, key, windowMs, maxKeys = Infinity }) {
      const now = Date.now();

      if (windowMs < finestWindowMs) finestWindowMs = windowMs;

      // Periodic sweep of expired windows, as in the original. A single store
      // instance is shared by all limiters, so the sweep is global; it only ever
      // removes entries that are ALREADY expired, so a coarser cadence would
      // affect memory, never correctness.
      if (now - lastSweep >= finestWindowMs) {
        for (const [sweepKey, tracked] of requests) {
          if (tracked.resetAt <= now) {
            requests.delete(sweepKey);
            untrackKey(tracked.limiter);
          }
        }
        lastSweep = now;
      }

      const namespaced = fullKey(limiter, key);
      const tracked = requests.get(namespaced);

      if (!tracked || tracked.resetAt <= now) {
        // Bound memory when the limiter is keyed on client-controlled input:
        // drop that limiter's OLDEST key before adding a brand-new one, so the
        // limiter can never track more than maxKeys keys (a Map preserves
        // insertion order). The scan is restricted to the `${limiter}:` prefix —
        // see failure mode 2 above, where an unprefixed oldest-key eviction
        // would let one limiter delete another limiter's live counters and
        // hand the attacker a free reset.
        if (
          !tracked &&
          Number.isFinite(maxKeys) &&
          (keyCounts.get(limiter) || 0) >= maxKeys
        ) {
          const prefix = `${limiter}:`;

          for (const candidate of requests.keys()) {
            if (!candidate.startsWith(prefix)) continue;
            const victim = requests.get(candidate);
            requests.delete(candidate);
            if (victim) untrackKey(victim.limiter);
            break;
          }
        }

        const fresh = { count: 1, resetAt: now + windowMs, limiter };
        requests.set(namespaced, fresh);
        trackKey(limiter);
        return fresh;
      }

      tracked.count += 1;
      return tracked;
    },

    reset({ limiter, key }) {
      const namespaced = fullKey(limiter, key);
      const tracked = requests.get(namespaced);
      if (!tracked) return;

      requests.delete(namespaced);
      untrackKey(tracked.limiter);
    },
  };
}

/** Process-local store. See the Vercel warning above before relying on it. */
let rateLimitStore = memoryStore();

/**
 * Injection point for a shared store. Call once per warm instance (e.g. at the
 * top of a route handler module) with a store implementing the interface above.
 *
 * A falsy value RESETS to the default in-process store rather than assigning it.
 * Assigning `undefined` would leave every limiter dereferencing
 * `undefined.hit(...)` and turn every rate-limited route into a 500.
 *
 * BOTH interface methods are validated, and a store missing EITHER one is
 * rejected with a thrown `TypeError` rather than silently swapped for the
 * in-process store. (The previous version only checked `hit` and quietly
 * substituted `memoryStore()` when `reset` was absent, while its own docblock
 * claimed such a store "is rejected up front" — a comment that was false and
 * would have let an injected store appear to work while its `reset` never ran.)
 * Throwing at INJECTION time is correct even though a limiter outage fails open:
 * injection happens once at boot, under our control, so a broken store is a
 * deployment mistake to be surfaced loudly rather than a runtime blip to be
 * absorbed.
 */
function setRateLimitStore(store) {
  if (store) {
    for (const method of ['hit', 'reset']) {
      if (typeof store[method] !== 'function') {
        throw new TypeError(
          `setRateLimitStore: store must implement ${method}({ limiter, key })`,
        );
      }
    }
  }

  rateLimitStore = store || memoryStore();
  return rateLimitStore;
}

/**
 * Builds the context object a limiter's `keyGenerator` receives.
 *
 * MANDATORY FOR ROUTE AUTHORS. The default `keyGenerator` is `(ctx) => ctx.ip`,
 * so a caller that constructs its own context and forgets `ip` produces
 * `undefined`, and every such request lands in ONE shared bucket — the exact
 * failure `getClientIp`'s own docblock warns about, and one that denies service
 * to every visitor as soon as a single client trips the limit. Building the
 * context through this helper means `ip` comes from the single source of truth for
 * "which client is this" and two limiters can never disagree about the same
 * client.
 *
 * @param request the incoming `Request`
 * @param body    the ALREADY-PARSED body from `readBody(request)`, or `null`.
 *                Never pass an unread `Request` — see the ordering hazard in
 *                `createRateLimiter`.
 */
function buildRateLimitContext(request, body = null) {
  return {
    ip: getClientIp(request),
    body,
    headers: request?.headers,
    userAgent: getUserAgent(request),
    method: (request?.method || 'GET').toUpperCase(),
    path:
      request?.nextUrl?.pathname ||
      new URL(request?.url || 'http://localhost/').pathname,
  };
}

/**
 * Port of `cpccu-server/src/middlewares/rateLimit.middleware.js`.
 *
 * `keyGenerator` receives a PLAIN context object
 * `{ ip, body, headers, userAgent, method, path }` instead of an Express `req`.
 * Build it with `buildRateLimitContext(request, body)` rather than by hand.
 *
 * `name` is REQUIRED and must be unique per limiter. It is the key-space
 * namespace that keeps this limiter's counters, windows and `maxKeys` cap
 * separate from every other limiter's — see "PER-LIMITER ISOLATION" at the top
 * of this file for the two security failures that omitting it causes. A duplicate
 * `name` silently re-merged two key spaces, so it is checked at construction
 * time rather than trusted.
 *
 * ORDERING HAZARD — `registrationEmailRateLimiter` keys on `body.email`, and in
 * App Router a request body can only be read ONCE. A limiter that tried to read
 * the stream itself would consume it, and the handler downstream would then
 * throw "Body has already been read" (or worse, silently see an empty body and
 * write a user with no email). So the caller MUST read the body first with
 * `readBody(request)` — which caches the read on a `WeakMap` — and pass the
 * ALREADY-PARSED body in as `body`. `readBody` must never be called lazily from
 * inside a key generator.
 *
 * The limiter RETURNS a decision rather than writing to a response, so the route
 * handler can branch on it and build its own `Response` with the correct
 * `Retry-After` header (see `rateLimitResponse`).
 */

/**
 * Registry of limiter names already in use, so a duplicated key space is caught
 * at construction time rather than silently merging two limiters' counters.
 */
const limiterNames = new Set();

/**
 * Default cap on the number of keys a single limiter will track.
 *
 * The previous default was `Infinity`, which was safe only in the Express
 * original where each limiter owned a Map that died with the process. On Vercel a
 * warm instance serves many requests over hours, and the IP-keyed limiters have
 * no bound: every distinct client address observed adds a permanent entry. At
 * 2 GB of instance memory an unbounded map is a slow-motion OOM that the
 * platform resolves by killing the instance and every co-resident function on
 * it. 50,000 keys is far above the traffic this site serves and is cheap
 * (tens of KB), so it is a safety net against unbounded growth rather than a
 * real limit.
 */
const DEFAULT_MAX_KEYS = 50000;

/**
 * @param name         unique limiter identity, used as the key-space prefix
 * @param windowMs     window length in ms
 * @param max          requests allowed per window per key
 * @param message      429 body message
 * @param keyGenerator `(ctx) => string` producing the per-limiter key
 * @param maxKeys      hard cap on keys tracked BY THIS LIMITER
 * @returns a function `(ctx) => { allowed: true }` or
 *          `{ allowed: false, retryAfter, message }`
 */
function createRateLimiter({
  name,
  windowMs,
  max,
  message = 'Too many requests. Please try again later.',
  keyGenerator = (ctx) => ctx.ip,
  maxKeys = DEFAULT_MAX_KEYS,
}) {
  if (typeof name !== 'string' || !name.trim()) {
    throw new TypeError('createRateLimiter: a unique `name` is required');
  }

  if (limiterNames.has(name)) {
    throw new TypeError(`createRateLimiter: duplicate limiter name "${name}"`);
  }
  limiterNames.add(name);

  return (ctx) => {
    // Fail LOUDLY on a malformed context. A missing `ctx` would otherwise reach
    // `keyGenerator` and produce an `undefined` key, and `undefined` is
    // serialised into the namespaced store key as the literal string
    // "undefined" — a single shared bucket for every client that reaches this
    // limiter, which is a self-inflicted denial of service rather than a
    // missing limit. A TypeError here is shaped into a 500 by `toErrorResponse`,
    // i.e. the request fails closed.
    if (!ctx || typeof ctx !== 'object') {
      throw new TypeError(
        `${name}: rate limit context is required — use buildRateLimitContext(request, body)`,
      );
    }

    const key = keyGenerator(ctx);

    if (typeof key !== 'string' || !key) {
      throw new TypeError(
        `${name}: keyGenerator must return a non-empty string, got ${String(key)}`,
      );
    }

    const now = Date.now();
    let tracked;

    try {
      tracked = rateLimitStore.hit({ limiter: name, key, windowMs, maxKeys });
    } catch (storeError) {
      // FAIL OPEN, deliberately. This module's stated contract is that a limiter
      // problem must never become an application outage; an injected Redis store
      // timing out is exactly the scenario that contract exists for. Letting the
      // throw propagate would turn a partial Redis blip into a 500 on EVERY
      // rate-limited route, which is a strictly larger outage than the one being
      // mitigated.
      //
      // CAVEAT, recorded deliberately: for CREDENTIAL endpoints (login, OTP
      // verification) fail-closed may be the better trade, because "the store is
      // down" is preferable to "the attacker is in". That choice needs a real
      // per-endpoint policy and a monitoring signal for store errors, so it is a
      // conscious future decision rather than a default that slipped in. The
      // `console.error` below is the only signal either way, so alert on it.
      console.error(
        `Rate limit store error for limiter "${name}"; failing open:`,
        storeError?.message,
      );
      return { allowed: true };
    }

    if (tracked.count > max) {
      return {
        allowed: false,
        // Ceiling to whole seconds: `Retry-After` is an integer delta-seconds
        // value, and a fractional one is ignored by most HTTP clients, which
        // would make them retry immediately.
        retryAfter: Math.ceil((tracked.resetAt - now) / 1000),
        message,
      };
    }

    return { allowed: true };
  };
}

const loginRateLimiter = createRateLimiter({
  name: 'login',
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many login attempts. Please try again later.',
});

// Coarse per-IP cap. A single university NAT can legitimately host a large
// burst of students (~50 observed), so this is deliberately generous; targeted
// abuse is handled by registrationEmailRateLimiter below and by the OTP
// verification controls. 100/hour leaves ~2x headroom over the observed peak
// for retries, validation failures and duplicate submissions.
const registrationRateLimiter = createRateLimiter({
  name: 'registration',
  windowMs: 60 * 60 * 1000,
  max: 100,
  message: 'Too many registration attempts. Please try again later.',
});

// Target-level protection: a raised IP ceiling must not let an attacker hammer
// one address (and its OTP flow). Keyed on the normalized email, with a hard
// maxKeys cap so spraying distinct addresses cannot grow the store without
// bound. `body` MUST be the pre-parsed body — see the ordering hazard above.
const registrationEmailRateLimiter = createRateLimiter({
  name: 'registration-email',
  windowMs: 60 * 60 * 1000,
  max: 5,
  maxKeys: 10000,
  keyGenerator: ({ body, ip }) => {
    const email =
      typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';

    // Malformed requests still get counted (the controller rejects them anyway)
    // but keyed per-IP so they never share a single global bucket.
    return email ? `email:${email}` : `ip:${ip}`;
  },
  message:
    'Too many registration attempts for this email address. Please try again later.',
});

const authEmailRateLimiter = createRateLimiter({
  name: 'auth-email',
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many email requests. Please try again later.',
});

const passwordResetRateLimiter = createRateLimiter({
  name: 'password-reset',
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many password reset attempts. Please try again later.',
});

const contactRateLimiter = createRateLimiter({
  name: 'contact',
  windowMs: 60 * 1000,
  max: 3,
  message: 'Too many contact messages. Please try again later.',
});

/**
 * Per-IP cap on `GET /api/v1/users/member`, the public directory listing.
 *
 * WHY 60/MINUTE, WHICH IS GENEROUS FOR A "DIRECTORY LISTING" CAP. This is not a
 * credential-guessing endpoint, so the limit is not about guessing — it is about
 * two concrete costs an anonymous caller can inflict by hammering it:
 *   1. it is the one endpoint that returns the ENTIRE collection in one
 *      response, so a flood is a cheap way to keep a warm function instance
 *      busy on a full `User.find()` plus a serialisation of every member, and
 *      2. it is the cheapest possible harvest loop, so a cap is also what stops
 *      it being used as a low-cost mirror of the membership for as long as the
 *      window allows.
 * 60/min is chosen to sit ABOVE any plausible real browsing: a member page that
 * refetched on every navigation, plus RTK Query's refetch behaviour, still uses
 * a handful of requests a minute, and `Member.jsx` mounts once per visit. It is
 * chosen to sit BELOW a script: 60 requests a minute is 86,400 a day from one
 * address, and the per-instance store is not shared (see the Vercel note at the
 * top of this file), so this is best-effort abuse friction rather than a
 * guarantee.
 *
 * Per-IP rather than per-user because this route is `public: true` — there is
 * no authenticated principal to key on before the limiter runs (see the ORDER
 * section of `apiRoute`), so the IP is the only identity available. That is the
 * correct key for an anonymous endpoint, and the university-NAT concern that
 * motivates `userUploadRateLimiter` does not apply: a shared NAT making 60
 * directory requests a minute in aggregate is not a realistic pattern.
 */
const memberListRateLimiter = createRateLimiter({
  name: 'member-list',
  windowMs: 60 * 1000,
  max: 60,
  message: 'Too many member directory requests. Please try again later.',
});

// Per-IP cap on uploads. The foundation previously shipped NO limiter for
// `/api/v1/admin/uploads/image` or the profile `userImageUpload`, so those two
// endpoints were unmetered: an authenticated user (or a moderator) could
// loop unlimited uploads, and every one of them costs an outbound Cloudinary
// call plus the ~35–40 MB peak memory of the request described in
// `readMultipart`. 20/hour is generous for a profile picture and a content
// image while capping the cost of a runaway client.
//
// APPLIED TO THE ADMIN UPLOAD ONLY, AND IT IS THE PER-IP VARIANT DELIBERATELY.
// `POST /api/v1/admin/uploads/image` is reached by admins AND moderators, a
// small known set, and it is still protected by `adminAuth.js` — an anonymous
// caller never reaches the limiter at all. The three member-facing upload
// routes use `userUploadRateLimiter` below instead, because per-IP is the
// wrong key for them (read that comment before "fixing" this inconsistency).
const uploadRateLimiter = createRateLimiter({
  name: 'upload',
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: 'Too many upload attempts. Please try again later.',
});

/**
 * The MEMBER-FACING upload cap, keyed PER AUTHENTICATED USER rather than per IP.
 * Same 20/hour budget as `uploadRateLimiter`; different key.
 *
 * APPLIES TO: `PATCH /api/v1/users/user/upload-image/:key` (avatar / cover),
 * `POST /api/v1/posts/create-post` and `PATCH /api/v1/posts/update-post/:id` —
 * i.e. every upload a PLAIN MEMBER can perform.
 *
 * WHY PER-USER, AND WHY IT IS CORRECT HERE EVEN THOUGH IT IS WEAKER. A single
 * university campus reaches this site through ONE NAT egress address. Under a
 * per-IP key, 20 uploads an hour is a SHARED budget for every student behind
 * that address: twenty people who each upload one avatar picture exhaust the
 * cap and the twenty-first member gets a 429 on their profile picture with no
 * way to do anything about it. That is a self-inflicted denial of service
 * against the club's own members, caused by infrastructure the club does not
 * control. Keying on the authenticated user id gives each member their own 20.
 * The university NAT is the deciding factor, and `rateLimit.js`'s own
 * `registrationRateLimiter` note records ~50 students observed behind one
 * address — so the per-IP version of this limit was not hypothetical, it was
 * going to fire.
 *
 * THE TRADEOFF, STATED PLAINLY: per-user keying is WEAKER against an attacker
 * who controls many accounts, because 20/hour is then 20 per account rather than
 * 20 per address, and creating an account requires a verified e-mail (an OTP
 * round trip) which raises but does not remove that cost. It is also weaker
 * against the "one attacker behind a rotating IP" case — but that case is
 * already not covered, because this limiter's store is per-instance (see the
 * Vercel note at the top of this file) and a rotating IP is the same problem for
 * both keys. The genuine loss is only multi-account volume, and the account
 * creation cost is the control that was always bounding it.
 *
 * WHY IT NEEDS A SEPARATE HOOK. The `keyGenerator` receives the context
 * `buildRateLimitContext` produced, which is `{ ip, body, headers, userAgent,
 * method, path }` — and `apiRoute` runs the ordinary `limiter` at step 3,
 * BEFORE `verifyToken` at step 4. There is therefore no authenticated principal
 * to key on at that point, and no correct way to obtain one: reading the id out
 * of an UNVERIFIED JWT would let an attacker mint a fresh bucket per request by
 * sending a random `_id` claim, which is not a limit at all. This limiter is
 * therefore mounted through `apiRoute`'s `userLimiter` option, which runs
 * immediately AFTER authentication and is the only place a verified user id
 * exists. See the ORDER note in `http.js`.
 *
 * THE IP FALLBACK IS REACHABLE AND IS INTENTIONAL. `createRateLimiter` requires
 * a non-empty string key, so a context with no authenticated user falls back to
 * the IP — which is exactly the pre-auth behaviour and is strictly better than
 * throwing a 500 on a route that is otherwise working. It should not be
 * reachable from a correctly-configured route (`userLimiter` is evaluated only
 * after `verifyToken` succeeded, and these three routes do not set `public`).
 */
const userUploadRateLimiter = createRateLimiter({
  name: 'user-upload',
  windowMs: 60 * 60 * 1000,
  max: 20,
  keyGenerator: ({ user, ip }) => {
    const userId = user?._id?.toString?.() || user?.id || '';

    return userId ? `user:${userId}` : `ip:${ip}`;
  },
  message: 'Too many upload attempts. Please try again later.',
});

// Coarse, per-IP abuse control for OTP verification. Target-specific guessing
// is capped separately by the per-OTP attempt counter in the auth controller,
// so this limiter deliberately stays IP-based (matching the other limiters)
// instead of keying on email, which would let an attacker grow the store
// without bound by spraying distinct addresses.
const otpVerificationRateLimiter = createRateLimiter({
  name: 'otp-verification',
  windowMs: 10 * 60 * 1000,
  max: 5,
  message: 'Too many verification attempts. Please try again later.',
});

/**
 * Builds the `Response` for a rejected request, reproducing the Express shape:
 * a `Retry-After` header in SECONDS, plus the `{ status, message, errors: [] }`
 * body. `errors` is an empty array here (matching the original) because the
 * limiter has no field-level detail to report.
 */
function rateLimitResponse(decision) {
  return new Response(
    JSON.stringify({ status: 429, message: decision.message, errors: [] }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(decision.retryAfter),
      },
    },
  );
}

export {
  DEFAULT_MAX_KEYS,
  authEmailRateLimiter,
  buildRateLimitContext,
  contactRateLimiter,
  createRateLimiter,
  loginRateLimiter,
  otpVerificationRateLimiter,
  passwordResetRateLimiter,
  memberListRateLimiter,
  rateLimitResponse,
  registrationEmailRateLimiter,
  registrationRateLimiter,
  setRateLimitStore,
  uploadRateLimiter,
  userUploadRateLimiter,
};
