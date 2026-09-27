import 'server-only';

import { cookies } from 'next/headers';

import {
  getClientIp,
  getUserAgent,
  parseCookies,
  readBody,
  readMultipart,
} from '@/lib/server/request';

/**
 * WHY THIS FILE EXISTS — FIDELITY, NOT CONVENIENCE.
 *
 * This shim is the single architectural decision that makes the rest of the
 * controller migration mechanical instead of interpretive. The Express
 * controllers are ~2,500 lines of business logic (OTP attempt budgets, password
 * policy, job-pipeline state reconciliation, Cloudinary delete-before-upload
 * ordering, certificate verification logging). Every one of those lines carries
 * a rule that was reverse-engineered from a bug report or a requirement, and
 * none of it is re-derivable from the code.
 *
 * The alternative — "just rewrite the controllers for App Router" — is the
 * thing this shim exists to prevent, because the failure mode of a rewrite is
 * NOT a compile error. It is a controller that looks right, passes review,
 * and silently drops a rule. Concretely, a rewrite of `registrationHandler`
 * that forgets the `emailUser.otp = { ...otp, attempts: 0 }` branch at
 * `auth.controller.js:134-142` re-introduces a full account-takeover path
 * (pre-register a victim's email, choose a password, wait for them to verify).
 * Nothing in a test that only covers the happy path would catch it.
 *
 * So: port the body VERBATIM, let the shim absorb the `(req, res)` signature,
 * and make every change from the original loud and commentable. The cost of
 * this file is ~200 lines; the cost of NOT having it is ~2,500 lines of
 * unreviewable re-derivation.
 *
 * THE CONTRACT. A route uses it as:
 *
 *     export const POST = apiRoute({
 *       handler: async (ctx, request, routeContext) => {
 *         const { req, res, collect } = await createShim(request, ctx, {
 *           params: routeContext.params
 *         });
 *         await createPostHandler(req, res);
 *         return collect.result();
 *       }
 *     });
 *
 * `apiRoute` owns CSRF, rate limiting, auth and error shaping; the shim owns
 * only the `req`/`res` adapter; the controller owns only business logic. The
 * controller body is unchanged from the Express original.
 *
 * THE HANDLER TAKES `(ctx, request, routeContext)`, NOT `(ctx)` AND NOT A
 * CLOSURE. `request` and `routeContext` are `apiRoute`'s own invocation
 * parameters and it forwards them verbatim. Taking them as arguments is what
 * makes concurrent requests on a warm instance independent: there is no shared
 * slot for a second in-flight request to overwrite. A route that reached for a
 * module-level "current request" instead would hand a controller another
 * request's body. Note also that `auth: true` is NOT part of this contract and
 * must not be reintroduced — authentication is the default and `apiRoute`
 * REJECTS the flag at module load (`http.js`).
 */

