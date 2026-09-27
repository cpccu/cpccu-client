import {
  deleteAdminContent,
  updateAdminContent,
} from '@/lib/server/controllers/adminContent.controller';
import { defineRoute } from '@/lib/server/handler';

/**
 * `PATCH|DELETE /api/v1/admin/content/:resource/:id` — update or hard-delete one
 * document in one of the eleven whitelisted collections. Two methods, one file.
 *
 * `admin: true` is the per-file replacement for the Express
 * `router.use(verifyToken, requireAdmin, authorizeAdminAction)`
 * (`admin.route.js:41`); the full chain note is in
 * `src/app/api/v1/admin/roles/route.js` and the "authorise the action vs the
 * target" note in `content/[resource]/route.js`, which is the sibling that
 * establishes the two-gate model this file depends on.
 *
 * DERIVATION: `describeAdminRoute('/api/v1/admin/content/events/<id>')` gives
 * `path === '/content/events/<id>'`, `resource === 'events'`,
 * `isUpload === false`. The `<id>` is the THIRD segment and is invisible to every
 * allowlist test — only the first two segments are consulted, which is why the
 * admin-path derivation is stable no matter what the id is.
 *   - `admin` → allow, unconditionally.
 *   - `moderator` → allow ONLY for `events`, `gallery`, `posts`,
 *     `gallery-events` (`moderatorResources`); for `profiles`, `contributors`,
 *     `alumni`, `donators`, `committees`, `messages` and `audit-logs` it is
 *     DENIED with a bare 403.
 *   - `mentor` → DENY on both verbs; a mentor is never allowed a write anywhere,
 *     and `/content` is not in `mentorReadPaths` at all, so even the GET is
 *     denied on this router.
 * A rewritten or trailing-slashed pathname would derive `resource: null`, which
 * is in no allowlist — so the visible symptom of that class of breakage is
 * "moderators cannot save events", with no error anywhere. `next.config.mjs` has
 * no rewrites and `src/proxy.ts` does not rewrite, so the pathname arrives
 * absolute today.
 *
 * ==================== PRESERVED: `$set: req.body`, UNFILTERED ====================
 * `updateAdminContent` has TWO update shapes, and the difference is a security
 * boundary:
 *   - `profiles` → `buildDeveloperProfileUpdate(body)`, a hand-written allowlist
 *     plus the three legal moderation statuses. The ONLY collection on this
 *     endpoint that validates what it writes.
 *   - EVERYTHING ELSE → `{ $set: req.body }`, i.e. a MASS-ASSIGNMENT SURFACE: the
 *     caller's body becomes the update verbatim, so a caller who reaches this
 *     endpoint can set any other field the schema defines on that collection,
 *     including internal ones. It is bounded only by `getModel`'s whitelist, the
 *     role matrix above, and `runValidators: true` (which matters MORE here than
 *     anywhere else, precisely because the payload is unfiltered — it is what
 *     stops an out-of-enum `status` or an oversized `title` reaching the
 *     collection through an update).
 * PRESERVED, NOT HARDENED. Narrowing it per collection is eleven product
 * decisions, not a porting change, and it would change what the panel can save.
 * If a field allowlist is ever added, THIS comment is what must be updated with
 * it.
 *
 * ================== PRESERVED: `profiles` IS NEVER AUDITED ==================
 * The `profiles` branch RETURNS BEFORE `writeAuditLog` is reached, so approving or
 * rejecting a developer profile — the most consequential action this controller
 * performs, and the one that decides whether a member appears on the public site
 * — leaves NO audit record. The other ten resources are audited. This is
 * original behaviour and is preserved; it is called out here because it is
 * exactly the kind of gap a reader assumes cannot exist. Note the interaction
 * with the `audit-logs` writability finding in the sibling file: the audit trail
 * is both incomplete for `profiles` and writable through this router, so it is
 * not a reliable record even where it is written.
 *
 * ====================== DELETES ARE HARD DELETES ======================
 * No schema here has a `deletedAt`, so a DELETE destroys the document outright.
 * Any Cloudinary image it referenced is left behind as an ORPHANED ASSET —
 * nothing in this controller calls `destroyCloudinaryImage`, and the document
 * that carried the public id is the thing being deleted, so there is nothing left
 * to clean up with. Preserved leak. For `profiles`, the denormalised job-pipeline
 * copy on the user document is cleared first so the member does not stay listed
 * on the public job pipeline with no profile behind them.
 *
 * SEGMENT DISJOINTNESS: three segments below the mount with a STATIC first
 * segment, so it cannot be reached by any two-segment file in this router
 * (`roles/[id]`, `roles/active`, `content/[resource]`) and cannot reach the
 * three-segment role path `roles/[id]/toggle` (static first segments differ).
 * No catch-all exists anywhere under `src/app/api/v1/admin/`.
 */

// `nodejs` because these routes reach `mongoose`, which is not Edge-compatible.
// `force-dynamic` because they read the auth cookie and the database, and must
// never be prerendered or cached.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const PATCH = defineRoute('PATCH', {
  admin: true,
  controller: updateAdminContent,
});

export const DELETE = defineRoute('DELETE', {
  admin: true,
  controller: deleteAdminContent,
});
