import { apiRoute } from '@/lib/server/http';

/**
 * `GET /api/v1` — the server health probe.
 *
 * Body reproduced VERBATIM from the Express original
 * (`cpccu-server/src/index.js:22-24`), including the surrounding brackets, and
 * served as `text/html` because `res.send(<string>)` in Express sets
 * `text/html`. It is a string, not JSON, and the frontend does not parse it.
 *
 * THE SIBLING `GET /` IS **NOT** MIGRATED, and cannot be. The Express original
 * registered two identical health handlers — one at `/` and one at `/api/v1` —
 * but `src/app/(main)/page.jsx` already owns the `/` segment, and App Router
 * FORBIDS a `page.jsx` and a `route.js` at the same segment (the build fails on
 * the conflict). Creating `src/app/route.js` is therefore not an oversight to be
 * tidied up later; it is not a legal file. `/api/v1` is the health endpoint for
 * this app and the only one that can exist.
 *
 * WHY THIS ONE FILE USES `apiRoute` DIRECTLY RATHER THAN `defineRoute` — it is
 * the single deliberate exception, not a shortcut. The response must be
 * `text/html` with a raw string body, and `defineRoute` is built on `createShim`,
 * whose `collect.result()` can only ever produce a `{ status, body }` pair that
 * `toResponse` serialises with `Response.json`. A JSON health body would be a
 * change to a response a load balancer and `curl` both read.
 *
 * Going through `apiRoute` anyway — rather than exporting a bare function — is
 * what keeps the invariant `http.js` exists to enforce: the body-size gate, the
 * CSRF check (`GET` is in `SAFE_METHODS`, so it is a no-op rather than a gap),
 * and — the reason this matters most — `withApiHeaders`, which stamps
 * `Cache-Control: no-store` and `X-Content-Type-Options: nosniff` onto this
 * response. A hand-rolled `new Response(...)` export would have none of them.
 * `public: true` is justified: a health probe is the one endpoint that must
 * answer before a client holds any credential, it returns a constant string, and
 * it reads no data, so it discloses nothing.
 */

// `nodejs` because the route transitively imports the server foundation
// (`mongoose`, `jsonwebtoken`, `bcryptjs` — none of them Edge-compatible).
// `force-dynamic` because it is a request handler that must never be prerendered
// into a static body at build time.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HEALTH_BODY =
  'Competitive Programming Camp City University - [Server is running]';

export const GET = apiRoute({
  public: true,
  handler: () =>
    new Response(HEALTH_BODY, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    }),
});
