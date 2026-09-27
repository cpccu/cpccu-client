import { listContributors } from '@/lib/server/controllers/adminContent.controller';
import { defineRoute } from '@/lib/server/handler';

/**
 * `GET /api/v1/admin/contributors` — the contributors list, read LIVE OUT OF THE
 * REPOSITORY, not out of MongoDB.
 *
 * ============================================================================
 * THE STALE UPSTREAM COMMENT — READ THIS BEFORE "FIXING" `mentorReadPaths`
 * ============================================================================
 * `cpccu-server/src/routes/admin.route.js:76` says:
 *
 *     // GitHub-synced contributors (data/contributors.json in cpccu-client).
 *     // GET is readable by any admin-role user; PATCH is admin-only via
 *     //   authorizeAdminAction.
 *
 * The FIRST half of that is what a future reader is likely to "repair". IT IS
 * WRONG. "Any admin-role user" in the original's own middleware means
 * `requireAdmin`'s `['admin', 'moderator', 'mentor']` — but `authorizeAdminAction`
 * runs AFTER it and DENIES mentors, because `mentorReadPaths` is exactly
 * `['/overview', '/members', '/certificates', '/statistics']` and
 * `'/contributors'` is not in it. A mentor GET here falls straight through to the
 * 403. The code is authoritative and the comment is wrong; `adminAuth.js`
 * documents the same discrepancy.
 *
 * DO NOT ADD `contributors` TO `mentorReadPaths` TO MATCH THE COMMENT. That would
 * GRANT mentors an access they have never had — a silent privilege escalation,
 * invisible in review because it would be made to look like a comment fix, and
 * invisible at runtime because a mentor reading a public contributors list looks
 * exactly like a mentor being helpful. The migration's rule is the opposite of
 * that instinct: this file preserves the DENY, and any change to role behaviour
 * requires re-checking the whole matrix in
 * `src/app/api/v1/admin/roles/route.js` (which also records that
 * `adminAuth.js` has zero test coverage in the Express original and that the
 * table was re-derived three times here).
 *
 * THE DERIVATION, for the record: `describeAdminRoute('/api/v1/admin/contributors')`
 * gives `path === '/contributors'`, `resource === null` (this is NOT under
 * `/content`, so `describeAdminRoute` yields no resource), `isUpload === false`.
 * So: `admin` → allow; `moderator` → allow, but only via `isReadOnly`, i.e. any
 * GET on any admin route; `mentor` → DENY, per the note above; `member` → 403
 * "Admin access is required"; anonymous → 401.
 *
 * ====================== NOT THE `contributors` COLLECTION ======================
 * There are TWO unrelated things named "contributors" in this API, and conflating
 * them would be a real bug:
 *   1. `models.contributors -> Contributor` — a MONGO collection, reached through
 *      the generic whitelist at `/api/v1/admin/content/contributors`, where the
 *      admin panel can read, create, edit and DELETE documents.
 *   2. THIS endpoint — the GitHub Contents API against
 *      `cpccu/cpccu-client@release:data/contributors.json`. No Mongo involvement
 *      whatsoever.
 * They are separate because the SITE IS DEPLOYED FROM THAT FILE: a daily GitHub
 * Action regenerates `data/contributors.json` from the git history, so a
 * database-backed contributor list would be a second, conflicting source of truth
 * that the workflow knows nothing about. The file is the source of truth; this
 * controller is the admin-panel editor for it.
 *
 * ============ THE ONLY ENDPOINTS WHOSE EFFECT LEAVES THIS DATABASE ============
 * `listContributors` performs a READ of a file in ANOTHER GIT REPOSITORY, and its
 * sibling `PATCH /api/v1/admin/contributors/:githubUsername` performs a WRITE to
 * it — a real commit through the GitHub Contents API, gated by the
 * `CONTRIBUTOR_GITHUB_TOKEN` secret and answering 503 when that secret is unset
 * (deliberately not an empty list: an empty list would read to an admin as "this
 * site has no contributors", i.e. as data loss, rather than as a misconfigured
 * deployment). Every other endpoint in the API reads and writes only this
 * application's MongoDB, which is why a transaction, a replica lag or a
 * credential scope review over the rest of the surface does not cover these two.
 *
 * `admin: true` is the per-file replacement for the Express
 * `router.use(verifyToken, requireAdmin, authorizeAdminAction)`
 * (`admin.route.js:41`); the full chain note is in
 * `src/app/api/v1/admin/roles/route.js`. Omitting it leaves the route
 * authenticated but with no per-action check. `adminAuth.js` fails closed, so
 * that omission is the recoverable direction.
 *
 * SEGMENT DISJOINTNESS: one static segment below the mount, so it cannot be
 * reached by the two-segment `contributors/[githubUsername]`, and it is a
 * different first segment from every other `[id]` in this router — so it is
 * disjoint from `content/[resource]` (two segments) by depth as well. No
 * catch-all exists under `src/app/api/v1/admin/`.
 */

// `nodejs` because this route performs a network call to the GitHub Contents API,
// which is not an Edge runtime concern but is stated here for uniformity with the
// rest of the admin router. `force-dynamic` because it reads the auth cookie and
// performs a live remote read on every request — it must never be prerendered or
// cached, and the unconditional `Cache-Control: no-store` in `http.js` is what
// guarantees that.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = defineRoute('GET', {
  admin: true,
  controller: listContributors,
});
