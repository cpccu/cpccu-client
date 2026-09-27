import { getPublicStatistics } from '@/lib/server/controllers/content.controller';
import { defineRoute } from '@/lib/server/handler';

/**
 * `GET /api/v1/content/statistics` — public site counters.
 *
 * `public: true` because the figures are rendered on public pages with no
 * session, and they are aggregate counts from the same
 * `getSiteStatistics()` service the admin panel uses — deliberately the SAME
 * service, so the public counter and the admin counter cannot disagree into a
 * visible inconsistency.
 *
 * ================= STATIC SEGMENT BEATS `[resource]` — AND WHAT THAT COSTS =================
 * `statistics` is a STATIC segment, and App Router resolves static segments
 * BEFORE dynamic ones. This is the same ordering property the Express router
 * depended on by registering `router.route('/statistics')` before
 * `router.route('/:resource')` — the same way, for the same reason.
 *
 * THE DIRECT CONSEQUENCE, WHICH IS A REAL AND UNAVOIDABLE BEHAVIOUR DIFFERENCE:
 * A REQUEST FOR THE LITERAL RESOURCE `"statistics"` IS UNREACHABLE. In the
 * Express original `GET /api/v1/content/statistics` matched the `/statistics`
 * handler, so `listPublicContent` could never see `resource === 'statistics'`
 * either — so this is actually FIDELITY, not a regression. The difference would
 * only appear if `statistics` were also a key in the controller's `publicModels`
 * allow-list, and it is not: unknown keys are a 404, and that 404 is now
 * unreachable behind the static segment. Preserved deliberately, and called out
 * so nobody "fixes" it by renaming one of the two files.
 *
 * `publicModels` in `content.controller.js` is the single security control
 * standing between an anonymous request and the database, and it is an
 * ALLOW-LIST. Nothing in this route can widen it.
 */

// `nodejs` because this route reaches `mongoose`, which is not Edge-compatible.
// `force-dynamic` because it aggregates over the database on every request and
// must never be prerendered into static counters at build time.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = defineRoute({
  method: 'GET',
  public: true,
  controller: getPublicStatistics,
});
