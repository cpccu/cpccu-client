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
 * THE DUPLICATION IS INTENTIONAL AND MUST NOT BE COLLAPSED, but the stated
 * justification was WRONG and is corrected here. The previous version of this
 * comment claimed "this tree is the one the client actually calls". It is not.
 * `src/components/HOME/VisitorCounter.jsx:9-12` builds its URL as:
 *
 *     API_BASE_URL ? `${API_BASE_URL}/visitor` : "/api/visitor"
 *
 * so the non-versioned `/api/visitor` path is used ONLY in the fallback branch,
 * i.e. only when `NEXT_PUBLIC_API_BASE_URL` is EMPTY or unset. It is set — in
 * `.env`, in `.env.sample` and in every deployed environment — so the client
 * actually calls the VERSIONED `/api/v1/visitor` (this tree's sibling), and
 * `/api/visitor` is a fallback the current configuration never takes.
 *
 * That does NOT make this mount safe to delete, which is why both stay:
 *
 *   - `/api/visitor` is a PUBLIC, unauthenticated, GET-only path. It is a
 *     bookmarkable/curl-able endpoint, it predates the versioned mount, and
 *     removing it is a breaking change to anything already pointing at it —
 *     including any deployment still running with the env var unset, which is
 *     exactly the configuration in which this path is the one that gets hit.
 *   - Collapsing the two mounts is a separate, deliberate change with its own
 *     review. It is not something a route file may do opportunistically.
 *
 * If the two mounts are ever consolidated, this comment is the place to record
 * the decision — and the `NEXT_PUBLIC_API_BASE_URL`-is-empty branch in
 * `VisitorCounter.jsx` is the consumer that has to be dealt with at the same
 * time, or the fallback 404s.
 *
 * UPDATE (cutover, 2026-09): that branch is GONE. `NEXT_PUBLIC_API_BASE_URL` was
 * deleted from the client with every other read of it, and `VisitorCounter.jsx`
 * now calls `/api/v1/visitor` as a hard-coded literal with no fallback at all —
 * so the paragraph above describes a configuration that no longer exists, and
 * THIS mount currently has zero in-app consumers. It is still PRESERVED: this
 * is a public, unauthenticated, bookmarkable path that predates the versioned
 * mount, and "our own UI no longer links it" is not the same as "removing it is
 * safe". Nothing in the cutover may be read as approval to delete it.
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

export const GET = defineRoute('GET', {
  public: true,
  controller: getVisitorCount,
});
