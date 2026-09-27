import { incrementVisitor } from '@/lib/server/controllers/visitor.controller';
import { defineRoute } from '@/lib/server/handler';

/**
 * `POST /api/visitor/increment` — bump the cumulative counter by one.
 *
 * Second of the four deliberate duplicate mounts; see
 * `src/app/api/visitor/route.js` for why `/api/visitor` and `/api/v1/visitor`
 * both exist and why they must not be collapsed.
 *
 * `public: true` because the counter is incremented by anonymous page loads —
 * requiring a session would make the count wrong rather than safer, and the
 * handler reads no user data. The write is a single atomic
 * `findOneAndUpdate({ name }, { $inc: { count: 1 } }, { upsert, new: true })`,
 * so concurrent increments cannot lose an update; see
 * `visitor.controller.js` for why that matters on a high-traffic landing page.
 *
 * NOTE THE ENVELOPE: `{ success, count }`, NOT `ApiResponse`. This is envelope
 * #4 in `response.js` and is left exactly as it was.
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
