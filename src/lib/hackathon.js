/**
 * Client-side URL policy for admin-supplied hackathon links.
 *
 * This file is a MIRROR of the server's `isSafeHttpUrl` in
 * `cpccu-server/src/utils/urlPolicy.js`. The server remains the real gate — it
 * validates on write — but the client needs the same predicate so that a
 * record stored *before* the server-side validator existed, or hand-edited in
 * Mongo, degrades to an empty field instead of being rendered as a live link.
 * The two implementations must stay in step; change both together.
 *
 * ---------------------------------------------------------------------------
 * EXTERNAL LINK RULE (applies to every component in `components/HACKATHON/`)
 * ---------------------------------------------------------------------------
 * Every outbound, admin-supplied link is a PLAIN ANCHOR:
 *
 *     <a href={safeHref} target="_blank" rel="noopener noreferrer">
 *
 * NEVER `next/link`. `next/link` client-navigates, so an admin-supplied
 * external href would be pulled through our own router instead of handed to
 * the browser, and a non-http scheme would break the router outright.
 * `rel="noopener noreferrer"` is not optional: without `noopener` the opened
 * page keeps a `window.opener` handle back into our site.
 *
 * This rule is UNENFORCED. `.eslintrc.cjs:6` sets
 * `react/jsx-no-target-blank: "error"`, but `npm run lint` cannot run at all
 * (`next lint` was removed in Next 16 and eslint@10 cannot load
 * `eslint-config-next@16` — doc.md §12.1). It is therefore manual discipline.
 * `UpComingEventCard.jsx` violates this today by putting an external href on
 * `next/link`; that is pre-existing and out of scope — do not copy it, and see
 * the ⚠️ block above its `btnLink` `<Link>` for why it is being left alone
 * rather than fixed in the hackathon feature.
 *
 * Internal routes (`/login`) keep using `next/link`; the rule is about
 * outbound, admin-supplied targets only.
 * ---------------------------------------------------------------------------
 */

/** Same defensive bound as the server. Not a business rule — a multi-megabyte
 *  URL is never legitimate and would be pushed into every rendered page. */
const MAX_URL_LENGTH = 2048;

/**
 * `URL.protocol` is already lower-cased and carries the trailing colon, so
 * `JavaScript:alert(1)` normalises to `'javascript:'` and is rejected by the
 * same lookup.
 */
const SAFE_PROTOCOLS = new Set(['http:', 'https:']);

/**
 * Returns true when `value` is safe to place in an `href`.
 *
 * `''`, `null` and `undefined` are TRUE: they mean "cleared or never set", and
 * legacy Event documents have `registrationLink === undefined`. Treating
 * "absent" as invalid would blank unrelated saves.
 *
 * ⚠️ The protocol check — not the parse — is the actual gate.
 * `new URL('javascript:alert(1)')` does NOT throw: the WHATWG parser happily
 * returns a URL whose `protocol` is `'javascript:'`. An implementation that
 * only wrapped `new URL()` in try/catch would therefore ACCEPT every
 * `javascript:` and `data:` payload, which is the exact attack this function
 * exists to stop. `new URL('not a url')` throwing is the *other*, much weaker,
 * case — do not delete the `SAFE_PROTOCOLS` check believing the catch covers
 * it.
 */
export const isSafeHttpUrl = (value) => {
  if (value === null || value === undefined) {
    return true;
  }

  // A non-string (object, number, array) can never be a URL. Rejected before
  // it reaches an `href`.
  if (typeof value !== 'string') {
    return false;
  }

  const trimmed = value.trim();

  // Whitespace-only is the same "cleared" signal as empty, and `new URL('   ')`
  // throws, so it has to be handled before parsing.
  if (!trimmed) {
    return true;
  }

  if (trimmed.length > MAX_URL_LENGTH) {
    return false;
  }

  let parsed;

  try {
    parsed = new URL(trimmed);
  } catch {
    // Relative references (`not a url`) and protocol-relative `//evil.com` land
    // here. `//evil.com` is rejected on purpose: it would silently inherit
    // whatever scheme the page was served over.
    return false;
  }

  if (!SAFE_PROTOCOLS.has(parsed.protocol)) {
    return false;
  }

  // Credentials in the authority are the link-confusion vector —
  // `https://cpccu.club@evil.test/` reads as our domain but navigates
  // elsewhere. Reject rather than strip: a registration link never has them.
  if (parsed.username || parsed.password) {
    return false;
  }

  return true;
};

