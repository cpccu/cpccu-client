import {
  deleteAdminMember,
  updateAdminMember,
} from '@/lib/server/controllers/admin.controller';
import { defineRoute } from '@/lib/server/handler';

/**
 * `PATCH|DELETE /api/v1/admin/members/:id` — edit or remove one member. Two
 * methods, one file.
 *
 * `admin: true` is the per-file replacement for the Express
 * `router.use(verifyToken, requireAdmin, authorizeAdminAction)`
 * (`admin.route.js:41`); the full chain note is in
 * `src/app/api/v1/admin/roles/route.js`. Omitting it does not make the route
 * public — auth is the default — but it removes every per-action check, so any
 * authenticated member could un-verify, re-role or DELETE any account, including
 * an administrator's. That is the sharpest consequence of a forgotten flag
 * anywhere in this router. `adminAuth.js` fails closed, so the omission is the
 * recoverable direction.
 *
 * DERIVATION: `describeAdminRoute('/api/v1/admin/members/<id>')` gives
 * `path === '/members/<id>'`, `resource === null`, `isUpload === false`. Both
 * verbs are ADMIN-ONLY: a moderator fails `isReadOnly` (neither is a `GET`), and
 * a mentor fails both the method test and the `mentorReadPaths` prefix test
 * (`/members` IS in that list, so for a mentor it is the METHOD that denies, not
 * the path — worth knowing, because it means the prefix list alone is not a
 * mentor write guard and must never be relied on as one).
 *
 * AUTHORISING THE ACTION IS NOT AUTHORISING THE TARGET. `authorizeAdminAction`
 * says "an admin may edit a member"; it says nothing about WHICH member. The
 * two self-targeting rules in the controller are what bound the target, and they
 * are business rules rather than security controls — see `admin.controller.js`:
 *  - an admin cannot un-verify themselves or demote their own role, which would
 *    otherwise lock the whole panel out with nobody able to undo it;
 *  - an admin cannot delete their own account through this endpoint.
 * Neither is a full last-admin guard: two admins demoting each other in sequence
 * can still leave the panel with no administrator. Preserved as-is.
 *
 * The write payload is hand-assembled FIELD BY FIELD in the controller rather
 * than spread from `req.body`, precisely because this endpoint writes the ban
 * flag and the privilege level — a spread would let a caller set
 * `refreshTokens`, `googleID` or `password` through a panel that has no such
 * control. Nothing about that allowlist lives in this file, and nothing should
 * be added here that reintroduces a spread.
 *
 * SEGMENT DISJOINTNESS: one dynamic segment below a static `members`, so it is
 * disjoint from the one-segment `members` file by depth, from `roles/[id]` and
 * `certificates/[id]` by first segment, and from the three-segment
 * `content/[resource]/[id]` by depth. No catch-all exists anywhere under
 * `src/app/api/v1/admin/`, so no route here can be reached by a path the others
 * would also match.
 */

// `nodejs` because these routes reach `mongoose` and `bcryptjs`, neither of
// which is Edge-compatible. `force-dynamic` because they read the auth cookie
// and the database, and must never be prerendered or cached.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const PATCH = defineRoute({
  method: 'PATCH',
  admin: true,
  controller: updateAdminMember,
});

export const DELETE = defineRoute({
  method: 'DELETE',
  admin: true,
  controller: deleteAdminMember,
});