/**
 * Multipart form parts are collected into a multer-shaped file object.
 *
 * WHY `buffer` IS A GETTER OVER AN ALREADY-RESOLVED `ArrayBuffer` RATHER THAN A
 * PLAIN PROPERTY. Two constraints collide here and the resolution matters:
 *
 *  1. A `File` exposes NO SYNCHRONOUS byte accessor. `arrayBuffer()` and
 *     `bytes()` are both async, and `File`/`Blob` have no `buffer` property at
 *     all (verified against this runtime's `File`). A lazy getter that tried to
 *     do `Buffer.from(file.arrayBuffer())` would therefore hand the controller a
 *     PROMISE, and `uploadOnCloudinary` would send a Promise to the Cloudinary
 *     SDK — `Buffer.isBuffer` is false, `instanceof Uint8Array` is false, there
 *     is no `.stream`, so `toNodeReadable` returns it untouched and the SDK
 *     treats it as a FILE PATH and fails with `ENOENT`. The failure would be
 *     attributed to a bad file rather than to the shim, which is the worst
 *     possible place for it.
 *  2. The bytes have to be resident anyway, because the controller is about to
 *     hand them to the uploader.
 *
 * So `createShim` awaits `arrayBuffer()` once per file part, and the getter
 * wraps the resulting `ArrayBuffer` in a Buffer. `Buffer.from(arrayBuffer)`
 * creates a VIEW over the same memory rather than a second copy, which is the
 * part that actually matters: the naive `Buffer.from(await file.arrayBuffer())`
 * would hold the payload twice. The `cached` memo then guarantees repeated reads
 * — and the concurrent `Promise.all` over `files` in `post.controller.js` —
 * share one instance.
 *
 * The memory cost is bounded and stated here rather than hidden: `readMultipart`
 * has already rejected the request if `Content-Length` or any individual file
 * exceeds `MAX_UPLOAD_BYTES` (4 MiB), and the platform caps a request at 4.5 MB,
 * so a single request can hold at most ~4.5 MB of file bytes. The way to avoid
 * that entirely is to pass the `File` itself to `uploadOnCloudinary` (it streams
 * via `toNodeReadable`) rather than `file.buffer`; the two ported call sites
 * use `file.buffer` because the Express source read `file.path`, and keeping
 * that shape is what made the port a one-line change at each site. The
 * `fileField` option below is the other lever — a route that only wants one part
 * should say so.
 *
 * `mimetype` comes from the CLIENT-SUPPLIED multipart `Content-Type` of the
 * part and is therefore attacker-controlled and NOT a security control. It is
 * carried only because the original multer object had it. Real type validation
 * happens server-side in Cloudinary, which sniffs the bytes (see
 * `ALLOWED_FORMATS` in `cloudinary.js`).
 *
 * `originalname` is ADDITIVE relative to the multer shape — nothing in the
 * backend read it, but it is the only identifier a log line or an error message
 * can use to tell the user WHICH of twenty uploads was the wrong one.
 *
 * @param file        the `File` from the parsed `FormData`
 * @param name        the field name, i.e. `req.file.fieldname` in the original
 * @param arrayBuffer the already-resolved bytes for that file
 * @returns `{ buffer, mimetype, fieldname, size, originalname }`
 */
function toUploadedFile(file, name, arrayBuffer) {
  let cached = null;

  return {
    get buffer() {
      if (cached) return cached;
      // A VIEW over `arrayBuffer`, not a copy. See the docblock.
      cached = Buffer.from(arrayBuffer);
      return cached;
    },
    mimetype: file.type || '',
    fieldname: name,
    size: typeof file.size === 'number' ? file.size : arrayBuffer.byteLength,
    originalname: file.name || '',
  };
}

/**
 * `FormData` → the two things multer put on the request: `req.body` (the TEXT
 * fields) and the file list.
 *
 * multer runs the parts in a fixed order, so a `text` field that arrived AFTER
 * a file part is still present in `req.body` by the time the handler runs. The
 * shim sees the whole `FormData` at once, so the split is simply by value type:
 * a `File`-like part is a file, anything else is a form field. That is the same
 * observable outcome for every controller in this codebase.
 *
 * Non-`File` parts are COERCED with `String()`. `FormData` yields strings
 * already, but a `Blob` part that is not a `File` arrives as an OBJECT, and
 * `${value}` on a Blob yields `"[object Blob]"` — a truthy value that would sail
 * past a `if (!caption)` check and write the literal string `"[object Blob]"`
 * into the database. `describeBinaryPart` turns that case into an explicit,
 * obviously-wrong-looking sentinel rather than an accidental one.
 *
 * `FormData` iteration is synchronous, so the file bytes are gathered in a
 * SECOND pass with `Promise.all` — every part's `arrayBuffer()` is awaited
 * CONCURRENTLY rather than one after another, so the cost is one memory fill
 * rather than N sequential ones.
 */
async function splitFormData(form, fileField) {
  const body = Object.create(null);
  const files = [];

  // First pass: classify the parts.
  //
  // `fileField` reproduces multer's field FILTERING (`upload.array('media')`
  // only populates `req.files` with parts named `media`). When it is omitted,
  // every file part is collected — correct for the single-file `req.file`
  // consumer, and a deliberate superset for the array consumer, so a route that
  // mounts `upload.array('media')` SHOULD pass `fileField: 'media'`.
  const fileParts = [];

  for (const [name, value] of form.entries()) {
    if (typeof value === 'object' && value && typeof value.size === 'number') {
      if (fileField && name !== fileField) continue;
      fileParts.push([name, value]);
      continue;
    }

    body[name] =
      value instanceof Blob ? describeBinaryPart(value) : String(value);
  }

  // Second pass: read the bytes concurrently, then build the multer-shaped
  // objects. See `toUploadedFile` for why the bytes are resolved HERE rather
  // than inside the accessor.
  const buffers = await Promise.all(
    fileParts.map(([, value]) => value.arrayBuffer()),
  );

  for (const [index, [name, value]] of fileParts.entries()) {
    files.push(toUploadedFile(value, name, buffers[index]));
  }

  return { body, files };
}

