import { listPublicContent } from '@/lib/server/controllers/content.controller';
import { defineRoute } from '@/lib/server/handler';

/**
 * `GET /api/v1/content/:resource` — the public read surface of every collection
 * the admin panel manages.
 *
 * `public: true`, and this is the route where that is most load-bearing in the
 * whole migration: `content.controller.js` guards the database with a
 * `publicModels` ALLOW-LIST looked up by this exact URL segment, so anything not
 * in it is a 404 rather than a query. That is what stops
 * `/api/v1/content/users` or `/api/v1/content/adminauditlogs` from turning a
 * public endpoint into a data-exfiltration primitive. Do not "generalise" the
 * lookup to a dynamic `mongoose.model(resource)` and do not add a collection to
 * the list without checking what it holds.
 *
 * ============ WHY `content/statistics/route.js` WINS OVER THIS `[resource]` ============
 * App Router resolves STATIC SEGMENTS BEFORE DYNAMIC ONES, so
 * `/api/v1/content/statistics` is served by the static sibling and NEVER reaches
 * this handler with `resource === 'statistics'`. The literal resource
 * `"statistics"` is therefore unreachable — which matches the Express original,
 * where `/statistics` was registered before `/:resource` and shadowed it the same
 * way. See the sibling file for the full note.
 *
 * NOTE ALSO THAT `content/[resource]` IS THE ONLY DYNAMIC SEGMENT DIRECTLY UNDER
 * `content/`, so it is one segment deep and cannot collide with the two-segment
 * static path. No catch-all (`[...path]`) is used anywhere in this router, which
 * matters: a catch-all here would have to special-case `statistics` by hand, and
 * forgetting that special case is precisely the failure this file's comment
 * exists to prevent.
 */

// `nodejs` because this route reaches `mongoose`, which is not Edge-compatible.
// `force-dynamic` because it reads the database on every request and must never
// be prerendered into a static payload at build time.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = defineRoute('GET', {
  public: true,
  controller: listPublicContent,
});
