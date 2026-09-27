import { getVisitorCount } from '@/lib/server/controllers/visitor.controller';
import { defineRoute } from '@/lib/server/handler';

/**
 * `GET /api/v1/visitor` — the cumulative visitor count, at the versioned path.
 *
 * This is the same handler mounted at a second URL by design, not a second
 * implementation. The Express router registered both `/visitor` and `/v1/visitor`
 * under the single `/api` mount, so both `/api/visitor` and `/api/v1/visitor`
 * were live; `src/app/api/visitor/route.js` carries the full explanation of why
 * the duplication is preserved and why the client (`VisitorCounter.jsx`) depends
 * on the non-versioned one.
 *
 * `public: true` — public site decoration, `{ count }` envelope, no user data.
 */

// `nodejs` because this route reaches `mongoose`, which is not Edge-compatible.
// `force-dynamic` because it is a request handler and must never be prerendered
// into a static count at build time.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = defineRoute({
  method: 'GET',
  public: true,
  controller: getVisitorCount,
});