function describeBinaryPart(value) {
  return `[binary ${value?.type || 'application/octet-stream'}]`;
}

/**
 * `URLSearchParams` → an Express-`req.query`-shaped plain object.
 *
 * NOT `Object.fromEntries(searchParams)`, which silently DROPS a repeated key
 * and keeps only the last value. Express's `qs` parser (the default `req.query`)
 * does the opposite: `?a=1&a=2` yields `{ a: ['1', '2'] }`. Keeping the last
 * value would mean a filter that takes `?tag=x&tag=y` quietly narrows to `y`,
 * which is the kind of thing a client reports as "the filter is broken". The
 * array form is what Express produced, so it is what is produced here.
 */
function toQueryObject(searchParams) {
  const query = Object.create(null);

  for (const key of new Set(searchParams.keys())) {
    const all = searchParams.getAll(key);

    if (all.length > 1) {
      query[key] = all;
    } else {
      query[key] = all[0];
    }
  }

  return query;
}

/**
 * Builds the `(req, res)` pair a ported Express controller expects, over a
 * standard `Request`.
 *
 * @param request the incoming `Request`
 * @param ctx     the context `apiRoute` already built and handed to the route
 *                handler (`buildRateLimitContext` + `ctx.user`). Read-only here;
 *                the shim never mutates it.
 * @param options
 * @param options.params   the Next route segment params. ACCEPTED AS A PROMISE
 *                         and awaited internally: from Next 15 `context.params`
 *                         is a Promise, and every dynamic route in this
 *                         migration has one, so requiring a pre-resolved object
 *                         would push an `await` into all 20+ routes for no gain.
 * @param options.fileField  multipart field name to treat as the uploaded file;
 *                          see `splitFormData`.
 * @returns `Promise<{ req, res, collect }>`
 *
 * ASYNC, AND THAT IS LOAD-BEARING. `req.body` must be a plain, already-parsed
 * value because every controller destructures it synchronously
 * (`const { caption } = req.body`) with no `await`. A lazy getter cannot serve
 * that. So the body is resolved HERE, once, before the controller is called.
 */
