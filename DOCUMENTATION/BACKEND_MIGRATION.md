# Backend Migration — Express (`cpccu-server`) → Next.js App Router Route Handlers

This document is the handover for the backend migration that moved the CPCCU Express API into route handlers inside this repository. It is written for the next person who has to **cut this over, operate it, or extend it**. It does not assume you were present for the migration or for the review cycles that followed it.

> **Read this first.** The migration is **additive and not cut over**. `cpccu-server` still exists, is byte-identical to its committed state, still runs, and is still what the client talks to. Nothing in `cpccu-client` calls the new `/api/**` surface yet.

**Contents**

1. [What moved and what did not](#1-what-moved-and-what-did-not)
2. [Architecture of the new API](#2-architecture-of-the-new-api)
3. [The endpoint table](#3-the-endpoint-table)
4. [Environment variables](#4-environment-variables)
5. [Deliberate divergences from the Express original](#5-deliberate-divergences-from-the-express-original)
6. [Preserved defects — NOT migration regressions](#6-preserved-defects--not-migration-regressions)
7. [The security review outcome](#7-the-security-review-outcome)
8. [The single largest open risk: rate limiting](#8-the-single-largest-open-risk-rate-limiting)
9. [Frontend work still outstanding](#9-frontend-work-still-outstanding)
10. [Pre-deploy checklist](#10-pre-deploy-checklist)
11. [Known tooling gaps](#11-known-tooling-gaps)

---

## 1. What moved and what did not

**Moved.** The entire Express application — 14 ported controllers, the auth/admin/rate-limit/validation middlewares, the Mongo models, the email templates and the Cloudinary integration — now lives under two directories in this repository:

| Path | What it is |
| :--- | :--- |
| `src/lib/server/` | The server foundation: 18 top-level modules, 13 controllers, 2 services, 8 models, 8 email files. |
| `src/app/api/**` | 53 `route.js` files exporting **65 endpoints** at `/api/v1/**` and `/api/visitor*`. |

**Not moved — deliberately:**

- `cpccu-server/` itself. It is untouched (`git status` clean, HEAD `ea9810a`) and still runs. It was the read-only source of truth for this port.
- The client. `NEXT_PUBLIC_API_BASE_URL` is still `http://localhost:5000/api/v1` — i.e. the client still calls the Express server. Nothing in `src/` outside `src/lib/server` and `src/app/api` was modified as part of the migration.
- The root-level `GET /verify/:certificateId` endpoint. It is **not legal to create** in App Router: `src/app/verify/[certificateId]/page.jsx` already owns that segment and Next fails the build on a `page.jsx` + `route.js` collision. The canonical replacement is `GET /api/v1/certificates/verify/:certificateId`, which runs the same controller. See [§9](#9-frontend-work-still-outstanding) — the client still points at the old path and **fails silently** if you cut over without fixing it.
- The root-level `GET /` health probe. Same reason: `src/app/(main)/page.jsx` owns `/`. `GET /api/v1` is the health endpoint and the only one that can exist.

**What this means operationally.** You have two API implementations of the same contract running in two repositories. The new one is additive: it adds routes to this app, it does not take any away. Cutover is a frontend change (repointing one build-time variable, plus the items in §9), not a backend change.

---

## 2. Architecture of the new API

A request crosses four layers. Each one exists to stop a specific class of mistake, and the classes are disjoint.

```
src/app/api/v1/<module>/<path>/route.js   declarative one-liner: WHAT the endpoint is
              │
              ▼
src/lib/server/handler.js                 defineRoute → the bridge; the ONLY place the
              │                            wiring is written
              ▼
src/lib/server/http.js                    apiRoute: OWNS THE ORDER and every security step
              │
              ▼
src/lib/server/shim.js                    createShim: Express-shaped (req, res) adapter
              │
              ▼
src/lib/server/controllers/*.js           ported business logic, unchanged
```

### 2.1 `route.js` — a declaration and nothing else

Every route file in `src/app/api/**` is a docblock plus a `defineRoute({...})` call plus two `export const` segment configs. There is no `try`/`catch`, no body reading, no cookie writing, no header setting in any of the 53 files. Two of them also export `runtime = 'nodejs'` and `dynamic = 'force-dynamic'`; every route does.

The whole surface of a route file:

```js
export const POST = defineRoute({
  method: 'POST',                 // asserted against the request, NEVER used for access control
  public: true,                   // omit → the route is authenticated
  admin: true,                    // role gate; implies auth
  limiter: [a, b],                // pre-auth, keyed on client identity
  userLimiter: c,                 // post-auth, keyed on ctx.user
  fileField: 'media',             // multer's field filter
  maxFiles: 20,                   // DOCUMENTARY ONLY — see the warning below
  rejectMultipart: true,          // reproduces upload.none(); one route (login)
  controller: createPostHandler,  // the ported (req, res) function
});
```

`defineRoute` throws at **module load** (i.e. during `next build`) on a non-function `controller`, a `method` outside `GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS`, an empty `limiter` array, a non-function limiter, a bad `fileField`, or a `maxFiles` that is not a positive integer. `maxFiles` additionally emits a one-time `console.warn` per method stating that it is not enforced.

### 2.2 `handler.js` — the bridge, and the one non-obvious mechanism

> **This is the first thing to read before changing the bridge.**

`defineRoute` exists so that the four-step composition — build the shim, pass `params`, call the controller, read `collect.result()` — is written **once** rather than 44 times. Its own docblock names the motivating failure: a route that forgets `params: routeContext.params` compiles, passes a happy-path smoke test, and then 400s on every real request with `"Post ID is required"` (or `"Email is required"`, or `"Certificate ID is required"`, depending on the controller). Eight controllers in this migration read `req.params`.

**The `AsyncLocalStorage` mechanism.** `apiRoute` invokes its handler as `handler(ctx)` and nothing else — it does **not** forward the `Request` and does **not** forward the route context. `ctx` is `buildRateLimitContext(request, body)` plus `ctx.user`, i.e. `{ ip, body, headers, userAgent, method, path, user }`. It cannot carry a one-shot body stream or `{ params }`. But `createShim` needs both: it calls `readMultipart(request)` / `readBody(request)`, and it reads `options.params` for the dynamic segments.

`handler.js` recovers both from async context:

```js
const requestStore = new AsyncLocalStorage();          // handler.js:140

return function routeHandler(request, routeContext) {
  if (request.method !== method && !(method === 'GET' && request.method === 'HEAD')) {
    throw new TypeError(/* declared-vs-actual method mismatch */);
  }
  return requestStore.run({ request, routeContext }, () =>   // handler.js:413
    inner(request, routeContext),
  );
};

async function runController(ctx) {
  const store = requestStore.getStore();              // handler.js:266
  if (!store) throw new TypeError('defineRoute: no request context…');
  const { request, routeContext } = store;
  const { req, res, collect } = await createShim(request, ctx, {
    params: routeContext?.params,                     // ALWAYS passed
  });
  await controller(req, res);                         // return value ignored
  return collect.result();                            // MUST be awaited
}
```

Why a module-level "current request" variable is **wrong** and was not used: a single warm function instance serves requests **concurrently**, so two in-flight requests would race on one slot and a controller could be handed another request's body. `AsyncLocalStorage` is the concurrency-safe channel, and `als.run()` is entered once per invocation with the store visible to every `await` downstream, including the `await handler(ctx)` inside `apiRoute`.

Three consequences you need to know:

- **`params` is always passed**, even for a route with no dynamic segment. On a static route it resolves to `{}`, which is what `req.params` held in Express.
- **The controller's return value is ignored.** Every ported controller ends `return res.status(n).json(...)`; `shim.js`'s `res.json` *resolves* rather than returning a `Response` precisely so this can be a bare `await`.
- **There is deliberately no `try`/`catch` in `runController`.** A controller's `throw` must reach `apiRoute`'s catch so `toErrorResponse` shapes it. Catching here would turn a controller 400 into a 200 with a `null` body.
- **`method` must never be used to authorise anything.** It drives one assertion and one log line. Access is decided by exactly two inputs: `public` and `admin`.

The `method` assertion exists because copy-pasting a `GET` handler into a file exported as `POST` produces a route that compiles, builds, and returns a clean **405** for the only request anyone makes. It throws a `TypeError` naming both methods instead. `HEAD` is accepted on a `GET` route, because Next auto-derives `HEAD` from every `GET` and a strict test would 500 every GET endpoint in the app.

`handler.js` also documents the four-part composition contract in full (cookie queueing vs. the auth-layer refresh cookie; `adminAuth` deriving its own routing context; `toErrorResponse` shaping every throw). Read lines 42–88 before touching this file.

### 2.3 `http.js` — `apiRoute` and its twelve steps

`apiRoute` is the single entry point for every route. The invariant it exists to enforce, verbatim from its docblock:

> **A route that does not go through `apiRoute` has no CSRF check, no error shaping and no security headers, and a route that goes through it without explicitly saying `public: true` is AUTHENTICATED.**

**Auth-by-default; `public: true` is the only way out.** This is inverted from the `auth: true` flag it replaces, and the reason is which mistake is likely. "A route that does not use the wrapper" is caught by convention and review. "A route that uses the wrapper and forgets `auth: true`" is caught by **nothing**: it compiles, it passes a smoke test driven by a valid session, and it ships a live unauthenticated endpoint. The old default was the dangerous one. Opening a route by accident now requires typing `public: true`, which is visible in review and is rejected at module load if it contradicts the rest of the config.

**Passing `auth` at all throws at module load** (`http.js:305-311`) — including `auth: false`. Silently accepting it would be the worst of both worlds: `auth: false` (a route author asking for anonymous access) would quietly become the strictest possible route, and `auth: true` would look like it were doing something when it is now the default. The message names the replacement.

Three more module-load rejections, each for a specific fail-open mistake:

| Rejection | The mistake it prevents |
| :--- | :--- |
| `public` must be `true`, `false` or absent | `public: 'false'` — the **string** — is truthy, so every downstream test sees "public" and the route is served to anonymous callers. Nothing throws, nothing logs, and it looks correct in review because the text says "false". |
| `public: true` + `admin: true` | Which half would win depends on branch order, so the combination is refused rather than resolved. A copy-paste slip must never resolve to "the route is public". |
| `userLimiter` + `public: true` | It is evaluated only after `verifyToken`, so on a public route it would never get a `ctx.user` and would silently degrade into a second copy of the pre-auth `limiter`. |

**The twelve steps** (`http.js:371-492`, and `finalizeResponse`):

| # | Step | Why it is there / there |
| :--- | :--- | :--- |
| 1 | `assertBodySizeWithinLimit(request)` | Header-only rejection **before anything buffers the body**. An oversized multipart upload costs ~35–40 MB of instance heap once `formData()` runs; on a 2 GB instance ~50 concurrent uploads OOM-kill every co-resident function. A 4.5 MB rejection here costs one header lookup. |
| 2 | `assertSameOrigin(request)` | CSRF, before any credential is read, so a cross-site request never reaches the point where it could act as the user. Header-only, so it is free. |
| 3 | `limiter(ctx)` | Before the expensive work (DB lookup, Cloudinary call). The body is read **once**, here, via `readBody`, and the already-parsed value is what the key generator sees. Can only key on the client. |
| 4 | `verifyToken(request)` → `ctx.user`, `refreshCookie` | After limiting, so an unauthenticated flood is stopped before it costs a `User.findById` per request. |
| 5 | `requireAdminAction(user, { method, pathname })` | After authentication, because it needs the role. |
| 6 | `userLimiter(ctx)` | Opt-in. Must be after `verifyToken` (it keys on the user id) and after step 5 (a request that will be 403'd never reaches the work, so it must not be charged for it). |
| 7 | `handler(ctx)` | The only part a route author writes. |
| 8 | Envelope serialisation | `toResponse` accepts four shapes: `Response`, `ApiResponse`, a **branded** `{status, body}` pair, or a literal `{status, body}`. |
| 9 | Error shaping | `toErrorResponse` turns any throw from 1–7 into `{ status, message, errors? }`. |
| 10 | `Cache-Control: no-store` | Set unconditionally, overwriting anything a handler set. These are per-user payloads; a cache that keeps one is a cross-user leak, and it also stops a 401 being replayed after a successful login. |
| 11 | `X-Content-Type-Options: nosniff` | **The only source of this header on an API response**, and it is a backstop, not duplication. |
| 12 | Cookie application | `applyAuthCookie` applies the `refreshCookie` instruction. |

`withApiHeaders` builds a **new** `Response` rather than mutating the one it was given: `response.headers` is immutable on responses produced by `Response.redirect()`, `Response.error()` and `NextResponse.next()`, and `headers.set(...)` on any of them throws `TypeError: immutable` — inside the error path, where `finalizeResponse` is the only thing between the caller and Next's HTML error page.

`apiRoute`'s catch has a second, inner catch that returns a hand-built bare 500 if the error path itself throws (a non-numeric `ResponseInit.status` → `RangeError`; `JSON.stringify` on a circular payload; `cookies()` throwing outside a request scope). It is a floor, not a replacement for `finalizeResponse` working.

**Note on step 3 and unparseable bodies.** A body that fails to parse must not bypass the limiter, so the error is caught, logged (throttled per limiter to one line per minute via a `WeakMap` keyed on the limiter function), and the decision is still taken against the per-IP key.

**The one file that bypasses `defineRoute`.** `src/app/api/v1/route.js` (the health probe) calls `apiRoute` directly, because it must return `text/html` with a raw string body and `defineRoute`'s shim can only produce a JSON pair. It still goes through `apiRoute` so it still gets the size gate, the CSRF no-op, `no-store` and `nosniff`.

### 2.4 `shim.js` — the Express-shaped `(req, res)` adapter

This shim is **the** architectural decision of the migration, and its docblock is explicit that it exists for fidelity, not convenience: the Express controllers are ~2,500 lines of business logic (OTP attempt budgets, password policy, job-pipeline state reconciliation, Cloudinary delete-before-upload ordering, certificate verification logging), every line of which encodes a rule reverse-engineered from a bug report or a requirement, and none of it is re-derivable from the code.

The alternative — "rewrite the controllers for App Router" — has a failure mode that is **not** a compile error: a controller that looks right, passes review, and silently drops a rule. Concretely, a rewrite of `registrationHandler` that forgets the `emailUser.otp = { ...otp, attempts: 0 }` branch re-introduces a full account-takeover path. Nothing in a happy-path test would catch it.

**`req` surface:**

| Member | Type | Notes |
| :--- | :--- | :--- |
| `req.body` | object \| `null` | Already parsed, resolved **once**. For multipart, the text fields. `ctx.body` is preferred when present so the limiter and the controller structurally cannot disagree. |
| `req.ip` | string | `ctx.ip` preferred over recomputation — it is the value every limiter just used. |
| `req.path` | string | Mount-relative in Express; here the absolute pathname. |
| `req.method` | string | Upper-cased. |
| `req.headers` | `Headers` | The raw WHATWG object. |
| `req.user` | document \| `null` | `ctx.user ?? null`. `null` and not `undefined` on purpose: an unguarded `req.user.id` becomes a plain `TypeError` → 500, rather than a query for a document whose id is `undefined`. |
| `req.cookies` | null-prototype object | Fresh `parseCookies`; `null` header values normalised to `undefined` in `req.get`. |
| `req.query` | null-prototype object | Repeated keys become **arrays** (`?a=1&a=2` → `{a:['1','2']}`), matching Express's `qs`, **not** `Object.fromEntries` which would keep only the last. |
| `req.params` | object | Always passed; awaited internally. |
| `req.file` | object \| `undefined` | The **first** uploaded part. |
| `req.files` | array | All uploaded parts. |
| `req.get(h)` | `string \| undefined` | Case-insensitive; `null` normalised to `undefined`. |
| `req.userAgent` | string | Additive; used by certificate verification logging. |

**`res` surface:**

| Method | Behaviour |
| :--- | :--- |
| `res.status(n)` | Records the status, returns `res` so `res.status(n).json(x)` still chains. |
| `res.json(payload)` | Captures the body and **resolves**. This resolution is the whole trick — see §2.2. |
| `res.cookie(name, value, opts)` | **Queues**, never writes. A Route Handler's natural output is a bare `Response`, and `response.cookies` does not exist on one. |
| `res.clearCookie(name, opts)` | Queues a deletion (`value: ''`, `maxAge: 0`, `expires: epoch`), spreading the caller's options **first** so a 7-day `COOKIE_OPTIONS` cannot re-issue a cookie that is meant to be deleted. |
| `res.set(nameOrHeaders, value)` | Queues headers. Currently a no-op in practice: `http.js` overwrites `Cache-Control` unconditionally. |
| `res.end()` | Marks sent with no body. No ported controller calls it; it exists so the shim implements the whole surface. |

`collect.result()` is **async** and must be awaited: it replays the queued cookies through the same `next/headers` store `applyAuthCookie` uses (`applyQueuedCookies`) and then returns `{ status, body }`. Cookie failures are swallowed with a log rather than thrown — a failed cookie write must not convert a 200 into a 500.

**Uploaded files are `{ buffer, mimetype, fieldname, size, originalname }` and there is deliberately NO `path`.** `multer.diskStorage` wrote to `./public/temp`; there is no writable filesystem on Vercel, so the ported call sites read `buffer` instead. `buffer` is a getter over an already-resolved `ArrayBuffer`, memoised, and `Buffer.from(arrayBuffer)` creates a **view** over the same memory rather than a second copy — a lazy getter cannot work because `File` has no synchronous byte accessor, and handing a Promise to the Cloudinary SDK fails with `ENOENT` (the SDK treats a non-path as a file path). `mimetype` is client-supplied and is **not** a security control; real validation happens server-side in Cloudinary via `ALLOWED_FORMATS` (`jpg, jpeg, png, webp, gif, mp4, webp`, `webm`).

`fileField` reproduces multer's field filter (`upload.single('image')` / `upload.array('media', 20)` both filter to their named field). Omitting it collects every file part, which is a deliberate superset for the array consumer — so a route that mounts `upload.array('media')` **should** pass `fileField: 'media'`.

**`maxFiles` is not enforced and cannot be.** `createShim` accepts exactly `{ params, fileField }` and `splitFormData` has no file-count ceiling. Enforcing it after `createShim` would be theatre: the bytes are already resident, so the rejection would happen after the memory cost it exists to prevent. What actually bounds a multi-file upload is the platform: Vercel rejects any body over 4.5 MB with `413 FUNCTION_PAYLOAD_TOO_LARGE` **at the edge**, and `readMultipart` rejects any single file over `MAX_UPLOAD_BYTES` (4 MiB). `upload.array('media', 20)`'s 20-file ceiling is therefore unreachable in practice.

### 2.5 `controllers/` — 13 files, ported

`src/lib/server/controllers/` contains 13 controllers (`admin`, `adminContent`, `adminRole`, `auth`, `bootcampLeaderboard`, `certificate`, `comment`, `contact`, `content`, `post`, `project`, `user`, `visitor`) plus 2 services (`certificate.service.js`, `statistics.service.js`). The controller bodies are the Express bodies. Every change from the original is loud, in a comment, and cited to a line in `cpccu-server`.

> **Count note:** `handler.js:13` and `shim.js` refer to "~44 non-admin endpoints" and "eleven controllers". The real figures are **65 endpoints** and **13 controllers** (the "eleven" refers to the admin content *collections* handled by `adminContent.controller.js`, which is accurate for its own scope). `handler.js`'s reference to "24 files under `src/app/api/v1/admin/`" in `admin/roles/route.js:22` is also stale — there are **16 files / 24 endpoints** there.

---

## 3. The endpoint table

**65 endpoints across 53 files.** `public` = anonymous, no credential required. `authenticated` = `verifyToken` required. `admin` = authenticated **and** role-gated via `adminAuth.js`.

### Health (1)

| Method | Path | Auth | Controller |
| :--- | :--- | :--- | :--- |
| GET | `/api/v1` | public | inline (`text/html` string) |

### Auth (8)

| Method | Path | Auth | Limiter | Notes |
| :--- | :--- | :--- | :--- | :--- |
| POST | `/api/v1/auth/register` | public | `registration` (100/h/IP) + `registration-email` (5/h/email) | order is load-bearing; see `handler.js:419-467` |
| POST | `/api/v1/auth/login` | public | `login` (10/15min/IP) | `rejectMultipart: true` |
| POST | `/api/v1/auth/send-otp` | public | `auth-email` (5/15min/IP) | |
| POST | `/api/v1/auth/verify-registration` | public | `otp-verification` (5/10min/IP) | |
| GET | `/api/v1/auth/refresh-token` | public | **none** | deliberately: it is not a guessing surface, and throttling it would log every user out once per access-token lifetime |
| GET | `/api/v1/auth/logout` | authenticated | — | |
| GET | `/api/v1/auth/reset-link/:email` | public | `auth-email` | |
| PATCH | `/api/v1/auth/reset-password` | public | `password-reset` (10/15min/IP) | |

### Users (9)

| Method | Path | Auth | Limiter | Notes |
| :--- | :--- | :--- | :--- | :--- |
| GET | `/api/v1/users/user` | authenticated | — | own document, `PUBLIC_ITEM` |
| DELETE | `/api/v1/users/user` | authenticated | — | hard delete, no cascade |
| GET | `/api/v1/users/user/:id` | **public** | — | `PUBLIC_MEMBER_ITEM`; `:id` is an ObjectId **or a `uniID`** |
| PATCH | `/api/v1/users/userInfo-update` | authenticated | — | |
| PATCH | `/api/v1/users/user/upload-image/:key` | authenticated | `user-upload` (20/h/user) | `fileField: 'image'` |
| PATCH | `/api/v1/users/password` | authenticated | — | |
| POST | `/api/v1/users/job-pipeline-request` | authenticated | — | |
| DELETE | `/api/v1/users/job-pipeline-request` | authenticated | — | |
| GET | `/api/v1/users/member` | **public** | `member-list` (60/min/IP) | the whole collection in one response |

### Certificates (4)

| Method | Path | Auth | Notes |
| :--- | :--- | :--- | :--- |
| GET | `/api/v1/certificates/verify` | public | search by `certificateId` / `recipientName` / `recipientId` |
| GET | `/api/v1/certificates/verify/:certificateId` | public | **canonical replacement** for the unmigrated root `/verify/:certificateId` |
| GET | `/api/v1/certificates/stats` | public | |
| GET | `/api/v1/certificates/recent` | public | |

### Posts (3)

| Method | Path | Auth | Limiter | Notes |
| :--- | :--- | :--- | :--- | :--- |
| POST | `/api/v1/posts/create-post` | authenticated | `user-upload` (20/h/user) | `fileField: 'media'`, `maxFiles: 20` (unenforced) |
| PATCH | `/api/v1/posts/update-post/:id` | authenticated | `user-upload` | `fileField: 'media'`, `maxFiles: 20` (unenforced) |
| DELETE | `/api/v1/posts/delete-post/:id` | authenticated | — | |

### Projects (5)

| Method | Path | Auth | Notes |
| :--- | :--- | :--- | :--- |
| GET | `/api/v1/projects` | authenticated | |
| POST | `/api/v1/projects` | authenticated | |
| PATCH | `/api/v1/projects/:id` | authenticated | filter is `{ _id, userId: req.user._id }` |
| DELETE | `/api/v1/projects/:id` | authenticated | same |
| GET | `/api/v1/projects/user/:userId` | **public** | no id validation; see §6 |

### Comments (3)

| Method | Path | Auth | Notes |
| :--- | :--- | :--- | :--- |
| POST | `/api/v1/comments/create-comment/:postID` | authenticated | |
| PATCH | `/api/v1/comments/update-comment/:commentID` | authenticated | the one place the port became **more correct** — see §5 |
| DELETE | `/api/v1/comments/delete-comment/:commentID` | authenticated | |

### Public content (2)

| Method | Path | Auth | Notes |
| :--- | :--- | :--- | :--- |
| GET | `/api/v1/content/:resource` | public | `:resource` allow-list in the controller |
| GET | `/api/v1/content/statistics` | public | |

### Contact (1)

| Method | Path | Auth | Limiter | Notes |
| :--- | :--- | :--- | :--- | :--- |
| POST | `/api/v1/contact/messages` | **public** | `contact` (3/min/IP) | field-picked + validated; see §5 |

### Visitor (4) — two mount points, on purpose

| Method | Path | Auth | Notes |
| :--- | :--- | :--- | :--- |
| GET | `/api/visitor` | public | **this is the mount the client calls** |
| POST | `/api/visitor/increment` | public | |
| GET | `/api/v1/visitor` | public | reproduces the Express router's `/v1/...` entries inside the `/api` mount |
| POST | `/api/v1/visitor/increment` | public | |

The Express router registered four handlers across two prefixes (`app.use('/api', visitorRoutes)` serving both `/visitor…` and `/v1/visitor…`). Both trees are reproduced. `api/visitor/route.js:23-29` says the duplication **must not be collapsed**: this is the tree the client actually uses (`VisitorCounter.jsx:12` builds `/api/visitor`, appending `/v1` only when the base URL is external). Deleting it would be a breaking change to a shipped client for zero benefit.

### Bootcamp leaderboard (1)

| Method | Path | Auth | Notes |
| :--- | :--- | :--- | :--- |
| GET | `/api/v1/bootcamp-leaderboard` | public | Google Sheets; `res.set('Cache-Control', 'no-store')` is a no-op the wrapper already guarantees |

### Admin (24) — every one carries `admin: true`

| Method | Path | admin | moderator | mentor |
| :--- | :--- | :--- | :--- | :--- |
| GET | `/api/v1/admin/roles` | allow | allow (GET) | deny |
| POST | `/api/v1/admin/roles` | allow | deny | deny |
| GET | `/api/v1/admin/roles/active` | allow | allow (GET) | deny |
| PATCH | `/api/v1/admin/roles/:id` | allow | deny | deny |
| PATCH | `/api/v1/admin/roles/:id/toggle` | allow | deny | deny |
| GET | `/api/v1/admin/overview` | allow | allow (GET) | allow |
| POST | `/api/v1/admin/uploads/image` | allow | **ALLOW** | deny |
| GET | `/api/v1/admin/members` | allow | allow (GET) | allow |
| POST | `/api/v1/admin/members` | allow | deny | deny |
| PATCH | `/api/v1/admin/members/:id` | allow | deny | deny |
| DELETE | `/api/v1/admin/members/:id` | allow | deny | deny |
| GET | `/api/v1/admin/statistics` | allow | allow (GET) | allow |
| GET | `/api/v1/admin/system-settings` | allow | allow (GET) | deny |
| PATCH | `/api/v1/admin/system-settings` | allow | deny | deny |
| GET | `/api/v1/admin/certificates` | allow | allow (GET) | allow |
| POST | `/api/v1/admin/certificates` | allow | deny | deny |
| PATCH | `/api/v1/admin/certificates/:id` | allow | deny | deny |
| DELETE | `/api/v1/admin/certificates/:id` | allow | deny | deny |
| GET | `/api/v1/admin/content/:resource` | allow | allow (GET) | deny |
| POST | `/api/v1/admin/content/:resource` | allow | only `events`, `gallery`, `posts`, `gallery-events` | deny |
| PATCH | `/api/v1/admin/content/:resource/:id` | allow | same as POST | deny |
| DELETE | `/api/v1/admin/content/:resource/:id` | allow | same as POST | deny |
| GET | `/api/v1/admin/contributors` | allow | allow (GET) | deny (stale comment — see below) |
| PATCH | `/api/v1/admin/contributors/:githubUsername` | allow | deny | deny |

**Totals: 23 public · 18 authenticated · 24 admin = 65.**

**Nothing in the admin surface is `public: true`.** Authentication and role-gating are independent and neither implies the other.

Two things about this router you must not "fix":

- `admin/roles/route.js:11-41` explains why `admin: true` is a **per-file** flag. Express covered the whole surface with one `router.use(verifyToken, requireAdmin, authorizeAdminAction)`. App Router has no route-group middleware and no `route.js` that can wrap a directory, so the omission is now silent: a route that forgets the flag is still authenticated but performs **no per-action authorisation**. It reads as "authenticated" in review and ships an endpoint any member may call. `adminAuth.js` fails closed, so the only mistake this flag can make is the recoverable direction — but there is no longer a router-level default to fall back on.
- `adminAuth.js:92-97` records a **stale comment in the Express source**: `cpccu-server/src/routes/admin.route.js:76` says `/contributors` is readable by mentors. The code denies them (`contributors` is not in `mentorReadPaths`). The code is authoritative. Do not add it to `mentorReadPaths` "to match the comment".

---

## 4. Environment variables

**Authoritative source: [`.env.sample`](../.env.sample).** It is a real, loadable dotenv file: every variable is written as `KEY=` with an **empty** value.

> **`.env.sample` ships zero values deliberately.** A value a developer can copy out of a committed file becomes a value that ships — a plausible default signing key means every deployment that forgot to override it shares a secret with the whole internet. The file's own header says so. Values belong in the platform's environment-variable store (Vercel: Project → Settings → Environment Variables) and, locally, in a gitignored `.env.local`.

### 4.1 Client

| Variable | Purpose |
| :--- | :--- |
| `NEXT_PUBLIC_API_BASE_URL` | The API base URL the client calls. **Still points at the retired Express origin** (`http://localhost:5000/api/v1`) — see below. |

> **This value is STALE and is left exactly as it was on purpose.** It must be repointed at `/api/v1` (relative) or `https://<host>/api/v1`. Repointing is a **separate, coordinated frontend task** (§9), because the client also assumes a cross-origin API today, which the same-origin cookie and CSRF design in `request.js` now expects to be unnecessary. Half-changing it here would break the still-running Express path.

### 4.2 Database

| Variable | Purpose |
| :--- | :--- |
| `MONGODB_URI` | **Hard-required** by `env.js`. Without it `db.js` string-concatenates into the nonsense host `"undefined/CPCCU"` and the failure surfaces as a DNS error pointing nowhere near the cause. |

### 4.3 Auth: signing secrets and lifetimes

| Variable | Purpose |
| :--- | :--- |
| `ACCESS_TOKEN_SECRET` | **Hard-required.** Signs the access token. |
| `REFRESH_TOKEN_SECRET` | **Hard-required.** Signs the refresh token. |
| `PASSWORD_TOKEN_SECRET` | **Hard-required.** Signs the password-reset `code`/`token` pair. |
| `ACCESS_TOKEN_EXPIRE` | jsonwebtoken `expiresIn` (e.g. `15m`). **Load-bearing in a way that is easy to miss**: the transparent-refresh path in `auth.js` only works *because* the access token is short-lived. Removing it or setting it huge changes the failure mode from "silently refreshed" to "every user hard-logged-out". |
| `REFRESH_TOKEN_EXPIRE` | Refresh token lifetime (7 days in practice). |
| `PASSWORD_TOKEN_EXPIRE` | Reset-link lifetime (`RESET_TIME`, 5 minutes). |

Each secret must be a long random string (`openssl rand -base64 48`) and each must be **different** from the others: reusing one key across three token types means a token minted for one purpose verifies for the others.

### 4.4 Cloudinary

| Variable | Purpose |
| :--- | :--- |
| `CLOUDINARY_CLOUD_NAME` | Read by destructuring in `cloudinary.js`, so a `process.env.NAME` grep misses it. |
| `CLOUDINARY_API_KEY` | Same. Required together with the other two. |
| `CLOUDINARY_API_SECRET` | Same. |
| `CLOUDINARY_UPLOAD_PRESET` | Read only by the **unsigned** upload path. `adminContent.controller.js` also reads it — and currently honours a caller-supplied `uploadPreset` over this value. Recorded finding (M4), not a documented feature. |

### 4.5 Transactional email (Resend)

| Variable | Purpose |
| :--- | :--- |
| `RESEND_API_KEY` | Authenticates outbound OTP, reset and welcome mail. The Resend client is constructed **per call** in `sendEmail.js` so a missing key cannot break a module import; it fails on first send instead. |
| `WEB_DOMAIN` | Used for **two** things: `sentOtp.js` reads it to build the host of a password-reset link, and `request.js` reads it as a seed of the CSRF origin allow-list. Bare origin, scheme, no trailing slash (e.g. `https://cpccu.club`). A wrong value means reset emails point at the wrong host **and** cross-site requests from the real site are 403'd. |

### 4.6 CSRF origin allow-list

| Variable | Purpose |
| :--- | :--- |
| `NEXT_PUBLIC_SITE_URL` | A single origin, used as a seed. Its apex and `www.` siblings are added automatically, so listing only one half of a pair is not a mistake. |
| `EXTRA_ALLOWED_ORIGINS` | Comma-separated, for hosts that are genuinely neither (staging, preview). **Additive only** — it cannot remove a configured domain, and it cannot make a bare `Sec-Fetch-Site: same-site` request acceptable unless the caller actually sends one of these origins. It exists so adding a host is an env change, not a PR against a security-critical allow-list. |

`NEXT_PUBLIC_API_BASE_URL` is deliberately **not** consulted for the allow-list: it is the API's own address, and a request *from* the API's address is not a browser origin.

### 4.7 Error reporting

| Variable | Purpose |
| :--- | :--- |
| `VERBOSE_ERRORS` | `true` forces raw error messages on a production host; `false` forces redaction on a host that is not reporting itself as production; **empty** keeps the `NODE_ENV` default. Checked as an explicit string equality, so `VERBOSE_ERRORS=0` does not accidentally enable it. |

### 4.8 Feature-specific

| Variable | Read by | Purpose |
| :--- | :--- | :--- |
| `CONTRIBUTOR_GITHUB_TOKEN` | `adminContent.controller.js` only | Authenticates the GitHub API call that regenerates the contributor list. Unauthenticated GitHub requests are heavily rate-limited and fail intermittently. **Must be a fine-grained PAT scoped to one repo and one path** — see §10. |
| `GOOGLE_SHEETS_API_KEY` | `bootcampLeaderboard.controller.js` only | Authenticates the Sheets API. |
| `BOOTCAMP_SHEET_ID` | `bootcampLeaderboard.controller.js` only | Names the sheet. Needed together with the key. |
| `NODE_ENV` | `errors.js`, `auth.js`, `constants.js` | **Do not set it by hand** in `.env`. Next inlines `production` at build time and the platform sets it. Do not set it to `production` locally: the non-production branch is the only thing that returns a real error message during debugging. Use `VERBOSE_ERRORS` to force either direction on a real host. |

### 4.9 The four hard-required variables

`env.js` validates exactly these, **lazily, on first use**, and throws one aggregated, secret-free error naming every missing one:

```
ACCESS_TOKEN_SECRET, REFRESH_TOKEN_SECRET, PASSWORD_TOKEN_SECRET, MONGODB_URI
```

The reason they are validated lazily and not at module load is §5.1. The reason they are validated at all: without them, `jsonwebtoken` throws `secretOrPublicKey must have a value` from inside `jwt.verify`, which `auth.js` catches and flattens to a generic `401 Invalid access token` — so with `ACCESS_TOKEN_SECRET` unset, **every user on the site is signed out, every login returns an unauthenticated-looking 401, and nothing anywhere says the variable is missing**.

---

## 5. Deliberate divergences from the Express original

Every item here is a reviewed decision, not a bug. Each is stated in the code at the top of the module that implements it.

### 5.1 Lazy Cloudinary config and lazy `env` validation

`cloudinary.js:64-87` — the original `cpccu-server/src/config/cloudinaryConfig.js:8-13` threw at **module top level** when the Cloudinary env vars were absent. In a Next app that module is transitively imported by nearly every controller, so a top-level throw fails `next build` for **every** route, including ones that never touch an image. Configuration is now validated and applied on first call and memoised per warm instance (`getCloudinary`).

`env.js:17-25` — same root cause for the config modules. The error is raised on first use of the secret instead, so it fails the one request that needs it, with a message that **names the variable**.

`auth.js:22-28` — `signingSecrets()` calls `validateEnv()` then reads the two secrets, so a missing secret produces "Missing required environment variable(s): ACCESS_TOKEN_SECRET" rather than a flattened, indistinguishable 401 for every user.

> Without these three changes, **`next build` is impossible without production secrets present.**

### 5.2 `sameSite: 'none'` → `'lax'` + env-conditional `secure` — the CSRF fix

`constants.js:111-155`. The original used `'none'` because the browser app on a different origin called an API on another origin, so the cookie had to be cross-site-capable. That whole topology disappears: the API is mounted **inside** the Next app at `/api/...`, so it is same-origin. Once the client stops calling cross-origin there is no cross-site cookie to permit, and `'none'` (which *requires* `Secure` and explicitly opts into cross-site sending) is pure attack surface.

`'lax'` still satisfies everything the app needs: same-site `fetch`/XHR, and top-level GET navigation — which is what the `/reset-password/[code]/[token]` email link relies on, exactly the one case `'strict'` would break.

`secure` is now conditional on `NODE_ENV` rather than hard-coded `true`. On plain `http://localhost:3000` a `secure: true` cookie is silently **refused** by the browser, so the transparent refresh never fires and every session dies after the 15-minute access-token expiry — with no error and no console warning. A hard-coded `secure: true` remains in force for every deployed environment.

`path: '/'` was **added** (it was not in the Express original). Express defaults an unset cookie `path` to the route that set it, so every `res.cookie(...)` was pinned to whatever sub-path served it; porting that omission makes logout silently fail to match the cookie it is clearing.

**The second layer: `assertSameOrigin` (`request.js:457-488`).** It has **no Express counterpart** — the original was structurally CSRF-vulnerable (`sameSite: 'none'`, cookie read *before* `Authorization`, `express.urlencoded()` mounted), so a bare cross-site `<form method="POST">` (no JS, no custom headers, no preflight) arrived fully authenticated.

| Signal | Result |
| :--- | :--- |
| `Sec-Fetch-Site: same-origin` or `none` | allowed (`none` = direct navigation — the email link) |
| `Sec-Fetch-Site: same-site` | allowed **only** with an allow-listed `Origin`. A sibling subdomain (`staging.cpccu.club`), a compromised subdomain, or `cpccu.club.attacker.net`'s cookie scope all satisfy `same-site`, and that is a far more realistic threat than a bare cross-origin form POST — which `SameSite=Lax` already blocks. |
| `Sec-Fetch-Site: cross-site` (or anything else) | 403 `Cross-origin request rejected` |
| No `Sec-Fetch-Site`, allow-listed `Origin` | allowed |
| No `Sec-Fetch-Site`, no `Origin`, **but `Authorization: Bearer …`** | allowed. `Authorization` is a CORS non-simple header, so a cross-site page must preflight to set it and this API never answers a preflight, and the token is not in a jar an attacker's page can read. Such a request is structurally not CSRF-able. |
| No `Sec-Fetch-Site`, no `Origin`, no bearer | 403. Rejecting outright (which this function originally did) 403'd `curl`, mobile/CLI clients and integration tests on every unsafe method. |
| `GET` / `HEAD` / `OPTIONS` | exempt (`SAFE_METHODS`) |

`Sec-Fetch-Site` is the primary signal because a page cannot forge it and it is not settable from JavaScript at all; the missing-header `Origin` fallback is explicitly documented as weaker and as defence in depth **behind** `SameSite=Lax`, not a replacement for it.

### 5.3 `MAX_UPLOAD_BYTES` 5 MB → 4 MB, plus a separate JSON body cap

`constants.js:6-97`. Vercel rejects **any** request body over 4.5 MB with `413 FUNCTION_PAYLOAD_TOO_LARGE` at the edge. A 5 MB cap is therefore unreachable by construction: the request never reaches the function and the client sees an opaque platform error instead of the documented 400. Keeping the limit just under the platform ceiling means **our code** produces the documented 400. 4 MiB leaves ~0.36 MB for multipart framing.

There are now **two** caps, deliberately:

| Constant | Value | Governs |
| :--- | :--- | :--- |
| `MAX_UPLOAD_BYTES` | 4 MiB | `multipart/form-data` only (the multer `fileSize` port) |
| `MAX_JSON_BODY_BYTES` | 4 MiB | everything else (the `express.json`/`urlencoded` port) |

Reusing the upload cap for JSON was a real bug: a 5 MB `application/json` POST was answered *"Profile picture must be at most 4MB."* — an upload error message on a request that carried no file. `assertBodySizeWithinLimit` (`request.js:363-388`) now picks the cap **by content type**, and each message is derived from its own number so they cannot drift.

**Status change, declared:** the Express original did **not** reject an oversized JSON body with a 4xx at all. body-parser's `PayloadTooLargeError` matched none of the four branches of the error handler in `app.js:78-117` and fell through to the catch-all, so it was returned as a **500** with body-parser's raw `'request entity too large'`. This port returns **400** with a message naming the actual limit. Both axes are deliberate: a 500 blames the server for a client mistake, and the original text told the caller nothing about the ceiling it exceeded.

`uploadSizeMessage()` says "at most 4MB", not "less than 4MB", because every comparison against the cap is a strict `>` — a body of exactly 4 MiB is accepted. The old wording told a user to retry with a file the server would reject again.

### 5.4 Streaming Cloudinary upload instead of `multer.diskStorage`

`cloudinary.js:248-403`. `multer.diskStorage` wrote to `./public/temp` and `uploadOnCloudinary` then called `fs.unlinkSync(localFilePath)`. Both halves are fatal on Vercel: the bundle is read-only, `/tmp` is the only writable path, and an execution lives only for the duration of the request. The ported call sites read `file.buffer` instead.

**Why a stream and not a base64 data URI.** A data URI inflates the payload by exactly 4/3 (4 MiB → a 5.59 MB string, which V8 holds as ~11 MB because base64 is ASCII in UTF-16) and the receiver decodes it again. On top of the `formData()` buffer and the `arrayBuffer`/`Buffer.from` copies already resident, peak memory for one 4 MiB upload was **measured at ~35–40 MB** — and Vercel's 4.5 MB cap limits per-**request** size, not **concurrency**, so ~50 concurrent uploads exhaust a 2 GB instance and the OOM kill takes out every co-resident function.

**Why `upload_stream` and not `upload(source)`.** Verified against the installed SDK (`cloudinary@2.11.0`): `uploader.upload(file, cb, opts)` accepts **only** a remote/data-URI string (which it forwards as the `file` form field) or a local filesystem path (which it feeds to `fs.createReadStream`). A `Buffer`, `Blob` or stream is silently treated as a **path** and fails with `ENOENT`. `upload_stream` returns a writable synchronously, so the result is only observable through the callback; both the source-error and writable-error paths are wired, or a truncated body would leave the promise pending until the platform killed the invocation.

Also added: `ALLOWED_FORMATS = ['jpg','jpeg','png','webp','gif','mp4','webm']` as a **server-side** allow-list, validated by Cloudinary against the sniffed bytes (the multipart `Content-Type` is client-supplied and means nothing). The Express original had no `fileFilter` at all.

`describeSdkError` logs an explicit four-field allow-list (`message`, `http_code`, `error.message`) instead of the raw error object, which can carry the entire base64 payload **and the account API secret** in the request config.

### 5.5 The refresh path no longer returns `refreshTokens`

`auth.js:141-186`. The Express original selected only `-password` on the `TokenExpiredError` branch, so the returned document carried **every live 7-day refresh token string**, and any controller that serialised the authenticated user handed all of them to the browser — a credential leak, and a self-inflicted one, since the browser then holds a live session token for every device that account has ever signed in from. Reproducing a credential leak into new architecture is not acceptable, so this is a declared divergence.

The consequence is that the live-token revocation check cannot run on that document (`select('-refreshTokens')` removes the field, so `.some` on `undefined` would throw a `TypeError` and the catch would log **every user out** every 15 minutes). The check is therefore performed against a **second, tightly-projected query** (`.select('refreshTokens').lean()`) whose result never leaves `auth.js`. One extra query on this path is the right trade: it runs at most once per user per access-token lifetime, and the alternative is publishing the tokens themselves.

Related and narrower: the `auth.js` search order (`verifyToken` accepts the `accessToken` **cookie** before the `Authorization` header) is preserved, including the `authorization?.replace('Bearer ', '')` bug — a string first argument replaces the first occurrence *anywhere*, so `XBearer eyJ…` becomes `X eyJ…`. It fails closed and must not be "corrected" into something that accepts a token found anywhere in the header.

### 5.6 Error-message redaction in production, plus the `VERBOSE_ERRORS` override

Two places, deliberately consistent:

- **The 500 branch** (`errors.js:120-214`). Express sent `err.message` verbatim, leaking Mongo connection strings, file paths and driver stack text. The response **shape** is preserved exactly (`{ status: 500, message }`, no `errors` key — that asymmetry matters because the frontend reads `errors` conditionally on some endpoints). In production the message becomes `"Internal Server Error"`; the real error is logged **unconditionally**, because redaction belongs on the wire, not in the operator's own logs. (An earlier revision gated the log on `NODE_ENV`, which meant local dev and preview deploys emitted no stack trace while still returning the raw message — the one environment where you are diagnosing the failure was the one with no log.)
- **The JWT branch** (`auth.js:233-238`). The original returned raw `jsonwebtoken` text — "jwt malformed", "invalid signature" — which is a free forgery oracle: the difference tells an attacker whether their forged token was structurally well-formed. The 401 and the shape are unchanged; only the message is generalised. Gated on `NODE_ENV` so a developer debugging locally still sees which error it was.

**`VERBOSE_ERRORS` overrides `NODE_ENV` in BOTH directions** and is checked first, as an explicit `=== 'true'`. The problem it exists for: `NODE_ENV` is set by the build and the platform, not by this app, so a real host configured with `NODE_ENV` unset or `development` serves a **production database** while taking the non-redacting branch. `VERBOSE_ERRORS=false` on such a host fixes it; `VERBOSE_ERRORS=true` on a production host is the documented live-debug escape hatch and is deliberately the more dangerous setting — it must be an explicit, greppable, removable act.

### 5.7 Per-limiter rate-limit key namespacing

`rateLimit.js:50-78`. This file originally shipped one module-global store — the obvious refactor — which silently merged all seven key spaces and produced two distinct security failures that neither throw nor log:

1. **Window collision.** `resetAt` is written by whichever limiter created the entry, and it decides when that window ends. With 6 of 7 limiters keyed on the bare `ctx.ip`, a POST to `/contact` (60 s window) followed by a POST to `/login` leaves the login counter governed by a 60 s window — turning "10 per 15 minutes" into roughly "10 per minute", a **~15× weakening** of the credential-guessing control, with the limiter still reporting itself correctly configured.
2. **Cross-limiter eviction.** `maxKeys` was documented as a property of the email limiter's own map; on a merged store, evicting "the oldest key" removes the oldest entry **regardless of owner**. Spraying 10,000 distinct emails at registration evicts every live per-IP counter in the process — including the login counter — which is an attacker-controlled bypass requiring no clever payload, just volume.

The fix: every key is namespaced `${name}:${key}`, eviction scans only the calling limiter's own prefix, and a per-limiter live count drives the `maxKeys` check. A duplicate `name` is now rejected at construction time. `DEFAULT_MAX_KEYS` also changed from `Infinity` to **50,000** on the IP-keyed limiters: the Express process died with its `Map`, a warm Vercel instance does not, and an unbounded key space on a 2 GB instance is an OOM. (The per-email limiter's explicit `maxKeys: 10000` is unchanged.)

### 5.8 `proxy.ts` matcher excludes only static assets — `api/` must **not** be re-added

`src/proxy.ts:55-109`. The matcher is:

```js
'/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)'
```

`api/` is **deliberately absent**, and a previous revision that added it was a real logic error, not a safety margin. Read the pattern as a regex: `^/((?!api/|…).*)$` — the leading `/` is a literal consumed **first**, so the negative lookahead is evaluated against the *remainder* (`api/v1/auth/login`), where `api/` matches, the lookahead fails, and the whole path fails to match. The term intended to exclude `/api` excluded **nothing**, while its comment confidently asserted `/api` was included. Any reader trusting that comment was reasoning about a matcher that did not exist.

The reasoning that produced the term (stated precisely, so you can evaluate it yourself): when the proxy **matches** a path, Next clones and buffers the request body so both the proxy and the route handler can read it. The ceiling is `experimental.proxyClientMaxBodySize`, **default 10 MB**, and exceeding it is not an error — the body is "only buffered up to the limit", a warning is logged, and **nothing is returned to the caller**. A handler silently receives a short body and a multipart upload is corrupted in transit with no visible failure.

**That ceiling is unreachable for `/api` on Vercel**, which is the point: the edge 413s at 4.5 MB, strictly below 10 MB, before the request reaches the function. Do not re-add `api/` believing it is a body-safety measure; there is no such effect to be had, only the bug it already caused. `http.js`'s `withApiHeaders` sets `nosniff` and `no-store` as the backstop for exactly this reason, and is documented as **not** redundant with the proxy.

### 5.9 `adminAuth`'s signature collapsed to `{ method, pathname }`

`adminAuth.js:152-258`. `requireAdminAction(user, { method, pathname })` derives `resource`, `isUpload` and the **mount-relative** `path` internally via `describeAdminRoute`, and there is now no way to supply them.

The derivation matters more than the signature. The Express middleware read `req.path.split('/')[2]` as the resource, which works only because a mounted router presents a **mount-relative** path. A naive port is a silent authorisation failure **in both directions**: copied as-is, `resource === 'v1'` (the App Router pathname is absolute), so every moderator write to posts/events/gallery is denied with a bare 403; "corrected" by using the last segment or inverting the index, the same code **silently grants** moderators writes they must not have. Neither throws.

The caller-supplied `resource` was a fail-**open** footgun in a function whose every other failure mode fails closed: a route that computed `pathname` correctly but hardcoded `resource: 'events'` on a `/content/gallery` route would grant a moderator a write, and nothing in the signature would flag it. `describeAdminRoute` also matches the mount prefix on a **segment boundary** (`pathname === mountPrefix` or `startsWith(mountPrefix + '/')`), so `/api/v1/administrator/…` is not stripped to `istrator/…`.

Two details preserved verbatim: only the literal string `'GET'` counts as a read (`HEAD` is **denied** — `req.method === 'GET'` was an equality test, not an idempotency check; do not "improve" it), and the upload check is an **exact** `===` while the mentor paths are real **prefixes**.

The pathname must reach `adminAuth` unre-written for any of this to hold. Three things guarantee that today and all three must keep holding: `next.config.mjs` declares no `rewrites`/`redirects` touching `/api`; `src/proxy.ts` returns a bare `NextResponse.next()`; and `http.js`'s `pathnameOf` falls back to parsing `request.url`. **If any of that changes the failure is silent and one-sided** — a stripped pathname yields `resource: null`, so every *moderator* write is denied while *admins* are entirely unaffected (because `role === 'admin'` returns true before any of it is consulted).

### 5.10 `updateCommentHandler`'s one-character fix

`comment.controller.js:86-107`. The original assigned to `updatedComment` **without declaring it**. ES modules are always in strict mode, so that is a `ReferenceError` — not a silent implicit global as it would be in non-strict CommonJS, which is why it went unnoticed in a codebase that uses ESM everywhere. The throw happens **after** the save, so the comment was edited in the database and the client was told it failed.

Consequence in the original, for **every single request** to `PATCH /api/v1/comments/update-comment/:commentID`: the write succeeded, the caller was told it failed, and a retrying client loops on a 500 it could never fix. There is no input — not an admin token, not an empty body — that avoided it.

The fix is `const`. A 500 becomes a working 200, with no behavioural change beyond the status code. This is the **only** place in the migration where a ported controller became more correct rather than more faithful, and it is flagged for exactly that reason: a behaviour change made silently during a migration is how nobody notices the next one.

### 5.11 `auth.controller`'s unwrapped `jwt.verify` wrapped into a 401

`auth.controller.js:473-508` ("Divergence 1 of 3", security-mandated). `refreshAccessToken` called `jwt.verify(incomingRefreshToken, REFRESH_TOKEN_SECRET)` with no `try`, so a forged, truncated, expired or non-JWT cookie threw a raw `jsonwebtoken` error that the Express handler shaped as a **500** whose message was the library's own text. Two problems, both real: a free forgery oracle, and a client condition (the cookie expired, the session was revoked) reported as a server fault — which sends the frontend hunting for a server problem, and a malformed cookie on the auto-refresh path is the single most common occurrence of it. Wrapped into a 401 with a redacted message, gated on `NODE_ENV` to match `auth.js`. The 401 and the response shape are unchanged; only the status and the message are.

`resetPasswordHandler`'s `jwt.verify` (`auth.controller.js:661-665`) was **already** wrapped in the original and is left alone — the asymmetry between the two was itself the bug.

### 5.12 The narrowed anonymous member projection (`PUBLIC_MEMBER_ITEM`)

`constants.js:188-269`. `GET /api/v1/users/member` and `GET /api/v1/users/user/:id` are `public: true`, and previously projected through `PUBLIC_ITEM` — which includes `email`, `phone`, `uniID`, `roles`, `isValid`, `socialLinks`, `skills`, `coverImage`, `jobPipelineTitle`, `jobPipelineRejectionReason` and the two Cloudinary `*PublicId` values. One unauthenticated call to `/users/member` returned the entire membership's contact list.

`PUBLIC_MEMBER_ITEM` is an **allow-list** — a field is public because it is named, not because someone remembered to delete it:

```
_id fullName avatar bio department section batch github linkedin portfolio jobPipelineStatus
```

The load-bearing exclusions, each with its reason in the constant's docblock:

- **`email`, `phone`** — the only consumers are the `ContactSection`/`ProfileHero` "Email" row and the `AboutCard` `mailto:`, and both degrade to a hidden row rather than erroring. The two fields most likely to end up in a scraped dataset.
- **`roles`** — **this is the authorisation input, not profile data.** `adminAuth.js` grants the entire admin surface on `admin`/`moderator`/`mentor`, so publishing it on an anonymous endpoint hands an attacker a ranked target list: exactly which accounts are worth credential-stuffing, phishing, or targeted reset spam. It must never appear on a read that does not require a session.
- **`avatarPublicId` / `coverImagePublicId`** — these are Cloudinary **write primitives**, not display URLs. The delivery URL is `avatar`/`coverImage`; the `*PublicId` is the exact handle `destroy()` needs. Publishing a write primitive to an anonymous reader is a capability leak, not an information leak, and it is the single highest-value field on this schema to keep off a public read.
- **`jobPipelineRejectionReason`** — internal moderator feedback ("your title was rejected because…"). Publishing it is accidental disclosure, not a privacy question.
- **`isValid`** — see §9. Its removal has a real, user-visible consequence.

`PUBLIC_ITEM` is unchanged and still used for the admin panel, the self reads, and the `login` response; it must not be reintroduced on a `public: true` route.

### 5.13 The contact endpoint's field-pick + validation

`contact.controller.js:12-51`. The original did `ContactMessage.create(req.body)` — the **whole body, unvalidated**, on a `public: true` route. `ContactMessage` declares `status` (default `'unread'`), `receivedAt`, `repliedAt` and `reply` alongside the four public fields, so an anonymous caller could set every one:

- `status: 'read'` — the message never appears in the admin inbox; the sender suppresses their own spam from the moderators meant to see it.
- `receivedAt` — backdate to bury it or forward-date it, corrupting the ordering the inbox sorts by.
- `reply` / `repliedAt` — pre-fill text that `messages-content.jsx:174-178` renders as if the **club had sent it**. That is impersonation of the organisation to the people reading the inbox.

The port picks the four fields explicitly and validates each (present, string, non-blank, length-bounded; `email` shape-checked). Two consequences named in the code: the schema's `required: true` is now enforced by us before the write rather than by the driver at insert (same 400 class, better message), and any extra key a caller sends is now **silently ignored** rather than persisted — rejecting unknown keys would tell an anonymous caller which fields the schema knows, which is the enumeration this change exists to prevent.

This is a declared behaviour change: bodies the original accepted can now be 400'd. It is justified because the original behaviour was not "accept a contact message", it was "let an unauthenticated caller write arbitrary fields on an administrative record, including text the organisation is then displayed as having written".

### 5.14 `next.config.mjs` `images.remotePatterns` narrowed from `hostname: "**"`

`next.config.mjs:60-73`. The original `hostname: "**"` across http **and** https let the image optimiser fetch from **any** host: a real SSRF surface. A user-controlled `avatar`/`coverImage` URL pointing at `169.254.169.254` (the cloud metadata endpoint) or `127.0.0.1` would have been fetched by Vercel's image optimiser **from inside the deployment**, with the response returned to the attacker.

The list is now derived from actual `next/image` usage and is exactly two hosts: `res.cloudinary.com` (avatars, cover images) and `avatars.githubusercontent.com` (`AboutCard.jsx:10-16` via `AboutPage.jsx:7`, fed by `data/Committee.json`, `data/donators.json` and all 11 entries of `data/contributors.json`). Omitting the second takes the whole About page down at runtime with "Invalid src prop … hostname is not configured". Do not widen this back to a wildcard; add a host explicitly, and only after checking where that URL is stored and who can set it.

Also in `next.config.mjs`: `firebase-admin` was **removed** from `serverExternalPackages`. It was pulled in only for `POST /api/v1/auth/google-signin` and `/google-signup`, which the client never called, so it was dead code — and the largest attack surface the migration introduced (transitively dragging in `google-auth-library`, `node-forge`, `@grpc/grpc-js`). If Firebase auth is ever reintroduced it must be added back or the build fails on dynamic requires.

---

## 6. Preserved defects — NOT migration regressions

These were **faithfully carried over on purpose**. Every one is documented in the code at the point it occurs, usually with the reason it was not fixed. This is a faithful port of a system with known defects, not a clean-room rewrite — a cutover should be described in those terms. None of these is a regression introduced by the migration; all of them are now *in this repository* and therefore *your* problem.

| # | Defect | Where | One line |
| :--- | :--- | :--- | :--- |
| 1 | Unauthenticated user reads | `user.controller.js:250-252` | `GET /users/user/:id` and `GET /users/member` are anonymous and now narrowly projected, but the `uniID` lookup branch remains: a 404 vs a 200 confirms whether a Student ID is registered. It is an **enumeration oracle**, no longer a disclosure. Fixing it properly needs the client repointed at `_id` plus an explicit decision. |
| 2 | Unfiltered mass assignment on admin content | `adminContent.controller.js:1063` | `{ $set: req.body }` on **ten of the eleven** admin content collections. Only `profiles` goes through `buildDeveloperProfileUpdate`'s allow-list. Bounded by `getModel`'s collection list, `authorizeAdminAction`'s role matrix, and `runValidators: true` — but a caller can set any other schema field on that collection, including internal ones. Narrowing it is eleven product decisions, not a porting change. |
| 3 | Unfiltered settings write | `adminContent.controller.js:1199` | `updateAdminSystemSettings` does `{ $set: req.body }` with no allowlist and **no `runValidators`**, with `upsert: true`. Same mass-assignment shape as #2, on a document every page load may read. |
| 4 | Writable audit trail | `adminContent.controller.js:401` | `'audit-logs': AdminAuditLog` is in the `models` map, and `getModel` is used by the create/update/delete handlers as well as the reader — so `/admin/content/audit-logs` supports POST, PATCH and DELETE against the audit trail. An admin can forge or erase audit entries. |
| 5 | Missing audit entry on the most consequential action | `adminContent.controller.js:1072-1080` | The `profiles` branch **returns before** reaching `writeAuditLog`, so an admin approving or rejecting a developer profile leaves no audit record. The other ten resources are audited. |
| 6 | No-op regex escape | `adminRole.controller.js:160` | `slug.replace(/[.*+?^${}()|[\]\\]/g, '\$&')` — one backslash, and JavaScript has no `\$` escape, so the replacement is the bare string `$&`. Every metacharacter survives into the finished pattern. `Vice (President)` becomes `^vice-(president)$` (a group) and reports a spurious 409; `.*` becomes `^.*$` and matches anything. The direction is match-**broadening** only, and the unique index on `slug` still protects the write. `adminContent.controller.js:707` has the same helper and gets it right (`'\\$&'`) — do **not** align them. |
| 7 | Password policy inconsistency | `user.controller.js:616` | `changePassword` accepts **6** characters against a published 8+ character-class policy enforced by `validatePasswordStrength` on registration and reset. The comment records that narrowing it would break every member whose current password was set through this route. |
| 8 | Refresh tokens survive a password reset | `auth.controller.js:692-696` | `resetPasswordHandler` deliberately does not clear `refreshTokens`, so a stolen refresh token outlives a reset. Changing it would invalidate every other signed-in device as a side effect of a security fix — a product decision, not a porting one. Same at `user.controller.js:625-627` for `changePassword`. |
| 9 | Orphaned Cloudinary assets | `post.controller.js:158-167` | `post.media` is overwritten wholesale, so any asset dropped from it is still live in Cloudinary and the application keeps **no record** of it — not the public id, not the URL. Not recoverable after the fact. The fix requires adding a public id to the `media` sub-schema plus a diff-then-destroy pass: a schema migration with a backfill, not something to smuggle into a port. |
| 10 | Hard deletes with no cascade | `user.controller.js:644-647`, `adminContent.controller.js:1113`, `:1399`, `post.controller.js` delete | Deleting a user, a post, a project or a certificate leaves posts, comments, projects and developer profiles behind. `deleteOwnAccount`'s own comment says a real cleanup would need a per-collection decision (anonymise vs delete) that is a product call. |
| 11 | GETs that perform writes | `adminRole.controller.js:94`, `:110` | `getAdminRoles` and `getActiveRoles` both call `seedDefaultRoles()` first — ten sequential `findOneAndUpdate({slug}, …, {upsert: true})` writes on **every** GET. Preserved as a self-healing catalogue. These GETs are not GET-safe, not cacheable, and would be rejected by a read-only replica. (`Cache-Control: no-store` is already unconditional, so nothing is at risk of being cached.) Separately, the **public** `GET /certificates/verify*` routes write a `CertificateVerificationLog` on every attempt by design — that one is the audit trail, not a defect. |
| 12 | `Boolean("false") === true` | `adminRole.controller.js:206-209` | `updateAdminRole` does `update.active = Boolean(active)`, so the string `"false"` and the number `0` both become `true`. A panel that sends a checkbox as a string **cannot switch a role off** through this endpoint. |
| 13 | Non-atomic role toggle | `adminRole.controller.js:227-252` | `toggleAdminRole` is read-then-write: two concurrent toggles both read the same starting value, both write the same opposite value, and one intended flip is lost. The atomic form is a single `findByIdAndUpdate` with `$set: { active: { $not: ... } }`. Preserved because the panel issues one toggle at a time and the response body carries the resulting state. |
| 14 | `maxFiles` declared but unenforced | `handler.js:330-354` | `defineRoute` accepts and validates `maxFiles`, and emits a one-time `console.warn` that it is documentary only. `createShim` takes exactly `{ params, fileField }` and `splitFormData` has no count ceiling. A silent no-op option is worse than a missing one, which is why the warning exists. Bounded in practice by Vercel's 4.5 MB edge cap. |
| 15 | `getPublicProjects` has no id validation | `project.controller.js:42-47` | Unlike almost every other handler, there is no `isValidIdentity` check on `:userId`; a malformed id makes Mongo return an empty array rather than a 400, and the portfolio section renders as empty. |

**Two more that are documented but worth naming here:** `adminRole.controller.js:196-203` calls `name.trim()` on the raw value, so a non-string `name` throws a `TypeError` → 500 instead of the 400 that follows, and the emptiness check that would catch a wrong type sits *after* the trim and can never fire. And `adminContent.controller.js:833-838`: `?sortOrder=desc` is **silently ignored** on exactly the six ordered collections, because the `||` there is a condition and `sortOrder === 'asc' || isOrderedResource` is evaluated as `(A || B) ? 1 : -1`.

---

## 7. The security review outcome

**No CRITICAL findings. No authentication bypass.** The migration was taken through multiple adversarial review cycles, including a dedicated security audit, and the results were:

| Area | Outcome |
| :--- | :--- |
| Authentication | No bypass. Auth-by-default holds; `auth` is rejected at module load; `public` is type-checked so `public: 'false'` cannot fail open; the refresh-cookie closure placement lets a refreshed token survive a handler that throws after authenticating. |
| Endpoint classification | **All 65 endpoints correctly classified.** `public: true` appears on **23** routes and every one of them was public in Express. Nothing in the admin surface is public. (Counted from the code: 23 `public: true` lines at config level, 24 `admin: true`, 18 authenticated-only.) |
| Admin role matrix | Independently re-derived **four times** — from the middleware source, from the API reference, from `describeAdminRoute`'s own output, and from a fresh reading of the final implementation — and matched **every time**. It is now recorded in `admin/roles/route.js:77-100`. |
| `parsePublicIdFromCloudinaryUrl` | Survived **six** attack shapes: lookalike host, `..` traversal, encoded traversal, `cpccu/../`, other cloud name, and encoded separators. The decisive constraint is that the derived public ID must start with `cpccu/`, the only folder this app writes to, so even a leaked URL can only destroy an asset this app created. |
| CSRF | Could not be bypassed. `sameSite: 'lax'` closes the cross-site cookie path; `assertSameOrigin` is the independent second layer; the `same-site` + allow-listed-`Origin` conjunction accepts the legitimate deployment shapes while refusing the sibling-subdomain attacker. |
| SSRF | `images.remotePatterns` narrowed from `hostname: "**"` (a real surface) to the two hosts actually used. |
| Cross-tenant deletion | `parsePublicIdFromCloudinaryUrl` is a hardened parser, not string splitting, because `destroyCloudinaryImage` runs against the **shared** Cloudinary account with the account-wide secret. |
| Secrets in logs | `describeSdkError` replaces raw SDK error logging; `validateEnv`'s message names variables only, never values, lengths or prefixes. |

**Fixed as a result of the review:**

- `PUBLIC_MEMBER_ITEM` — the anonymous member projection (§5.12).
- The contact endpoint's field-pick + validation (§5.13).
- The upload limiters: `memberListRateLimiter` (60/min/IP on the public directory) and `userUploadRateLimiter` (20/hour, keyed per authenticated user because of the university NAT) are **new**; before them, the profile-image and admin-image endpoints were unmetered.
- The `public` type check — `public: 'false'` (the string) was the single remaining fail-open mistake in an otherwise fail-closed design.
- `VERBOSE_ERRORS` — so the production-redaction decision no longer depends on a variable the application does not control.
- `authEmailRateLimiter` on `send-otp` and `reset-link`; `otpVerificationRateLimiter` on `verify-registration`; `passwordResetRateLimiter` on `reset-password`.

**Deferred by owner decision: real distributed rate limiting.** See §8.

**Two things the review explicitly did *not* certify**, because they are outside the codebase: whether the `cpccu-server` Express app it was ported from is currently exposed, and whether the client is correctly pointed at either backend.

---

## 8. The single largest open risk: rate limiting

**Read this before you decide to cut over.**

The default rate-limit store is an **in-process `Map`**. On Vercel each serverless function instance is a **separate OS process** with its own module registry and its own heap. A `Map` lives in that heap. Two requests to `/api/v1/auth/login` are very likely served by two different instances, and neither can see the other's counters.

`rateLimit.js:5-30` states it plainly:

> The result is that `loginRateLimiter` (10 / 15 min) and `contactRateLimiter` (3 / min) are effectively **UNENFORCED** — and they fail **SILENTLY**: no exception, no error response, no log line, nothing a health check would surface. The handler simply always allows.

It also fails in the **opposite** direction under a burst: a single warm instance that happens to receive several requests *does* enforce the cap, so the limit appears to work intermittently. That is worse than never working, because it presents as a flaky auth/contact bug rather than a missing shared store.

**`loginRateLimiter` is the only brute-force control on `POST /api/v1/auth/login`.** There is no account lockout, no per-account counter, and no CAPTCHA. The other layers are the controller's failure messaging and the password policy — neither of which stops a distributed credential-stuffing run. **This is the largest single risk in the migration and it is unresolved.**

`setRateLimitStore` is **written, validated and unwired**. It exists (`rateLimit.js:196-209`), it accepts an injected store, and it validates that the store implements **both** `hit` and `reset` — a store missing either is rejected with a `TypeError` at injection time rather than silently substituted, because a previous version only checked `hit` while its own docblock claimed such a store "is rejected up front". A falsy value **resets** to the default in-process store rather than assigning it. The store interface:

```
hit({ limiter, key, windowMs, maxKeys }) -> { count, resetAt }
reset({ limiter, key }) -> void
```

`limiter` is the limiter's unique `name` and is **not** optional bookkeeping — it is the key-space namespace, and without it every failure mode in §5.7 returns. `windowMs` and `maxKeys` are passed in rather than configured on the store, because a store physically cannot return `resetAt` without the window length. `reset` currently has **no caller**; it is declared and validated now so an injected store implements the full contract from day one.

The owner **deferred** adding a Redis/KV dependency: it needs credentials plus a failure-mode decision, so **no dependency was added here**. Note that `createRateLimiter` currently **fails open** on a store error (logs, returns `{ allowed: true }`), and the code records the caveat plainly: for credential endpoints fail-closed may be the better trade, because "the store is down" is preferable to "the attacker is in" — that needs a real per-endpoint policy and a monitoring signal, and the `console.error` is the only signal either way. **Alert on it.**

### 8.1 The Vercel WAF / rate-limit-rule alternative — no application dependency

Because the store cannot work across instances, the cheapest correct answer is to move the enforcement **out of the application and into the edge**, which costs zero new dependencies and is per-deployment rather than per-instance:

- **Vercel Firewall / WAF rate-limit rules** on the deployment (Vercel → Project → Settings → Firewall, or `vercel.json` `firewall` config). A rule scoped to `POST /api/v1/auth/login` with a per-IP limit and a challenge/ban action is enforced at the edge, **before** the function is invoked, and is shared across every instance because it lives in front of all of them.
- Cover `POST /api/v1/auth/verify-registration`, `POST /api/v1/auth/send-otp`, `GET /api/v1/auth/reset-link/*` and `POST /api/v1/contact/messages` the same way — these are the endpoints with a per-account or per-target cost (OTP mail, Resend quota, inbox flooding).
- Set a `vercel.json` firewall rule for the `X-Forwarded-For` / `x-real-ip` client dimension. See the deployment constraint below before choosing the key.
- Vercel's WAF also caps request body size and rate, which is a second line of defence for the 4.5 MB edge limit and for the upload endpoints.

**The trade, stated honestly:** an edge rule is coarser than the application limiter — it cannot express a per-target-email limit, it counts the request before the application decides what it means, and a challenge/ban is a blunt instrument on a route where a university NAT legitimately produces bursts. It is still strictly better than an in-process `Map` that enforces intermittently, and it is the right first move.

### 8.2 What remains unenforced until one of these is done

| Control | Route | Status |
| :--- | :--- | :--- |
| `loginRateLimiter` (10 / 15 min) | `POST /api/v1/auth/login` | **Effectively unenforced.** The only brute-force control on the route. |
| `contactRateLimiter` (3 / min) | `POST /api/v1/contact/messages` | **Effectively unenforced.** Contact-form spam. |
| `authEmailRateLimiter` (5 / 15 min) | `send-otp`, `reset-link/:email` | **Effectively unenforced.** Outbound mail abuse and Resend quota burn. |
| `passwordResetRateLimiter`, `otpVerificationRateLimiter` | `reset-password`, `verify-registration` | **Effectively unenforced.** |
| `memberListRateLimiter` (60/min) | `GET /users/member` | **Effectively unenforced.** The two new limiters below are in the same position. |
| `uploadRateLimiter` (20/h/IP) | `POST /admin/uploads/image` | **Effectively unenforced.** |
| `userUploadRateLimiter` (20/h/user) | `create-post`, `update-post/:id`, `user/upload-image/:key` | **Effectively unenforced.** |
| `registrationRateLimiter` (100/h), `registrationEmailRateLimiter` (5/h/email) | `POST /auth/register` | **Effectively unenforced.** The per-email one is the control that stops an attacker hammering one victim's inbox. |

**A hard deployment constraint, from `request.js:13-59`.** Every IP-derived control above is only sound **behind the Vercel edge**. `getClientIp` reads `x-real-ip`, then `x-vercel-forwarded-for`, then the **rightmost** `x-forwarded-for` — never a socket address, because App Router has no socket. That is correct on Vercel, where the edge **overwrites** those headers. It is correct on **no other host**: behind a bare Node process, a container, a VM, a reverse proxy, a local `next dev` or a self-hosted preview, all three are ordinary client-supplied fields. One request with `x-real-ip: 203.0.113.7` and the next with `.8` defeats every IP-keyed limiter simultaneously. **If this API is ever run anywhere but Vercel, `getClientIp` must be rewritten first.** The file deliberately does not make this "safe by default", because a conditional trust boundary that is off in development and on in production is a worse thing to reason about than a documented hard constraint.

Note also that the header trust and the shared store are **independent** problems: fixing the headers does not fix the per-instance store, and fixing the store does not fix the headers. Both are required; neither is sufficient alone.

---

## 9. Frontend work still outstanding

**This migration deliberately did not touch the client.** Every item below is a client change and none of it has been done. The client still calls the Express server.

### 9.1 Repoint `NEXT_PUBLIC_API_BASE_URL` — five sites, one commit

Five files read it:

| File | Line | Current default |
| :--- | :--- | :--- |
| `src/services/baseApi.js` | 4 | `http://localhost:5000/api/v1` |
| `src/lib/certificate-metadata.js` | 1 | `http://localhost:5000/api/v1` |
| `src/components/BOOTCAMPLEADERBOARD/BootcampLeaderboard.jsx` | 17 | `http://localhost:5000/api/v1` |
| `src/features/certificate/certificateApi.js` | 6 | `http://localhost:5000` (then `.replace('/api/v1', '')`) |
| `src/components/HOME/VisitorCounter.jsx` | 9 | `""` — and it builds `/api/visitor` when empty, appending `/v1` only when the base URL is external |

> **`NEXT_PUBLIC_*` is inlined at build time.** All five must change in one commit. Change four and leave one, and the stale `http://localhost:5000` origin is **baked into the bundle** — it will not be a runtime error you can see in dev; it will be a production build pointing at a server you may have shut down.

The target should be a **relative** path (`/api/v1`), which is what makes the same-origin cookie and CSRF design in `request.js` work. `baseApi.js` already sends `credentials: 'include'`, which becomes sufficient rather than necessary.

### 9.2 Delete the standalone `publicApi` instance — **this one fails silently**

`src/features/certificate/certificateApi.js:3-13` creates a second RTK Query instance:

```js
const publicApi = createApi({
  reducerPath: 'publicApi',
  baseQuery: fetchBaseQuery({
    baseUrl: (process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000').replace('/api/v1', ''),
  }),
  endpoints: (build) => ({
    verifyCertificatePublic: build.query({ query: (certificateId) => `/verify/${certificateId}` }),
  }),
});
```

`publicApi` exists **only** because the backend exposed verification at the **root** `/verify/:id`, outside the `/api/v1` base URL. That is the entire reason a second `createApi` instance was needed. The canonical path is now **`/api/v1/certificates/verify/:certificateId`**, running the same controller, so the second instance should be **deleted** and `verifyById` folded into the main `certificateApi` (whose `verifyCertificate` already hits `/certificates/verify?certificateId=…`).

> **This fails SILENTLY and it will survive review.** `publicApi` hitting `/verify/<id>` no longer 404s — `src/app/verify/[certificateId]/page.jsx` is a real client-side route, so the request returns **HTML with HTTP 200**, and the client will render the verification **page** as if it were JSON. The root route cannot be migrated (a `page.jsx` and a `route.js` cannot share a segment — the build fails), so repointing the client is the only fix. This is called out at `certificates/verify/[certificateId]/route.js:31-35` precisely because it is not a build-time failure.

### 9.3 `userApi.js:64-70` calls a route that has never existed

```js
deleteUser: builder.mutation({
  query: (id) => ({ url: `/users/${id}`, method: "DELETE" }),
  …
}),
```

`DELETE /users/:id` does not exist in the **Express** backend and does not exist in the new one. The account self-service endpoint is `DELETE /users/user` (no id — it takes the id from `req.user`, which is why it is safe). This client definition is **already broken**; `CLAUDE.md:164` and `ARCHITECTURE.md:506` both already record it as dead. **Do not "fix" it silently** — either repoint it to `/users/user` (dropping the id argument) or delete it, and record which.

### 9.4 The member page loses four fields — including a new visibility change

`PUBLIC_MEMBER_ITEM` (§5.12) removes fields the member page currently renders:

| Field | Visible effect |
| :--- | :--- |
| `email` | `AboutCard.jsx:30-34` renders `href={mailto:${Data?.email}}` and `<span>{Data?.email}</span>` unconditionally → **`mailto:undefined`** and a visible empty row on every card. Needs a conditional. |
| `phone` | An empty span. |
| `uniID` | `AboutCard.jsx:40` builds `/profile/${Data?.uniID || Data?._id}` → falls back to `_id`. Profile links degrade but keep working, because the `uniID` lookup branch still resolves on the server. |
| `roles` | `Member.jsx:49-72` sorts by `roleOrder` → every member now sorts as `"member"` (order 4) and ties break alphabetically. **The member listing order changes.** |
| `isValid` | **See below.** |

**`isValid` is the one that needs a decision, not just a UI fix.** `Member.jsx:59` filters client-side on `user?.isValid !== false`. With the field absent from the projection, that predicate is **true for every document** — so **unverified and pending accounts now appear in the public member listing.** This is a real behaviour change, documented as such at `constants.js:237-242`.

The fix belongs **server-side**: filter on `isValid: true` in `memberHandler` (`User.find({}, PUBLIC_MEMBER_ITEM)` → `User.find({ isValid: true }, PUBLIC_MEMBER_ITEM)`). A client-side filter cannot distinguish "absent because the account is unverified" from "absent because we stopped projecting it", so it is not a viable fix.

### 9.5 Drop `token` and `accessToken` from the two auth responses

- `POST /auth/login` returns `{ user, token: accessToken }` (`auth.controller.js:458`).
- `GET /auth/refresh-token` returns `{ accessToken }` (`auth.controller.js:544`).

Both duplicate the `httpOnly` cookies the same responses already set (`COOKIE_OPTIONS`, `httpOnly: true, sameSite: 'lax', path: '/', maxAge: 7d`). `baseApi.js:16-18` then reads `auth.token` from `localStorage` and attaches it as `Authorization: Bearer …`. The refresh cookie is **never** read by JavaScript, so the value in the body buys nothing that the cookie does not already do — and it is a session credential sitting in `localStorage`, which is exactly the XSS trade-off `SECURITY.md:37` documents. Removing it requires updating the login mutation and the Redux auth slice together. **This is a real change to the client's session model; it is not a one-line edit.**

### 9.6 `getClientIp` trusts Vercel edge headers — a hard deployment constraint

Covered in full at §8.2. Restated here because it is a **frontend-adjacent deploy decision**: this API may only run behind Vercel (or behind a proxy that overwrites all three headers and is itself the only ingress). Hosting it anywhere else makes every IP-keyed control forgeable with a single header. If that constraint is unacceptable, the alternative is a platform-level rate limit (§8.1) plus a socket-derived client address, which requires runtime changes.

---

## 10. Pre-deploy checklist

Work top to bottom. Items 1–3 are the ones that fail *silently*.

### 10.1 The secrets, and why a green build proves nothing

`env.js` validates lazily. **A deployment with no secrets set builds green and fails at runtime** — authenticated routes return **500, not 401**, because `validateEnv()` throws an ordinary `Error` from inside `signingSecrets()` and the wrapper's catch shapes it as a 500. The 500 message names the variables (which is the point), but the failure mode is "every login 500s" rather than "the deploy is misconfigured".

- [ ] `MONGODB_URI`, `ACCESS_TOKEN_SECRET`, `REFRESH_TOKEN_SECRET`, `PASSWORD_TOKEN_EXPIRE`-adjacent secrets — i.e. the four in §4.9 — are set in the platform's environment store.
- [ ] The remaining variables in §4 are set for the features you are enabling: Cloudinary (uploads), `RESEND_API_KEY` + `WEB_DOMAIN` (OTP/reset mail **and** the CSRF allow-list), `NEXT_PUBLIC_SITE_URL` (+ `EXTRA_ALLOWED_ORIGINS` for preview/staging), `GOOGLE_SHEETS_API_KEY` + `BOOTCAMP_SHEET_ID` (leaderboard), `CONTRIBUTOR_GITHUB_TOKEN` (contributor sync).
- [ ] All three secrets are **different** from each other.
- [ ] `WEB_DOMAIN` is the **bare origin with scheme and no trailing slash**, and matches the deployment host. A wrong value here 403s every unsafe method from the real site *and* sends password-reset links to the wrong host.
- [ ] Smoke-test one of each class before declaring the deploy good: one public GET, one authenticated GET with a real session, one `POST` (to prove CSRF is not 403-ing your own client), and one multipart upload.
- [ ] After §9.1 lands, confirm no bundle still contains the string `localhost:5000`.

### 10.2 `CONTRIBUTOR_GITHUB_TOKEN` scope

- [ ] It is a **fine-grained** personal access token, not a classic PAT.
- [ ] Scoped to **one repository** (`cpccu-client`) and **one path** (`data/contributors.json`).
- [ ] Permissions: **Contents → Read and write**, and nothing else. No account scope, no other repos, no packages, no org.
- [ ] Confirm the exact path is what `adminContent.controller.js` writes. Note the file also honours a **caller-supplied `uploadPreset`** over `CLOUDINARY_UPLOAD_PRESET` (recorded finding M4) — unrelated to this token but in the same controller.

### 10.3 Repository state you will inherit

- [ ] **`render.yaml` / `_render.yaml` show as deleted in `git status`, and that deletion is unexplained and pre-existing.** It is not part of the migration (the migration did not delete them) and the reason is not recorded anywhere in the repo. `CLAUDE.md:168` and `ARCHITECTURE.md:511` both say these are leftovers from an earlier Render-based frontend deployment and are harmless. **Resolve it deliberately** — restore them if the deletion was accidental, or commit the deletion with a message saying why. Do not let an unexplained deletion ride into a deploy commit.
- [ ] **`src/lib/server/` and `src/app/api/` are entirely untracked.** `next build` works from the working tree, so nothing in CI has ever seen these files. If you want an auditable trail — and for a change this size you should — **commit per phase** (foundation → shim → controllers → routes) rather than as one 65-endpoint commit. At minimum, commit them before deploying.
- [ ] Confirm `cpccu-server` is still at `ea9810a` with a clean `git status` in *that* repository. It is the reference you will diff against when the first bug report arrives.

### 10.4 Cutover

- [ ] §9.1 (five `NEXT_PUBLIC_API_BASE_URL` sites, **one commit**) — done before the first request hits the new API.
- [ ] §9.2 (`publicApi` deleted or repointed) — **non-optional; it fails silently.**
- [ ] Decide §9.4's `isValid` question: server-side filter, or accept pending accounts in the public listing.
- [ ] Decide §9.3: repoint or delete `deleteUser`.
- [ ] Leave the Express server running until the new API has been exercised in production. Both can serve simultaneously — the mounts do not collide.
- [ ] Watch `serverExternalPackages: ["mongoose"]` and remember `firebase-admin` must be re-added if Google sign-in ever returns.

---

## 11. Known tooling gaps

**None of the migrated code has been linted, and there is no test runner in the repository.** Every verification performed during the migration used throwaway scripts under `/tmp`, which means nothing about this code is enforced by a durable check.

### 11.1 `npm run lint` is unrunnable — for two independent reasons

- **`next lint` was removed in Next 16** (this repo is on `next@^16.3.6`). The script is `"lint": "next lint"`, and Next 16 parses `lint` as a **directory** argument, so the command fails before ESLint is ever invoked.
- **ESLint 10 requires flat config**, and the repo has only `.eslintrc.cjs`. Even with the script fixed, the config format is wrong for the installed major version.

Both must be fixed — the first is a script change, the second a config migration to `eslint.config.js`. Until then: **the migrated code has never been linted.** (The pre-existing frontend code is in the same position, so this is a repo-wide gap, not one the migration created — but the migration added ~5,000 lines to a codebase that cannot lint any of it.)

### 11.2 Prettier is not configured and not installed

`prettier --check` fails **104 of 104** migrated files. It also fails the **pre-existing** frontend code at the same rate, because **prettier is not a dependency and the repo has no config** — so the output is a generic-formatting diff across the whole repository, not a signal about the migration's quality. Do not "fix" formatting on 104 files as part of this work without deciding first whether the repo wants prettier at all; the honest reading is that there is no formatting standard in this repository.

### 11.3 No test runner — and one function with zero durable assertions

There is **no test runner in the repo** (no `test` script, no vitest/jest dependency). `SECURITY.md:45` and `TROUBLESHOOTING.md` both already record this for the frontend.

The consequence that matters: **`adminAuth.js`'s role matrix is enforced by a function with zero durable assertions.** It was re-derived four independent times during the migration and matched every time, and the result is written into `admin/roles/route.js:77-100` as a table — but a table in a comment is not an assertion. Any future edit to `adminRoles`, `moderatorResources`, `mentorReadPaths`, `describeAdminRoute`, or to which files carry `admin: true` silently changes authorisation, and **a matrix error in either direction is silent**: a wrong denial looks like "the moderator cannot save posts" and a wrong grant looks like nothing at all.

**Recommendation: `node --test`.** It is built into Node, so it adds **zero dependencies** — which matters in a repo whose lint tooling is already broken and whose test story is "throwaway scripts in `/tmp`". Write assertions for exactly three things, in priority order:

1. **The role matrix.** Drive `authorizeAdminPath({ role, method, pathname })` — **not** `authorizeAdminAction`, which takes caller-supplied `resource` and `isUpload`. `adminAuth.js:183-219` exists specifically for this: a test that builds the routing context itself can assert the wrong thing and pass, pinning the bug instead of the behaviour. Enumerate every row of the table in §3, including that `HEAD` is **denied** everywhere `GET` is allowed, that `/uploads/image` matches exactly and not `/uploads/image-2`, and that `/statistics` **does** match `/statistics/2024`.
2. **The four error branches of `toErrorResponse`.** `LIMIT_FILE_SIZE` → 400 with `uploadSizeMessage()`; `code === 11000` → 409 with a friendly per-field message (`email` and `uniID` have bespoke text); `ApiError` → its own `statusCode`/`message`/`error`; anything else → 500, redacted in production, raw otherwise, **with no `errors` key on the last branch only**. Plus the `RESPONSE_PAIR` brand: a serialised `Event` (which has a `status` field of `'upcoming'`) must **not** be mistaken for an error pair.
3. **`getClientIp`.** `x-real-ip`; `x-vercel-forwarded-for`; the **rightmost** `x-forwarded-for` (`.pop()` — changing this to `[0]` silently disables every IP-keyed limiter); `x-real-ip: " "` and `x-real-ip: "banana"` must fall through, not become a shared bucket; no header at all → `'unknown'`.

Worth adding, in the same file or a second one: `assertSameOrigin` (the §5.2 table is nine rows and each is a real bypass if it regresses), and `parsePublicIdFromCloudinaryUrl` (six attack shapes are listed at `cloudinary.js:165-170` and are ready to be turned into assertions).

---

## Related documents

- [Architecture Overview](./ARCHITECTURE.md) — the frontend half; the API half it links to is now **in this repository**.
- [API Documentation](./API_DOCUMENTATION.md) — what the frontend *consumes*. Several entries are now stale — see §9.
- [Security](./SECURITY.md) — the frontend's security posture. Its "the backend is a separate service" framing predates this migration.
- [Deployment](./DEPLOYMENT.md) — Vercel + Render. The Render half is obsolete for the API.
- [Troubleshooting](./TROUBLESHOOTING.md) — includes the `build`/`lint` failure section referenced by `SECURITY.md`.
- [ADR](./ADR.md) — ADR-001 (Vercel + Render) and ADR-011/015 (auth architecture, backend-enforced verification) are directly affected by this migration.
