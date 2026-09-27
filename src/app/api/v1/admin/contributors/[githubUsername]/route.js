import { updateContributorMetadata } from '@/lib/server/controllers/adminContent.controller';
import { defineRoute } from '@/lib/server/handler';

/**
 * `PATCH /api/v1/admin/contributors/:githubUsername` — edit one contributor's
 * `batch` / `linkedin` IN THE REPOSITORY FILE.
 *
 * ============================================================================
 * THIS WRITES TO A DIFFERENT GIT REPOSITORY. THE TWO `/contributors` ENDPOINTS
 * ARE THE ONLY ONES IN THE ENTIRE API THAT REACH OUTSIDE THIS DATABASE — i.e. the
 * only ones whose effect is not a Mongo read or write.
 * ============================================================================
 * The target is `cpccu/cpccu-client@release:data/contributors.json` — a file in
 * ANOTHER repository, read and written through the GitHub Contents API with the
 * `CONTRIBUTOR_GITHUB_TOKEN` secret. A successful PATCH is a COMMIT: it is
 * reviewed, reverted by a later regeneration, and visible in that repository's
 * history, not in this database's. No audit log is written for it either — the
 * commit IS the record. Two operational consequences that no other endpoint here
 * has: a mis-scoped token on that repository is the whole blast radius, and a
 * revert of a bad edit is a `git revert`, not a database restore.
 *
 * WHY THE WRITE EXISTS AT ALL RATHER THAN A DATABASE COLUMN: the site is DEPLOYED
 * FROM THAT FILE. A daily GitHub Action regenerates `data/contributors.json` from
 * the git history, so a database-backed contributor list would be a second,
 * conflicting source of truth the workflow knows nothing about. The file is the
 * source of truth and this endpoint is its admin editor. The same reason is why
 * only `batch` and `linkedin` are editable: `name`, `github` and everything else
 * in the file are REGENERATED from git history daily, so an admin edit to any of
 * them would be reverted within a day.
 *
 * NOT THE `contributors` MONGO COLLECTION. `/api/v1/admin/content/contributors` is
 * a different, generic-whitelist CRUD surface over `models.contributors` in Mongo
 * — including writes. Do not conflate the two; the full note is in
 * `contributors/route.js`.
 *
 * `admin: true` is the per-file replacement for the Express
 * `router.use(verifyToken, requireAdmin, authorizeAdminAction)`
 * (`admin.route.js:41`); the full chain note is in
 * `src/app/api/v1/admin/roles/route.js`. Omitting it does not make the route
 * public — auth is the default — but it removes every per-action check, so any
 * authenticated member could commit to another repository with the server's
 * token. That is the most privileged single-URL exposure in the admin surface,
 * and it is why the flag is read explicitly here.
 *
 * DERIVATION: `describeAdminRoute('/api/v1/admin/contributors/<githubUsername>')`
 * gives `path === '/contributors/<githubUsername>'`, `resource === null` (the
 * `contributors` here is the FIRST segment, not a `/content/…` resource),
 * `isUpload === false`. So: `admin` → allow; `moderator` → DENY (a `PATCH` is not
 * `isReadOnly`); `mentor` → DENY (method, and `/contributors` is not in
 * `mentorReadPaths` — see the stale-comment warning in the sibling file, which is
 * why a mentor cannot even read this list).
 *
 * PRESERVED, and worth knowing before changing anything: the write is a
 * COMPARE-AND-SWAP retried AT MOST THREE TIMES. The Contents API rejects a `PUT`
 * with 409 unless the presented blob `sha` still matches the branch, and the
 * daily workflow can land its own regeneration between the read and the write, so
 * the handler re-fetches (new sha AND new contents, re-applying the edit on top
 * of their version rather than reverting it) and retries. The third 409 surfaces
 * as a 502 rather than looping forever against a rate-limited API. The length
 * caps (32 for `batch`, 500 for `linkedin`) are the ONLY bound on what a commit
 * can write into the file, and `slice` TRUNCATES rather than rejecting, so an
 * over-long value is silently cut.
 *
 * SEGMENT DISJOINTNESS: two segments with a STATIC first segment, so the
 * one-segment `contributors` file cannot serve it, and the first segment
 * distinguishes it from `roles/[id]` (also two segments) and from the
 * three-segment `content/[resource]/[id]`. No catch-all exists under
 * `src/app/api/v1/admin/`.
 */

// `nodejs` because this route performs network calls to the GitHub Contents API
// and reads `process.env`, and is declared alongside the rest of the admin
// router. `force-dynamic` because it reads the auth cookie and performs a live
// remote read-plus-write on every request; it must never be prerendered, and the
// unconditional `Cache-Control: no-store` in `http.js` guarantees it.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const PATCH = defineRoute('PATCH', {
  admin: true,
  controller: updateContributorMetadata,
});