async function createShim(request, ctx = {}, options = {}) {
  const { params: rawParams, fileField } = options;

  // `await` on a plain object is a no-op, so this accepts a resolved params
  // object and a params Promise with the same call. Dynamic-segment values
  // arrive as strings, which is exactly what `req.params` held in Express.
  const params = (await rawParams) || {};

  const contentType = request?.headers?.get('content-type') || '';
  const isMultipart = contentType.includes('multipart/form-data');

  // `req.body` is read EXACTLY ONCE and the SAME value is shared with the rate
  // limiter. This is not an optimisation, it is a correctness requirement:
  // `apiRoute` step 3 already called `readBody(request)` to build
  // `buildRateLimitContext(request, body)` — and
  // `registrationEmailRateLimiter` keys on `body.email`, so the limiter HAS
  // already consumed the stream. `readBody` memoises the read in a `WeakMap`
  // keyed on the `Request` (and memoises the PROMISE, not the value, so
  // overlapping callers join the same read), so re-reading through it here is
  // free and cannot throw `TypeError: Body has already been read`.
  //
  // `ctx.body` is preferred when present purely as a fast path — it is the very
  // object the limiter saw, so preferring it makes it structurally impossible
  // for the limiter and the controller to disagree about what the body was.
  let body = ctx.body;
  let files = [];

  if (isMultipart) {
    // `readMultipart` re-runs the `Content-Length` gate and adds a PER-FILE
    // size check that the `Content-Length` header can be lied about. Do not
    // replace this with a bare `request.formData()`.
    const form = await readMultipart(request);
    const split = await splitFormData(form, fileField);
    body = split.body;
    files = split.files;
  } else if (body === undefined || body === null) {
    // `readBody` returns `null` for an unsupported content type, and for a
    // request with no body at all — both of which are the correct `req.body`
    // for a controller that then finds every field missing and throws its own
    // 400, so the `null` is passed through rather than coerced to `{}`.
    body = await readBody(request);
  }

  const collected = {
    // Default 200 matches Express: `res.json()` with no prior `res.status()`
    // sends 200.
    status: 200,
    body: null,
    sent: false,
    cookies: [],
    headers: {},
  };

  const res = {
    /**
     * `res.status(n)` — records the status and returns `res` so the
     * `res.status(n).json(x)` chain still reads as it did in Express. The
     * recorded value is applied when `collect.result()` is called, not here:
     * there is no response object in the App Router to write a status onto.
     */
    status(code) {
      collected.status = code;
      return res;
    },

    /**
     * `res.json(payload)` — captures the body and RESOLVES.
     *
     * THIS RESOLUTION IS THE WHOLE TRICK, and it is what lets a controller body
     * survive the migration verbatim. Every ported controller ends with
     *
     *     return res.status(200).json(new ApiResponse(200, data, '…'));
     *
     * In Express that returns `res`, the handler's promise resolves, and
     * `asyncHandler`'s `.catch(next)` never fires. If `json()` returned a
     * `Response` instead, the controller would hand a `Response` to the route,
     * the route would have to know that, and every one of the 40-odd handlers
     * would need a distinguishing branch. Returning a resolved promise means
     * the route can simply `await handler(req, res)` and then read
     * `collect.result()` — and `async` handlers that `throw` before reaching
     * `res.json` propagate that throw normally, which is exactly how
     * `asyncHandler` behaved and exactly what `apiRoute`'s catch relies on.
     */
    json(payload) {
      // Last write wins, as in Express (a second `res.json` would have raised
      // `ERR_HTTP_HEADERS_SENT`; no controller does it, and reproducing that
      // error would add a check that can only ever fire on a new bug).
      collected.body = payload;
      collected.sent = true;
      return Promise.resolve(res);
    },

    /**
     * `res.cookie(name, value, options)` — QUEUES, never writes.
     *
     * WHY IT QUEUES. `http.js` owns cookie application: `applyAuthCookie` writes
     * through `cookies()` from `next/headers` precisely because a Route Handler's
     * natural output is a BARE `Response` (`toErrorResponse` returns
     * `{ status, body }`, `rateLimitResponse` returns `new Response`), and
     * `response.cookies` does not exist on a plain `Response` — reaching for it
     * throws `TypeError: Cannot read properties of undefined (reading 'set')`.
     * A shim that wrote cookies directly would have to build its own `Response`
     * just to carry them, which is the exact coupling `http.js` was written to
     * remove. So the shim records the intent and `finalizeShim` replays it
     * through the same `next/headers` store.
     */
    cookie(name, value, cookieOptions = {}) {
      collected.cookies.push({ name, value, options: cookieOptions });
      return res;
    },

    /**
     * `res.clearCookie(name, options)` — queued as a deletion.
     *
     * Express turns this into a `Set-Cookie` with an expiry in the past; the
     * queued form carries the same intent explicitly (`value: ''`, `maxAge: 0`,
     * `expires: epoch`) so `finalizeShim` needs no special case and the route
     * author cannot get the two subtly different. The original attribute object
     * is spread FIRST so `maxAge`/`expires` cannot be overridden by a caller
     * who passed the 7-day `COOKIE_OPTIONS` — a cookie that is meant to be
     * deleted must not be re-issued with a live lifetime.
     */
    clearCookie(name, cookieOptions = {}) {
      collected.cookies.push({
        name,
        value: '',
        options: {
          ...cookieOptions,
          maxAge: 0,
          expires: new Date(0),
        },
        clearing: true,
      });
      return res;
    },

    /**
     * `res.set(name, value)` / `res.set({ name: value })` — queued headers.
     *
     * NOT currently load-bearing: `http.js`'s `finalizeResponse` unconditionally
     * overwrites `Cache-Control` with `no-store` on every response, so the one
     * call site (`bootcampLeaderboard.controller.js:60`, `res.set('Cache-Control',
     * 'no-store')`) is a no-op that requests exactly what the wrapper already
     * guarantees. It is implemented and exposed anyway so the shim is a
     * COMPLETE `res` surface — a ported controller that sets any other header
     * keeps working without the shim being extended, and the queued values are
     * inspectable in tests.
     */
    set(nameOrHeaders, maybeValue) {
      if (typeof nameOrHeaders === 'object' && nameOrHeaders !== null) {
        for (const [name, value] of Object.entries(nameOrHeaders)) {
          collected.headers[name] = value;
        }
        return res;
      }

      collected.headers[nameOrHeaders] = maybeValue;
      return res;
    },

    /**
     * `res.end()` — marks the response sent with no body.
     *
     * NO PORTED CONTROLLER CALLS THIS (verified by grep across all eleven). It
     * exists so the shim implements the whole `res` surface a controller could
     * legitimately reach for, rather than only the subset today's eleven happen
     * to use — a shim missing a method is a crash the first time a handler is
     * edited to use it.
     */
    end() {
      collected.sent = true;
      return res;
    },
  };

  const req = {
    body: body ?? null,

    // `ctx.ip` is preferred over recomputing it: it is the value every
    // IP-keyed rate limiter just used, and `getClientIp`'s own docblock calls it
    // the single source of truth for "which client is this". Two independent
    // derivations of a spoofable header are two chances to disagree.
    ip: ctx.ip ?? getClientIp(request),

    // `ctx.path` is the same value `buildRateLimitContext` computed; falling
    // back to the request reproduces `http.js`'s private `pathnameOf` exactly
    // (`nextUrl` is a `NextRequest` extension and is absent from a plain
    // `Request`).
    path: ctx.path ?? request?.nextUrl?.pathname ?? pathname(request),
    method: (request?.method || 'GET').toUpperCase(),

    headers: request?.headers,

    // `ctx.user` is set by `apiRoute` ONLY on the AUTHENTICATED paths — i.e.
    // every route that does NOT pass `public: true` (and the `admin: true`
    // ones, which imply auth). `null` (not `undefined`) so a controller that
    // reads `req.user.id` without a guard produces a plain `TypeError` — shaped
    // into a 500 — instead of silently querying for a document whose id is
    // `undefined`.
    user: ctx.user ?? null,

    // A FRESH parse, not `ctx.cookies`. `ctx` carries no cookies; the parsed
    // map is a pure function of the `Cookie` header, and re-parsing costs a
    // single string split on a header that is already in memory.
    cookies: parseCookies(request),

    query: toQueryObject(new URL(request.url).searchParams),
    params,

    // `req.file` is the FIRST uploaded part and `req.files` is all of them,
    // matching the multer shapes `upload.single('image')` and
    // `upload.array('media', 20)` produce. Neither is `null` vs `undefined`
    // sensitive in the ported controllers: `uploadORchangeIMG` uses
    // `req.file?.buffer` and `post.controller.js` tests
    // `req.files && length > 0`. There is deliberately NO `path` accessor —
    // `multer.diskStorage`'s `./public/temp` is not addressable on a read-only
    // serverless bundle, so the ported call sites read `buffer` instead.
    file: files[0] ?? undefined,
    files,

    /**
     * `req.get(header)` — the Express header accessor.
     *
     * CASE-INSENSITIVE because `Headers.prototype.get` normalises the name
     * itself, which is what Express's `req.get` did via lower-casing.
     *
     * `null` IS NORMALISED TO `undefined`, and that is not cosmetic. The WHATWG
     * `Headers` API returns `null` for an absent header; Express returned
     * `undefined`. Every call site in the ported code is `req.get('x') || ''`,
     * where `null` and `undefined` behave identically, so nothing observable
     * changes today — but `'x' in obj`, `=== undefined` and `typeof` all
     * distinguish the two, so leaving `null` in place would make the shim a
     * silent trap for the next handler that reasons about a missing header
     * instead of defaulting it. Normalising here means `req.get` behaves the
     * way every ported controller was written against.
     */
    get(header) {
      return request?.headers?.get(String(header)) ?? undefined;
    },

    /**
     * `req.userAgent` is ADDITIVE and unused by the ported controllers; it is
     * exposed because `certificate.controller.js` needs a user agent on every
     * verification log and a future port should reach for the same derivation
     * (`getUserAgent`) rather than re-reading the header.
     */
    userAgent: getUserAgent(request),
  };

  const collect = {
    get status() {
      return collected.status;
    },
    get body() {
      return collected.body;
    },
    get cookies() {
      return collected.cookies;
    },
    get headers() {
      return collected.headers;
    },
    get sent() {
      return collected.sent;
    },

    /**
     * The `refreshCookie` instruction `auth.js`'s `verifyToken` produced, or
     * `null`.
     *
     * READ-THROUGH, AND TODAY IT IS ALWAYS `null`. `http.js` does NOT put the
     * instruction on `ctx`: it holds it in a closure variable declared before
     * the `try` (`http.js:148`), assigns it inside the auth step
     * (`http.js:202`), and hands it to `finalizeResponse` on both the success
     * and the throw path. That placement is deliberate — the closure is what
     * lets a cookie survive a handler that throws after authenticating — so the
     * shim does not duplicate or intercept it, and the route author does not
     * pass it anywhere. This getter exists so that a future `http.js` that
     * chooses to expose it on `ctx` needs no shim change, and so the
     * documentation for where the instruction actually lives is in the same
     * place as the read.
     */
    get refreshCookie() {
      return ctx.refreshCookie ?? null;
    },

    /**
     * Replays the queued cookies and returns the `{ status, body }` pair that
     * `toResponse` in `http.js` already knows how to turn into a `Response`.
     *
     * ASYNC, and it must be awaited by the route before returning from
     * `apiRoute`'s handler — `cookies()` is a promise from Next 15 onward, and a
     * cookie write that is not awaited before the response is serialised is a
     * write that may never be flushed.
     *
     * @returns `Promise<{ status, body }>`
     */
    async result() {
      await applyQueuedCookies(collected.cookies);
      return { status: collected.status, body: collected.body };
    },
  };

  return { req, res, collect };
}