/**
 * Convenience wrapper for the render path: returns the URL when it is safe to
 * link to, and `''` otherwise.
 *
 * Used by `toPublicHackathon` so a poisoned stored value becomes an empty
 * string — the UI then simply omits the link — instead of being handed to
 * React as an `href`.
 */
export const toSafeHref = (value) => {
  if (!value || typeof value !== 'string') {
    return '';
  }

  return isSafeHttpUrl(value) ? value.trim() : '';
};

/**
 * Hosts whose documents we are willing to render inside an <iframe> served
 * from our own origin.
 *
 * The list is intentionally tiny. Two reasons, and the second is the decisive
 * one:
 *
 *   1. An arbitrary-host allowlist inside our own chrome is a phishing /
 *      UI-redressing surface: a framed page inherits our address bar, our TLS
 *     indicator and our layout, so anything we frame looks like it is ours.
 *   2. Most third-party document hosts send `X-Frame-Options: DENY` or a
 *     restrictive `frame-ancestors`, so the iframe would render a blank frame
 *      or a console error anyway.
 *
 * The returned URL is additionally constrained by the production CSP
 * `frame-src` allowlist in `src/proxy.ts`. THE TWO LISTS ARE COUPLED ON
 * PURPOSE: a host added here without being added there renders correctly in
 * `next dev` (the CSP is production-only) and is silently blocked in
 * production. Change one, change the other.
 */
const EMBED_ALLOWED_HOSTS = new Set(['drive.google.com', 'docs.google.com']);

const isEmbedAllowedHost = (hostname) => EMBED_ALLOWED_HOSTS.has(hostname);

/**
 * `drive.google.com/file/d/<FILE_ID>[/view|/preview]` → the same file id in
 * `/preview` form.
 *
 * The ID character set excludes `/`, so the capture cannot swallow the
 * `/view` suffix or a query string. Returns `null` for any other shape.
 */
