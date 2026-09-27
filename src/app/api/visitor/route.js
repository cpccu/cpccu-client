import { getVisitorCount } from '@/lib/server/controllers/visitor.controller';
import { defineRoute } from '@/lib/server/handler';

/**
 * `GET /api/visitor` — the cumulative visitor count.
 *
 * DELIBERATE FIDELITY, and the FIRST of two mounts. The Express router
 * (`cpccu-server/src/routes/visitor.route.js`) registered FOUR handlers across
 * TWO prefixes because `app.js` mounts the same router at BOTH `/api` and — via
 * the same router's own `/v1/...` paths — nothing else:
 *
 *     router.get ('/visitor',                  getVisitorCount)
 *     router.post('/visitor/increment',        incrementVisitor)
 *     router.get ('/v1/visitor',               getVisitorCount)
 *     router.post('/v1/visitor/increment',     incrementVisitor)
 *     // mounted with: app.use('/api', visitorRoutes)   →  /api/visitor…
 *     //                                            and /api/v1/visitor…
 *
 * The `/v1/…` entries exist INSIDE the `/api` mount, which is why they resolve to
 * `/api/v1/visitor` and not to a second top-level `/v1` mount. Both trees are
 * reproduced here and in the three sibling files.
 *
 * THE DUPLICATION IS INTENTIONAL AND MUST NOT BE COLLAPSED. This tree is the one
 * the client actually calls: `src/components/HOME/VisitorCounter.jsx:12` builds
 * its URL as `/api/visitor` (it appends `/v1` only when
 * `NEXT_PUBLIC_API_BASE_URL` is external). Deleting this mount and leaving only
 * `/api/v1/visitor` would be a BREAKING change to a shipped client for zero
 * benefit, so consolidating the two mounts is a separate, deliberate change and
 * not something a route file may do opportunistically.
 *
 * `public: true` because a visitor counter is public site decoration: it is on
 * the unauthenticated landing page, and the envelope is `{ count }` with no user
 * data of any kind. Note it is NOT `ApiResponse` — this is envelope #4 of the
 * four documented in `response.js` (`{ count }` on success AND on the 500, with
 * no `success` key) and it is deliberately not normalised.
 */

// `nodejs` because this route reaches `mongoose`, which is not Edge-compatible.
// `force-dynamic` because it reads a cookie/header-derived IP through the rate
// limiter and must never be prerendered or cached as a static count.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = defineRoute({
  method: 'GET',
  public: true,
  controller: getVisitorCount,
});
