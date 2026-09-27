import 'server-only';

import { isIP } from 'node:net';

import { ApiError } from '@/lib/server/errors';
import {
  MAX_JSON_BODY_BYTES,
  MAX_UPLOAD_BYTES,
  jsonBodySizeMessage,
  uploadSizeMessage,
} from '@/lib/server/constants';

/**
 * ============================================================================
 * HARD DEPLOYMENT CONSTRAINT — READ BEFORE DEPLOYING ANYWHERE BUT VERCEL
 * ============================================================================
 * EVERY IP-DERIVED CONTROL IN THIS API IS ONLY SOUND BEHIND THE VERCEL EDGE.
 *
 * `getClientIp` (below) reads the client address from request HEADERS —
 * `x-real-ip`, then `x-vercel-forwarded-for`, then the rightmost `x-forwarded-for`
 * — and never from a socket address, because App Router has no socket to read.
 * That is correct and necessary ON VERCEL, and it is the standard way to do this
 * on a platform that terminates the connection. It is ALSO correct on NO OTHER
 * HOST.
 *
 * WHY. Those headers are only trustworthy because the edge OVERWRITES them.
 * Vercel documents `x-real-ip` and `x-vercel-forwarded-for` as carrying the same
 * address the edge observed, and its edge overwrites `x-forwarded-for` on every
 * request without forwarding the value the client presented. Behind any host
 * that does not do that — a bare Node process, a container, a VM, a reverse
 * proxy, a local `next dev`, a self-hosted preview — all three headers are
 * ORDINARY CLIENT-SUPPLIED FIELDS. One request with
 * `x-real-ip: 203.0.113.7`, and the next with `x-real-ip: 203.0.113.8`, defeats
 * every IP-keyed limiter in this codebase simultaneously.
 *
 * THE BLAST RADIUS, precisely: `loginRateLimiter` (10 / 15 min),
 * `registrationRateLimiter` (100 / hour), `authEmailRateLimiter`,
 * `passwordResetRateLimiter`, `contactRateLimiter` (3 / min),
 * `memberListRateLimiter`, `uploadRateLimiter`, and
 * `otpVerificationRateLimiter`. All of them take `(ctx) => ctx.ip` as their
 * default key, so a forged header does not merely weaken one limit — it removes
 * the per-caller dimension from all of them at once, and the credential-guessing
 * controls are the ones that matter. (`userUploadRateLimiter` keys on the
 * authenticated user id instead, which is why it is unaffected.)
 *
 * WHAT THIS DOES *NOT* FIX. Rate limiting in this codebase is additionally not
 * real across instances regardless of platform, because the default store is an
 * in-process `Map` — see the module docblock in `rateLimit.js`. Fixing the
 * header trust does not fix that, and fixing that does not fix this. Both are
 * required, and neither is sufficient alone.
 *
 * THE REQUIREMENT, then: deploy this API behind Vercel (or behind a proxy that
 * overwrites all three headers and is itself the only ingress). If it is ever
 * run somewhere else, `getClientIp` must be rewritten FIRST — for a Vercel
 * deployment, keep the current code unchanged. This file's behaviour is
 * deliberately not made "safe by default" here, because a conditional trust
 * boundary that is off in development and on in production is a worse thing to
 * reason about than a documented hard constraint.
 * ============================================================================
 */

/**
 * Body cache keyed by the `Request` object itself.
 *
 * A `Request` body is a one-shot stream: calling `request.json()` twice throws
 * `TypeError: Body has already been read`. App Router has no `express.json()`
 * equivalent, so anything that needs the body (validation, the rate limiter that
 * keys on `body.email`, the controller) would race for the single read. A
 * `WeakMap` keyed on the Request memoises the read and lets every consumer see
 * the same value, with the key collected as soon as the request is — weak
 * references mean no leak between invocations.
 *
 * THE CACHES THE PROMISE, NOT THE RESOLVED VALUE. Storing the resolved value
 * only helps SEQUENTIAL reads: `readBody` awaits `request.text()`, and the
 * `WeakMap` entry is written after that await resolves. Two OVERLAPPING calls
 * (`Promise.all([readBody(r), readBody(r)])`, or a limiter and a validator racing
 * on the same tick) both observe `!bodyCache.has(request)` and both reach
 * `request.text()`; the first wins and the second throws
 * `TypeError: Body has already been read`. Storing the in-flight promise makes
 * every caller await the same single read instead of racing for it.
 */
