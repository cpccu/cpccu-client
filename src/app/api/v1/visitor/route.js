import { getVisitorCount } from '@/lib/server/controllers/visitor.controller';
import { defineRoute } from '@/lib/server/handler';

/**
 * `GET /api/v1/visitor` — the cumulative visitor count, at the versioned path.
 *
 * This is the same handler mounted at a second URL by design, not a second
 * implementation. The Express router registered both `/visitor` and `/v1/visitor`
 * under the single `/api` mount, so both `/api/visitor` and `/api/v1/visitor`
 * were live; `src/app/api/visitor/route.js` carries the full explanation of why
 * the duplication is preserved.
 *
 * CORRECTION to the note this file used to carry, which said the client
 * (`VisitorCounter.jsx`) depends on the NON-versioned `/api/visitor`. It does
 * not, in any configuration that sets `NEXT_PUBLIC_API_BASE_URL` — and that
 * variable is set everywhere, including `.env` and `.env.sample`.
 * `VisitorCounter.jsx:9-12` calls `${NEXT_PUBLIC_API_BASE_URL}/visitor`, i.e.
 * THIS path, and only falls back to the bare `/api/visitor` when the variable is
 * empty. See the reworded block in `src/app/api/visitor/route.js` for the full
 * reasoning and for why both mounts nevertheless stay.
 *
 * UPDATE (cutover, 2026-09): `NEXT_PUBLIC_API_BASE_URL` has been DELETED from the
 * client along with every other read of it, and `VisitorCounter.jsx` now builds
 * `/api/v1/visitor` — THIS path — as a hard-coded literal with no fallback
 * branch. So the "only falls back … when the variable is empty" clause above is
 * now history: the bare `/api/visitor` mount has no in-app consumer at all. It
 * is still PRESERVED, for the backwards-compatibility reasons in
 * `src/app/api/visitor/route.js`; "no in-app consumer" is not "safe to delete".
 *
 * `public: true` — public site decoration, `{ count }` envelope, no user data.
 */

// `nodejs` because this route reaches `mongoose`, which is not Edge-compatible.
// `force-dynamic` because it is a request handler and must never be prerendered
// into a static count at build time.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = defineRoute('GET', {
  public: true,
  controller: getVisitorCount,
});
