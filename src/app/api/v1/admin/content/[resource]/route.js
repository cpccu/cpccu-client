import {
  createAdminContent,
  listAdminContent,
} from '@/lib/server/controllers/adminContent.controller';
import { defineRoute } from '@/lib/server/handler';

/**
 * `GET|POST /api/v1/admin/content/:resource` — the GENERIC admin CRUD surface
 * over eleven collections. Two methods, one file.
 *
 * This is the file where the `admin: true` chain matters most, because `:resource`
 * is chosen BY THE CALLER and is the half of the authorisation that lives in the
 * controller rather than in `adminAuth.js`.
 *
 * ============================================================================
 * `admin: true` IS NOT OPTIONAL HERE, AND FORGETTING IT IS THE WORST OMISSION IN
 * THE ROUTER
 * ============================================================================
 * `admin: true` is the per-file replacement for the Express
 * `router.use(verifyToken, requireAdmin, authorizeAdminAction)`
 * (`admin.route.js:41`) — that one line guarded all 24 endpoints, and App Router
 * has no equivalent, so the guard is restated in every file. The full chain note
 * is in `src/app/api/v1/admin/roles/route.js`. On most files a forgotten flag
 * means "one endpoint became readable/writable by members". HERE it means the
 * generic create/list surface over eleven collections is opened to every
 * authenticated member, because the role matrix is the ONLY thing limiting which
 * `:resource` values a non-admin may reach.
 *
 * The omission is SILENT rather than loud: the route stays AUTHENTICATED (auth is
 * the default in `apiRoute`), so it is not public, and it still passes
 * `getModel`'s whitelist — but every member clears it, and a moderator clears
 * the per-resource restriction too. `adminAuth.js` fails CLOSED by design
 * (`requireAdmin` refuses `member`; `authorizeAdminAction` throws for anything
 * not positively allowed), and that default-deny is what makes this
 * unrecoverable-by-omission mistake recoverable: it can only ever open a route
 * in a direction that is visible in review and in the logs, never silently
 * narrow one.
 *
 * ================= AUTHORISING THE ACTION IS NOT AUTHORISING THE TARGET =================
 * Two independent gates, and NEITHER substitutes for the other:
 *   1. `requireAdminAction` decides whether this ROLE may perform THIS METHOD on
 *      THIS PATH. It derives `resource` from the path
 *      (`describeAdminRoute('/api/v1/admin/content/events')` →
 *      `path === '/content/events'`, `resource === 'events'`,
 *      `isUpload === false`) and allows a moderator a write ONLY for
 *      `moderatorResources = ['events', 'gallery', 'posts', 'gallery-events']`.
 *   2. `getModel(resource)` decides WHICH COLLECTION is reachable at all, through
 *      the `models` whitelist in `adminContent.controller.js`. A key that is
 *      absent is a 404 before any query is built. It knows nothing about who is
 *      calling.
 * Drop (1) and a member may write any whitelisted collection. Drop (2) and a
 * moderator could not write `profiles` but an admin could still reach any model
 * name the caller supplied. Both must hold.
 *
 * `adminAuth.js` has ZERO TEST COVERAGE in the original Express backend and the
 * matrix was re-derived three times during this migration before it was
 * confirmed to agree with `cpccu-server/docs/API_REFERENCE.md` ("Permission
 * matrix (admin)") and with `adminAuth.js`'s own comments. Any change to a role
 * list, or to which files carry `admin: true`, requires the whole table to be
 * RE-CHECKED — the failure is silent, and in the moderator case it presents as
 * "moderators cannot save posts" rather than as an error.
 *
 * ================== `:resource` MUST BE THE REAL, UNREWRITTEN PATH ==================
 * Because `resource` is DERIVED from `request.nextUrl.pathname` (via
 * `http.js:pathnameOf` → `describeAdminRoute`), a rewritten, trailing-slashed or
 * relative pathname yields `resource: null` — which is in no allowlist, so every
 * MODERATOR write here is denied with a bare 403 while ADMINS are entirely
 * unaffected (`role === 'admin'` returns true before the resource is consulted).
 * Nothing in `next.config.mjs` rewrites `/api`, and `src/proxy.ts` returns a
 * bare `NextResponse.next()`, so the pathname arrives absolute and unrewritten
 * today. The failure mode to remember if that ever stops being true: moderators
 * cannot save, nobody gets an error, and admins never notice.
 *
 * ====================== `/content/audit-logs` IS WRITABLE ======================
 * PRESERVED FINDING, and the reason a key must never be removed from — or added
 * to — the `models` whitelist without reading this first. `getModel` is used by
 * `createAdminContent`, `updateAdminContent` and `deleteAdminContent` as well as
 * by the reader, so `/api/v1/admin/content/audit-logs` supports POST, PATCH and
 * DELETE AGAINST THE AUDIT TRAIL ITSELF. An admin can therefore forge or erase
 * audit entries. It is preserved because narrowing the whitelist changes which
 * endpoints exist — a security and product decision, not a porting one — but it
 * is recorded here, at the route that exposes it, so nobody mistakes it for
 * intent.
 *
 * `users` and `roles` are, by contrast, ABSENT from the whitelist: they are a
 * 404, not a member list or a role list. Member management lives in
 * `admin.controller.js` with its own per-field allowlist, and this generic path is
 * deliberately not a second way in.
 *
 * ============ `updateAdminContent`'s UNFILTERED `$set` — PRESERVED DEFECT ============
 * Ten of the eleven collections reachable from THIS file's sibling
 * (`content/[resource]/[id]`) are updated with `{ $set: req.body }` — the
 * caller's body becomes the update verbatim, with no allowlist at all. Only
 * `profiles` has a hand-written allowlist. A caller who reaches that endpoint can
 * therefore set any other field the schema defines on that collection, including
 * internal ones; it is bounded only by `getModel`, by the role matrix above, and
 * by `runValidators: true` rejecting values the schema forbids. Preserved, not
 * hardened — see the sibling file for the full note, and note that the whitelist
 * alone is not a defence against a body the caller controls.
 *
 * ============== TWO DIFFERENT THINGS NAMED "contributors" ==============
 * This file also serves `/api/v1/admin/content/contributors`, which is the MONGO
 * collection `models.contributors -> Contributor` reached through the generic
 * whitelist above — fully readable AND writable here.
 * `/api/v1/admin/contributors` is a DIFFERENT resource with a DIFFERENT backing
 * store: the GitHub Contents API against
 * `cpccu/cpccu-client@release:data/contributors.json`, with no Mongo involvement
 * at all. They are separate because the site is DEPLOYED FROM THAT FILE — a daily
 * GitHub Action regenerates it from git history, so a database-backed list would
 * be a second, conflicting source of truth. Do not conflate the two, and do not
 * "unify" them.
 *
 * SEGMENT DISJOINTNESS: two segments below the mount, first segment STATIC
 * (`content`). So it is disjoint from the one-segment `contributors`,
 * `statistics`, `roles`, `members`, `certificates` and `system-settings` files,
 * and from `roles/[id]` and `roles/active`, by depth or first segment; the only
 * three-segment path under the mount is this file's own `[id]` sibling, which
 * cannot serve a two-segment URL. No catch-all exists under
 * `src/app/api/v1/admin/`.
 */

// `nodejs` because these routes reach `mongoose`, which is not Edge-compatible.
// `force-dynamic` because they read the auth cookie and the database, and must
// never be prerendered or cached.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = defineRoute({
  method: 'GET',
  admin: true,
  controller: listAdminContent,
});

export const POST = defineRoute({
  method: 'POST',
  admin: true,
  controller: createAdminContent,
});