const bodyCache = new WeakMap();

/**
 * HTTP methods that cannot change state and are therefore exempt from the CSRF
 * origin check. `OPTIONS` is included because the CORS preflight it answers is
 * itself the browser asking whether the cross-site request would be allowed.
 */
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Localhost origins permitted to make unsafe requests during development. Port
 * `3000` is `next dev`; `3001`/`3002` are the extra ports the Express original's
 * CORS allowlist named (`app.js:17-19`) and are kept so a second local dev server
 * does not trip the check.
 */
const DEV_ORIGINS = new Set([
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://127.0.0.1:3000',
]);

/**
 * Derives the client IP, reproducing what `app.set('trust proxy', 1)` did to
 * Express's `req.ip` in the original backend: with exactly one trusted proxy
 * hop, Express takes the RIGHTMOST entry of `X-Forwarded-For` (the address
 * appended by the last proxy it trusts), not the leftmost and not the socket
 * address.
 *
 * GETTING THIS WRONG IS A SECURITY-RELEVANT BUG, not a cosmetic one: every
 * IP-keyed rate limiter in this codebase keys on this value, so this function is
 * the sole definition of "a client" for limiting purposes. Trusting the leftmost
 * entry lets a client spoof `X-Forwarded-For: 1.2.3.4` and get a fresh bucket
 * per request, defeating login/contact/registration limiting entirely.
 * Trusting the socket address (or returning `undefined`) collapses every user
 * into ONE shared bucket, which denies service to everyone once any single
 * client trips the limit.
 *
 * Preference order (each candidate must survive `net.isIP` validation, otherwise
 * the next source is tried):
 *  1. `x-real-ip` — set by Vercel's own edge, not client-controllable.
 *  2. `x-vercel-forwarded-for` — the Vercel-specific equivalent.
 *  3. rightmost `x-forwarded-for` entry — matches the Express behaviour.
 *  4. a fixed fallback string.
 *
 * PLATFORM NOTE (Vercel): the edge OVERWRITES `X-Forwarded-For` on every request
 * and does NOT forward the external IP the client presented, which is precisely
 * what makes header-derived IPs trustworthy here. Vercel documents
 * `x-real-ip` and `x-vercel-forwarded-for` as carrying the same value as
 * `x-forwarded-for`.
 *
 * THE `.pop()` IS CORRECT AND MUST NOT BE "FIXED" TO `[0]`. The edge APPENDS the
 * address it observed to whatever chain it received, so the address IT saw — the
 * one hop we actually trust — is the RIGHTMOST entry. `[0]` is the value the
 * original client claimed and is attacker-controlled. Changing this to `[0]`
 * silently disables every IP-keyed rate limiter in the app.
 *
 * EVERY branch runs the same validation and the same normalisation, because a
 * rate-limit key that is not a valid IP is a shared bucket waiting to happen:
 * `x-real-ip: " "` is a truthy string that trims to `''`, and `x-real-ip:
 * "banana"` is simply a garbage header. Both would otherwise become the literal
 * key `''` / `"banana"`, which every such caller then shares.
 *
 * @param request the incoming `Request`
 * @returns a validated IP string, or `'unknown'` when no source yields one
 */
