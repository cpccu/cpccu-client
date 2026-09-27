import { getActiveRoles } from '@/lib/server/controllers/adminRole.controller';
import { defineRoute } from '@/lib/server/handler';

/**
 * `GET /api/v1/admin/roles/active` — only the ENABLED positions, i.e. the
 * dropdown the admin member form offers.
 *
 * ============================================================================
 * WHY THIS STATIC FILE EXISTS INSTEAD OF `roles/[id]` HANDLING `active`
 * ============================================================================
 * The sibling `src/app/api/v1/admin/roles/[id]/route.js` is a DYNAMIC segment at
 * the same depth, and App Router resolves STATIC SEGMENTS BEFORE DYNAMIC ONES.
 * So `/api/v1/admin/roles/active` is served by THIS file and never reaches
 * `[id]` with `id === 'active'`. Without this file, `getAdminRoles` would be
 * reached for the string `"active"` — the manager's full catalogue instead of
 * the enabled-only list — and `PATCH /admin/roles/active` would update whatever
 * 24-character ObjectId happened to be spelled `active` (it would 404, but as a
 * CastError-driven 500 rather than the honest 404 the other ids produce).
 *
 * This is the SAME shadowing the Express original relied on, where
 * `/roles/active` was registered before `/roles/:id` (`admin.route.js:45-46`).
 *
 * ONE OBSERVABLE DIFFERENCE, AND IT IS IN THE SAFE DIRECTION: the Express router
 * has NO handler for `PATCH /admin/roles/active`, so it answered 404. Here the
 * path RESOLVES to this file (static wins) and this file exports only `GET`, so
 * Next answers **405 Method Not Allowed**. The method is still refused and
 * `roles/[id]` is still not reached, so `updateAdminRole` cannot be invoked with
 * a non-ObjectId id — which is the property that matters. The status code
 * differs; no caller depends on 404 here (the panel never sends it). NOTE the
 * level of verification: the static-over-dynamic PRECEDENCE that produces this is
 * Next's documented routing order and is what the sibling files rely on, but the
 * 405 itself was not observed at runtime during this migration (no `next build`
 * or dev server was run) — it is recorded as the expected behaviour, and the
 * property that actually matters (the write is refused either way) does not
 * depend on which of 404/405 comes back.
 *
 * `admin: true` is the per-file replacement for the Express
 * `router.use(verifyToken, requireAdmin, authorizeAdminAction)` at
 * `admin.route.js:41`; see the full note in
 * `src/app/api/v1/admin/roles/route.js`. A route that forgets it is not public,
 * but it performs no per-action authorisation and is silently reachable by any
 * authenticated member. `adminAuth.js` fails closed, which is what makes that
 * omission recoverable.
 *
 * DERIVATION: `describeAdminRoute('/api/v1/admin/roles/active')` gives
 * `path === '/roles/active'`, `resource === null`, `isUpload === false`.
 * `admin` → allow (returns true before anything is consulted); `moderator` →
 * allow, but ONLY because this is a `GET` (`isReadOnly`); `mentor` → DENY,
 * because `mentorReadPaths` is `['/overview', '/members', '/certificates',
 * '/statistics']` and `/roles` is none of them. The GET is additionally
 * MODERATE-DENY-BY-PREFIX only for a mentor, so the role list of a club is not
 * something a mentor can read.
 *
 * PRESERVED: like `getAdminRoles`, this handler calls `seedDefaultRoles()`
 * first, so a GET performs ten upsert writes. Original behaviour, unchanged by
 * the migration — but it is why nothing here may be cached.
 */

// `nodejs` because this route reaches `mongoose`, which is not Edge-compatible.
// `force-dynamic` because it reads the auth cookie and the database, and because
// this GET performs writes.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = defineRoute({
  method: 'GET',
  admin: true,
  controller: getActiveRoles,
});