const deriveFromFilePath = (pathname) => {
  const match = /^\/file\/d\/([^/]+?)(?:\/(?:view|preview))?\/?$/.exec(pathname);

  if (!match) {
    return null;
  }

  const fileId = match[1];

  // Defence in depth: reject an id that would let `?` or `#` escape into the
  // path we are about to build, or that is empty.
  if (!fileId || /[?#]/.test(fileId)) {
    return null;
  }

  return `https://drive.google.com/file/d/${fileId}/preview`;
};

/**
 * `docs.google.com/document/d/<DOC_ID>[/edit|/preview|...]` → the same doc id
 * in `/preview` form.
 *
 * This is the shape admins actually paste: "Share → Link" on a Google Doc
 * yields `https://docs.google.com/document/d/<ID>/edit`. It is the DOCS twin
 * of `deriveFromFilePath` (Drive → `/file/d/<ID>`) and is deliberately a
 * mirror of it — same capture discipline, same `?`/`#` rejection — so the two
 * branches stay auditable together. `edit` is a full-page editor that refuses
 * to be framed, hence the rewrite.
 */
const deriveFromDocumentPath = (pathname) => {
  const match = /^\/document\/d\/([^/]+?)(?:\/[a-z-]+)?\/?$/.exec(pathname);

  if (!match) {
    return null;
  }

  const docId = match[1];

  if (!docId || /[?#]/.test(docId)) {
    return null;
  }

  return `https://docs.google.com/document/d/${docId}/preview`;
};

/**
 * `drive.google.com/open?id=<FILE_ID>` and
 * `drive.google.com/uc?export=download&id=<FILE_ID>` → `/file/d/<id>/preview`.
 *
 * Both are the shapes admins actually paste out of a "Share → Copy link" flow.
 * `uc?export=download` is a *download* link; framing it would trigger a file
 * download inside our layout, which is why it is rewritten rather than used.
 */
const deriveFromIdQuery = (url) => {
  const fileId = url.searchParams.get('id');

  if (!fileId || /[/?#]/.test(fileId)) {
    return null;
  }

  return `https://drive.google.com/file/d/${fileId}/preview`;
};

/**
 * Converts a stored document URL into an embeddable one, or `null` when it
 * must not be framed.
 *
 * `null` is a meaningful return value, not a failure: the caller MUST render an
 * "open in a new tab" card instead of an iframe. Returning `null` is what
 * guarantees the page never shows a broken or empty frame.
 *
 * Recognised inputs:
 *   drive.google.com/file/d/<ID>/view    → …/file/d/<ID>/preview
 *   drive.google.com/file/d/<ID>         → …/file/d/<ID>/preview
 *   drive.google.com/file/d/<ID>/preview → unchanged
 *   drive.google.com/open?id=<ID>        → …/file/d/<ID>/preview
 *   drive.google.com/uc?export=download&id=<ID> → …/file/d/<ID>/preview
 *   docs.google.com/document/d/<ID>/edit → …/document/d/<ID>/preview
 *   docs.google.com/document/d/<ID>/preview → unchanged
 *   docs.google.com/gview                → rebuilt on the bare host
 *   any other http(s) host, or an unsafe/invalid value → null
 *
 * The `/file/d/<ID>` → `/preview` rewrite is what makes the function
 * idempotent: its output is always the embeddable preview form, so running it
 * again on its own result is a no-op. Bare `/file/d/<ID>` is rewritten rather
 * than passed through because it serves a view page that refuses to be framed.
 *
 * ⚠️ EVERY RETURNED URL IS REBUILT ON A CANONICAL BARE HOST — never passed
 * through verbatim. The allowlist comparison above strips a `www.` prefix, so
 * `https://www.docs.google.com/gview…` passes the check while still carrying
 * the `www.` host into the `<iframe src>`. CSP host matching is EXACT, and
 * `frame-src` in `src/proxy.ts` lists `https://docs.google.com` without it, so
 * that URL works under `next dev` (where the CSP block is absent entirely) and
 * renders a silently blank frame in production. Rebuilding as
 * `https://docs.google.com` + pathname + search keeps the emitted host inside
 * the CSP allowlist, which is what makes the one-line coupling comment in
 * `proxy.ts` true. Rebuilding is also what keeps the docs branch idempotent:
 * a rebuilt URL re-normalises to itself, whereas a verbatim one only happens
 * to be stable when the admin never typed `www.`.
 */
export const deriveEmbeddableUrl = (rawUrl) => {
  const safeHref = toSafeHref(rawUrl);

  if (!safeHref) {
    return null;
  }

  let url;

  try {
    url = new URL(safeHref);
  } catch {
    // Unreachable in practice: `toSafeHref` already parsed it successfully.
    return null;
  }

  // `www.drive.google.com` is not a real host, but normalising the prefix
  // avoids an allowlist that has to carry both spellings.
  const hostname = url.hostname.replace(/^www\./, '');

  if (!isEmbedAllowedHost(hostname)) {
    return null;
  }

  // `hostname` (not `url.hostname`) is used to rebuild: `hostname` is the bare
  // host with the `www.` prefix already removed, so emitting it is what keeps
  // the returned URL inside the CSP `frame-src` allowlist. See the ⚠️ block in
  // this function's docstring.
  if (hostname === 'docs.google.com') {
    // `/gview` is Google's own "view this document in a frame" endpoint and is
    // already embeddable — but it is REBUILT, not passed through, so a
    // `www.docs.google.com` input cannot smuggle a CSP-blocked host into the
    // iframe src. The query string is preserved because `/gview` carries the
    // document to view in `?embedded=true&url=…`.
    if (url.pathname === '/gview' || url.pathname.startsWith('/gview/')) {
      return `https://docs.google.com${url.pathname}${url.search}`;
    }

    const fromDocument = deriveFromDocumentPath(url.pathname);

    if (fromDocument) {
      return fromDocument;
    }

    return null;
  }

  const fromPath = deriveFromFilePath(url.pathname);

  if (fromPath) {
    return fromPath;
  }

  // `uc?export=download&id=…` and `open?id=…` both carry the id in the query.
  if (url.pathname === '/uc' || url.pathname === '/open') {
    return deriveFromIdQuery(url);
  }

  return null;
};