function getClientIp(request) {
  const headers = request?.headers;

  if (!headers) return 'unknown';

  const candidates = [
    // Vercel sets `x-real-ip` to a SINGLE address, but normalising it through
    // the same rightmost-split keeps the three sources symmetric — the previous
    // code returned this header raw and the other two trimmed, so the same
    // client could get two different keys depending on which header arrived.
    { header: 'x-real-ip', multiEntry: false },
    { header: 'x-vercel-forwarded-for', multiEntry: true },
    { header: 'x-forwarded-for', multiEntry: true },
  ];

  for (const { header, multiEntry } of candidates) {
    const raw = headers.get(header);
    if (!raw) continue;

    // Take the rightmost entry of a comma-separated chain: the one hop the edge
    // appended itself. A single-value header is already that entry.
    const value = (multiEntry ? raw.split(',').pop() : raw)?.trim();

    if (!value) continue;
    if (!isIpAddress(value)) continue;

    return value;
  }

  return 'unknown';
}

/**
 * `net.isIP` validation, reduced to a predicate.
 *
 * `isIP` returns `0` (falsy) for anything that is not a valid v4 or v6 address,
 * which is exactly the "reject this candidate and fall through to the next
 * source" signal `getClientIp` needs. Wrapping it keeps the Node import at module
 * scope (this module is server-only and always executes in the Node runtime) and
 * avoids re-reading a property off the namespace on every request.
 */
function isIpAddress(value) {
  return isIP(value) !== 0;
}

function getUserAgent(request) {
  return request?.headers?.get('user-agent') || '';
}

/**
 * Minimal cookie-header parser — the App Router has no `cookie-parser`.
 * Only the first `=` of a pair is significant, so a base64 value containing
 * `=` is preserved intact.
 *
 * The accumulator is `Object.create(null)` rather than `{}`. A literal `{}` has
 * an inherited `__proto__` setter, so a cookie literally named `__proto__`
 * would hit the setter rather than create a key. It is not currently
 * exploitable (the setter ignores non-object values and the value here is always
 * a string, so the assignment is dropped) and `cookies.accessToken` is still
 * `undefined` either way — but a null-prototype object removes the entire class
 * of bug permanently instead of relying on a downstream coercion to stay safe.
 */
function parseCookies(request) {
  const cookieHeader = request?.headers?.get('cookie');
  if (!cookieHeader) return Object.create(null);

  return cookieHeader.split(';').reduce((cookies, pair) => {
    const separatorIndex = pair.indexOf('=');
    if (separatorIndex < 0) return cookies;

    const key = pair.slice(0, separatorIndex).trim();
    if (!key) return cookies;

    const value = pair.slice(separatorIndex + 1).trim();
    try {
      cookies[key] = decodeURIComponent(value);
    } catch {
      // A cookie that is not valid percent-encoding is used verbatim rather than
      // dropped — losing it would silently turn an authenticated request into a
      // 401 with no other signal.
      cookies[key] = value;
    }
    return cookies;
  }, Object.create(null));
}

/**
 * Reads and parses the request body ONCE, caching the read on the Request.
 *
 * Supports `application/json` and `application/x-www-form-urlencoded` to match
 * the two `express` body parsers the backend mounted (`app.js:32-33`). Anything
 * else (notably `multipart/form-data`) returns `null` so a file upload route can
 * read the raw `FormData` stream itself instead of having it consumed here.
 *
 * @param request the incoming `Request`
 * @returns a promise for the parsed body, or `null` for an unsupported type
 */
function readBody(request) {
  if (!request) return Promise.resolve(null);
  if (bodyCache.has(request)) return bodyCache.get(request);

  const contentType = request.headers?.get('content-type') || '';

  const read = (async () => {
    if (contentType.includes('application/json')) {
      const text = await request.text();
      return text ? JSON.parse(text) : {};
    }

    if (contentType.includes('application/x-www-form-urlencoded')) {
      const text = await request.text();
      return Object.fromEntries(new URLSearchParams(text));
    }

    return null;
  })();

  // Stored BEFORE the first suspension point of the caller, and as a PROMISE, so
  // a concurrent second call joins this read instead of starting its own.
  bodyCache.set(request, read);

  // The rejection must not become an unhandled rejection purely because a cache
  // lookup later returns the already-rejected promise. The caller that
  // originally invoked `readBody` still sees the error; this handler only stops
  // Node from reporting it a second time.
  read.catch(() => {});

  return read;
}

