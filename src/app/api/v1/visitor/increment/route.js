import { incrementVisitor } from '@/lib/server/controllers/visitor.controller';
import { defineRoute } from '@/lib/server/handler';

/**
 * `POST /api/v1/visitor/increment` — bump the cumulative counter, versioned path.
 *
 * Fourth of the four deliberate duplicate mounts. See
 * `src/app/api/visitor/route.js` for why `/api/visitor*` and `/api/v1/visitor*`
 * both exist (the Express router registered `/visitor` and `/v1/visitor` under
 * the single `/api` mount) and why collapsing them would break the shipped
 * client.
 *
 * `public: true` — anonymous page loads must be able to bump the counter.
 */

// `nodejs` because this route reaches `mongoose`, which is not Edge-compatible.
// `force-dynamic` because it is a state-changing request handler that must never
// be prerendered, and because the CSRF check must run on every call.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = defineRoute('POST', {
  public: true,
  controller: incrementVisitor,
});
