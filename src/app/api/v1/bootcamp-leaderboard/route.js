import { getBootcampLeaderboard } from '@/lib/server/controllers/bootcampLeaderboard.controller';
import { defineRoute } from '@/lib/server/handler';

/**
 * `GET /api/v1/bootcamp-leaderboard` — the public leaderboard.
 *
 * `public: true` because the leaderboard is rendered on a public page with no
 * session, and it is read from a Google Sheet rather than from any member data.
 *
 * ================= ONE FILE COVERS BOTH EXPRESS URLS — VERIFIED =================
 * The Express original registered the handler as `router.get('/', …)` and the
 * router was mounted at `/api/v1/bootcamp-leaderboard`, which made TWO valid
 * URLs: `/api/v1/bootcamp-leaderboard` (the mount point, matched by the `'/'
 *     route) and `/api/v1/bootcamp-leaderboard/` (the same, with the trailing
 *     slash Express's `strict routing` is off by default).
 *
 * ONE FILE IS CORRECT HERE BECAUSE `next.config.mjs` DOES NOT SET
 * `trailingSlash`, so App Router uses its DEFAULT of `false` and NORMALISES
 * `/api/v1/bootcamp-leaderboard/` to `/api/v1/bootcamp-leaderboard` before
 * routing. A single `route.js` therefore answers both spellings, exactly as the
 * Express mount did. Had the project set `trailingSlash: true`, the same single
 * file would still be correct — Next would simply normalise in the other
 * direction — so this route is insensitive to that setting either way. It is
 * stated because the reverse mistake (shipping two directories, `leaderboard/`
 * and `leaderboard/`-with-a-slash) is not possible and should not be attempted.
 *
 * `res.set('Cache-Control', 'no-store')` inside the controller is a no-op here:
 * `http.js`'s `withApiHeaders` overwrites `Cache-Control` with `no-store` on
 * every response as a policy. The call is kept because it is in the ported
 * controller body, which is preserved verbatim.
 */

// `nodejs` because the controller reaches the Google Sheets API and `xlsx`, and
// is server-only regardless. `force-dynamic` because it fetches live sheet data
// per request and must never be prerendered into a static leaderboard.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = defineRoute({
  method: 'GET',
  public: true,
  controller: getBootcampLeaderboard,
});