/**
 * Reads a `multipart/form-data` body, rejecting an oversized payload BEFORE it
 * is ever buffered.
 *
 * WHY THE UPSTREAM GATE MATTERS SO MUCH. `request.formData()` parses the whole
 * body into memory. Before the uploader was converted to a stream (see
 * `uploadOnCloudinary`), measured peak memory for a single 4 MiB upload was
 * roughly 35–40 MB: the `formData()` buffer, the `File.arrayBuffer()` copy, the
 * `Buffer.from` copy, a 5.59 MB base64 string that V8 counts at ~11 MB because
 * base64 is ASCII-in-UTF-16, the template-literal concat, and finally the
 * Cloudinary SDK's own multipart body and base64 decode. Streaming removed the
 * last three of those, but the `formData()` buffer itself is unavoidable here.
 * Vercel's 4.5 MB cap limits PER-REQUEST size, not CONCURRENCY — roughly 50
 * concurrent 4.5 MB uploads exhausts the 2 GB instance and the OOM killer takes
 * out every co-resident function. Checking `Content-Length` FIRST means an
 * oversized body is rejected with a cheap header read and is never materialised
 * at all, which no amount of downstream streaming can achieve.
 *
 * The per-file check afterwards is a SECOND, independent guard: `Content-Length`
 * is a client-supplied header, so a client may lie about it or omit it (chunked
 * transfer encoding sends no `Content-Length` at all).
 *
 * `MAX_UPLOAD_BYTES` is the app's 4 MiB cap; the platform's own 4.5 MB ceiling
 * is lower still, so this check normally never fires on Vercel and exists so the
 * documented 400 is produced by our code on every platform.
 *
 * @param request the incoming `Request`
 * @returns a promise for the parsed `FormData`
 * @throws {ApiError} 400 when the declared or actual body size is too large
 */
async function readMultipart(request) {
  // Content-type-scoped, so this applies the MULTIPART cap. Calling it here as
  // well as in `apiRoute` is deliberate redundancy, not an oversight: a route
  // that reaches `readMultipart` without going through the wrapper still gets the
  // pre-buffer rejection, and one that goes through the wrapper has already had
  // it applied and pays only a header read.
  assertBodySizeWithinLimit(request);

  const form = await request.formData();

  for (const value of form.values()) {
    if (typeof value === 'object' && typeof value.size === 'number') {
      if (value.size > MAX_UPLOAD_BYTES) {
        throw new ApiError(400, uploadSizeMessage());
      }
    }
  }

  return form;
}

/**
 * Rejects a request whose `Content-Length` already exceeds the applicable cap
 * BEFORE any body is read.
 *
 * Split out of `readMultipart` so the `apiRoute` wrapper can call it on the way
 * in — before rate limiting, before authentication, before the handler — and
 * therefore before a single byte of an oversized body is buffered. That ordering
 * is the whole point: a 4.5 MB rejection costs one header lookup instead of
 * ~40 MB of heap. THE CHECK MUST STAY BEFORE `formData()`: once `formData()`
 * runs the body is already resident in memory, so a "check" after it is a check
 * on memory that has already been spent.
 *
 * THE CAP IS CHOSEN BY CONTENT TYPE, NOT BY ROUTE. `multipart/form-data` is
 * governed by `MAX_UPLOAD_BYTES` (the multer `fileSize` port) and everything
 * else by `MAX_JSON_BODY_BYTES`. Applying the upload cap to all routes — which
 * this function did — meant a 5 MB `application/json` POST was answered with
 * "File size too large. Profile picture must be at most 4MB.", i.e. an UPLOAD
 * error message on a request that carried no file, from a payload an API client
 * is entirely entitled to send. The content type is the only thing that decides
 * which limit is meaningful, so it is what this function reads.
 *
 * DECLARED DIVERGENCE (see the block at the top of `http.js`): the Express
 * original answered an oversized JSON body with a **500** carrying body-parser's
 * raw `'request entity too large'`, because `PayloadTooLargeError` matched none
 * of the four branches of `app.js:78-117` and fell through to the catch-all. A
 * **400** with a message naming the actual limit is a deliberate change on both
 * axes: a client-caused rejection should not report a server fault, and the
 * original text told the caller nothing about the ceiling it exceeded.
 *
 * Returns silently (rather than throwing) when the header is absent: a chunked
 * request carries no `Content-Length`, and refusing to read bodies without one
 * would break legitimate clients. The per-file guard in `readMultipart` covers
 * that case.
 */