function pathname(request) {
  return new URL(request?.url || 'http://localhost/').pathname;
}

/**
 * Applies the cookies a shimmed controller queued, through the SAME
 * `next/headers` store `applyAuthCookie` in `auth.js` uses.
 *
 * WHY THE SHIM FLUSHES THESE AND `http.js` FLUSHES THE REFRESH ONE. They are
 * two different cookies with two different provenances:
 *  - a controller-queued cookie is a DELIBERATE, endpoint-specific act — "this
 *    login just succeeded", "log out, drop both cookies";
 *  - the refresh cookie is an AUTH-LAYER SIDE EFFECT that happens on routes that
 *    never mention cookies at all, and it is captured in `apiRoute`'s closure
 *    precisely so it survives a handler that throws (`http.js:148,202`).
 * Splitting them means an endpoint that fails after `verifyToken` still gets its
 * refreshed cookie (the error path calls `finalizeResponse` with the same
 * instruction), and it means a controller never has to know that
 * `next/headers` exists.
 *
 * ORDER MATTERS WHEN BOTH TOUCH `accessToken`, and the WRITER-WINS order is the
 * correct one. `finalizeShim` runs inside the route handler; `applyAuthCookie`
 * runs afterwards, inside `finalizeResponse`. So on a route where `verifyToken`
 * already issued a fresh `accessToken` AND the controller also queued one, the
 * AUTH-LAYER cookie wins — which is right, because `verifyToken` validated the
 * token against the current session state moments earlier, whereas a
 * controller-queued value is whatever that endpoint decided to hand out. For
 * `refreshAccessToken` — the one endpoint that mints its own cookie — no
 * `verifyToken` runs, so there is no refresh instruction and the controller's
 * cookie stands.
 *
 * Failures are SWALLOWED WITH A LOG rather than thrown. A cookie write failing
 * must not convert a 200 into a 500: the body has already been produced and the
 * client is owed it. The user-visible consequence of a failed write is a session
 * that does not persist, which is strictly better than a 500, and the log is
 * the only signal either way.
 */
async function applyQueuedCookies(queued) {
  if (!queued.length) return;

  const store = await cookies();

  for (const entry of queued) {
    try {
      store.set(entry.name, entry.value, entry.options);
    } catch (error) {
      console.error(
        `Failed to set cookie "${entry.name}":`,
        error?.message ?? error,
      );
    }
  }
}

export { applyQueuedCookies, createShim };