function assertBodySizeWithinLimit(request) {
  const contentLength = Number(request?.headers?.get('content-length'));

  // NaN means the header was absent or unparseable; `Number(undefined)` is NaN.
  if (!Number.isFinite(contentLength) || contentLength <= 0) return;

  const contentType = (
    request?.headers?.get('content-type') || ''
  ).toLowerCase();
  const isMultipart = contentType.includes('multipart/form-data');

  // A MISSING content type is treated as non-multipart, i.e. it takes the JSON
  // cap. That is the safe direction in both senses: the JSON cap is the general
  // body bound, and a request that does not declare a content type is not one
  // this app is going to hand to `formData()`.
  if (isMultipart) {
    if (contentLength > MAX_UPLOAD_BYTES) {
      throw new ApiError(400, uploadSizeMessage());
    }
    return;
  }

  if (contentLength > MAX_JSON_BODY_BYTES) {
    throw new ApiError(400, jsonBodySizeMessage());
  }
}

/**
 * CSRF protection for unsafe methods.
 *
 * WHY THIS IS NEEDED. The Express original was structurally CSRF-vulnerable:
 * `COOKIE_OPTIONS.sameSite` was `'none'`, `verifyToken` read the `accessToken`
 * cookie BEFORE the `Authorization` header, and `express.urlencoded()` was
 * mounted — so a bare cross-site `<form method="POST">` (no JavaScript, no
 * custom headers, therefore no CORS preflight) arrived fully authenticated. The
 * frontend is same-origin with the API in this migration and the cookie is now
 * `SameSite=Lax`, which closes the cross-site cookie path; this function is the
 * second, independent layer.
 *
 * `Sec-Fetch-Site` is the PRIMARY signal because it is set by the BROWSER as part
 * of the fetch standard and cannot be set by `fetch`, XHR, or any other scripted
 * API — a page cannot forge it, and it is not settable from JavaScript at all. It
 * is the modern replacement for the Origin check and covers the cases Origin
 * cannot: it survives a missing `Origin` on same-origin POSTs.
 *
 * `'none'` is allowed because it means the user NAVIGATED directly to the URL
 * (typed it, bookmarked it, clicked a link) with no referring site — the
 * `/reset-password/[code]/[token]` email link arrives exactly this way and must
 * keep working.
 *
 * `'same-site'` IS NOT ALLOWED ON ITS OWN — IT IS ALLOWED ONLY WITH AN
 * ALLOW-LISTED `Origin`. `Sec-Fetch-Site: same-site` means "the initiating
 * document shares a REGISTRABLE DOMAIN with the request", which is a much weaker
 * statement than "same-origin": `evil.cpccu.club`, `cpccu.club.attacker.net`'s
 * cookie scope, any compromised or abandoned subdomain (`staging.cpccu.club`,
 * `old.cpccu.club`) and every user-content host all satisfy it. A sibling
 * subdomain serving attacker-controlled markup is exactly the cross-site request
 * this function exists to stop, and it is a far more realistic threat than a
 * bare cross-origin form POST — which `SameSite=Lax` already blocks on its own.
 * Rejecting `same-site` outright was ALSO wrong in the other direction: the
 * Express CORS allow-list named `cpccu.club` and `www.cpccu.club` (and the
 * `.pro.bd` pair) as DISTINCT permitted origins, so a www→apex redirect or a
 * separate staging host is same-site by definition and was being 403'd on every
 * unsafe method with no way to allow it short of editing this function. The
 * conjunction — `same-site` AND an allow-listed `Origin` — is what accepts the
 * legitimate deployment shapes while still refusing the sibling-subdomain
 * attacker. See `allowedOrigins` for how the list is built.
 *
 * THE MISSING-HEADER FALLBACK IS WEAKER AND EXISTS ONLY FOR OLDER BROWSERS. A
 * client that omits `Sec-Fetch-Site` entirely (pre-Chrome-76 / pre-Firefox-90,
 * and every non-browser client) falls back to comparing `Origin` against the
 * allow-list. A non-browser client can set `Origin` freely, so this is not a
 * complete defence on its own — it is defence in depth behind `SameSite=Lax`, not
 * a replacement for it. The allow-list is intentionally an allow-list: an
 * unrecognised origin is rejected rather than a matching one being trusted.
 *
 * NON-BROWSER CLIENTS — DECIDED, WITH AN EXPLICIT ESCAPE HATCH. A request that
 * carries NEITHER `Sec-Fetch-Site` NOR `Origin` is not a browser: browsers set
 * `Origin` on every state-changing request and `Sec-Fetch-Site` on every fetch,
 * so their absence is a positive signal. Rejecting those requests outright (which
 * this function did) meant `curl`, a mobile or CLI client, and any integration
 * test was 403'd on every unsafe method with no supported way to proceed. Such a
 * request is allowed ONLY when it also presents an `Authorization: Bearer`
 * header. That is not a convenience shortcut, it is the one credential a browser
 * CANNOT attach ambiently: `Authorization` is a non-simple header, so setting it
 * cross-site requires a CORS preflight that this API never answers, and the
 * token is not in a jar an attacker's page can read. A request that must carry a
 * bearer token is therefore not CSRF-able at all. With neither browser header AND
 * no bearer token there is nothing left to distinguish a script from an attacker,
 * so the request is rejected.
 *
 * @param request the incoming `Request`
 * @throws {ApiError} 403 when the request's origin cannot be established
 */
function assertSameOrigin(request) {
  const method = (request?.method || 'GET').toUpperCase();
  if (SAFE_METHODS.has(method)) return;

  const headers = request?.headers;
  const origin = headers?.get('origin')?.trim().toLowerCase() || '';
  const originAllowed = !!origin && allowedOrigins().has(origin);

  const secFetchSite = headers?.get('sec-fetch-site');
  if (secFetchSite) {
    const site = secFetchSite.trim().toLowerCase();

    if (site === 'same-origin' || site === 'none') return;

    // `same-site` is only a SITE relationship. It is accepted solely in
    // combination with an `Origin` this deployment actually trusts — see the
    // reasoning in this function's docblock.
    if (site === 'same-site' && originAllowed) return;

    throw new ApiError(403, 'Cross-origin request rejected');
  }

  if (originAllowed) return;

  // Neither browser header is present, so this is a non-browser client. A bearer
  // token cannot be attached ambiently by a browser (it is a non-simple header,
  // so it forces a preflight this API never answers), which makes this request
  // structurally not CSRF-able. Nothing else is accepted here.
  if (!origin && hasBearerCredentials(headers)) return;

  throw new ApiError(403, 'Cross-origin request rejected');
}

/**
 * True when the request carries an `Authorization: Bearer <token>` header.
 *
 * The `Bearer ` prefix is required, not cosmetic. `Authorization` is one of the
 * CORS non-simple headers precisely because its VALUE cannot be set by a
 * cross-origin page without a preflight; accepting the header with any other
 * scheme would keep that property (the preflight is about the header, not the
 * scheme) but would accept junk, and a bare `Authorization: x` is not a
 * credential this codebase ever issues — `auth.js` reads it as
 * `authorization?.replace('Bearer ', '')` for historical reasons.
 */
function hasBearerCredentials(headers) {
  const authorization = headers?.get('authorization');
  return (
    typeof authorization === 'string' &&
    authorization.trim().toLowerCase().startsWith('bearer ')
  );
}

/**
 * The set of origins permitted to make unsafe requests, lower-cased and
 * normalised for comparison.
 *
 * Built from `WEB_DOMAIN` (the canonical site domain, also used to build password
 * reset links in `sentOtp.js`) and `NEXT_PUBLIC_SITE_URL`, plus the localhost dev
 * origins. Values are read LAZILY on each call rather than captured at module
 * load so a variable set after import still applies, and a missing variable
 * degrades to a shorter allow-list instead of a hard failure.
 *
 * `NEXT_PUBLIC_API_BASE_URL` is deliberately NOT consulted: it is the API's own
 * address, and a request FROM the API's address is not a browser origin.
 *
 * APEX/WWW SIBLINGS ARE ADDED, REPRODUCING THE EXPRESS CORS ALLOW-LIST. The
 * original named `https://cpccu.club`, `https://www.cpccu.club`,
 * `https://cpccu.pro.bd` and `https://www.cpccu.pro.bd` as four DISTINCT
 * permitted origins (`app.js:16-27`). Configuring only one of a pair therefore
 * silently excluded the other, and since `assertSameOrigin` now accepts
 * `Sec-Fetch-Site: same-site` only for an allow-listed origin, a www→apex
 * deployment (or a redirect between the two) would 403 on every unsafe method
 * with no way to fix it short of a code change. Deriving the sibling keeps both
 * halves of a pair working without an operator having to remember to list them.
 * The two hostnames are the same site, so this widens nothing that the original
 * did not already trust.
 *
 * `EXTRA_ALLOWED_ORIGINS` (comma-separated) is the deployment-time escape hatch
 * for a host that is genuinely neither — a staging domain, a preview
 * deployment, a first-party subdomain with its own frontend. It exists so that
 * adding one is a Vercel environment variable, not a pull request against a
 * security-critical allow-list. It is an ADDITIVE list: it cannot remove the
 * configured domains, and it cannot make a bare `same-site` request acceptable
 * unless the caller actually sends that `Origin`.
 */
function allowedOrigins() {
  const origins = new Set(DEV_ORIGINS);

  for (const name of ['WEB_DOMAIN', 'NEXT_PUBLIC_SITE_URL']) {
    const value = process.env[name];
    if (!value) continue;

    const origin = value.trim().toLowerCase().replace(/\/+$/, '');
    origins.add(origin);
    for (const sibling of apexAndWww(origin)) origins.add(sibling);
  }

  for (const extra of (process.env.EXTRA_ALLOWED_ORIGINS || '').split(',')) {
    const origin = extra.trim().toLowerCase().replace(/\/+$/, '');
    if (origin) origins.add(origin);
  }

  return origins;
}

/**
 * Yields the apex and `www.` forms of an origin, excluding the one already
 * present. Operates on the hostname only, leaving scheme, port and any path
 * prefix intact, so a non-default port (`https://cpccu.club:8443`) survives.
 *
 * Returns nothing for a host that is not applicable — a `localhost` origin, an
 * IP literal, or a host already prefixed/suffixed with `www.` — so the list does
 * not fill up with nonsense entries.
 */
function apexAndWww(origin) {
  let url;
  try {
    url = new URL(origin);
  } catch {
    return [];
  }

  const { protocol, hostname, port } = url;
  const variants = [];

  if (hostname.startsWith('www.')) {
    variants.push(`${protocol}//${hostname.slice(4)}${port ? `:${port}` : ''}`);
  } else if (hostname !== 'localhost' && !hostname.includes(':')) {
    variants.push(`${protocol}//www.${hostname}${port ? `:${port}` : ''}`);
  }

  return variants.filter((variant) => variant !== origin);
}

export {
  assertBodySizeWithinLimit,
  assertSameOrigin,
  getClientIp,
  getUserAgent,
  parseCookies,
  readBody,
  readMultipart,
};
