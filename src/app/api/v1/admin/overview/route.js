import { getAdminOverview } from '@/lib/server/controllers/admin.controller';
import { defineRoute } from '@/lib/server/handler';

/**
 * `GET /api/v1/admin/overview` — the admin dashboard's ten counters, in one round
 * trip (`Promise.all` inside the controller, so it is one latency rather than
 * ten serialised ones).
 *
 * `admin: true` is the per-file replacement for the Express
 * `router.use(verifyToken, requireAdmin, authorizeAdminAction)`
 * (`admin.route.js:41`); the full chain note is in
 * `src/app/api/v1/admin/roles/route.js`. A route that forgets the flag is not
 * public — auth is the default — but it loses every per-action check, so any
 * authenticated member could read the dashboard. `adminAuth.js` fails closed,
 * which is what keeps that omission the recoverable direction.
 *
 * DERIVATION: `describeAdminRoute('/api/v1/admin/overview')` gives
 * `path === '/overview'`, `resource === null`, `isUpload === false`. `/overview`
 * is the FIRST entry in `mentorReadPaths`, and it is a real prefix match, so
 * `GET` is allowed for all THREE panel roles:
 *   - `admin`     → allow (unconditional, before anything else is consulted)
 *   - `moderator` → allow via `isReadOnly`
 *   - `mentor`    → allow via `method === 'GET'` AND the `/overview` prefix
 * `member` and anonymous are stopped earlier in the chain: anonymous by
 * `verifyToken` (401), `member` by `requireAdmin` (403 "Admin access is
 * required"), because `member` is a role an admin may GRANT but not one that
 * grants panel access.
 *
 * This is a PURE READ — the one admin endpoint that performs no writes, and the
 * cheapest one to use as a role-matrix probe, which is why the verification
 * harness drives this path for `mentor` and the roles endpoints for `moderator`.
 *
 * SEGMENT DISJOINTNESS: one segment below the mount, static, and the only
 * one-segment path that is not `[id]`-shaped. `roles`, `members`,
 * `certificates`, `statistics` and `system-settings` are the other one-segment
 * static paths; `roles/active` is two, `roles/[id]` two, `content/[resource]`
 * two, `contributors` one, and `content/[resource]/[id]` three. No two of these
 * can match the same URL, and no catch-all exists under
 * `src/app/api/v1/admin/` to blur that.
 */

// `nodejs` because this route reaches `mongoose`, which is not Edge-compatible.
// `force-dynamic` because it reads the auth cookie and the database, and must
// never be prerendered into a static dashboard payload at build time.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = defineRoute({
  method: 'GET',
  admin: true,
  controller: getAdminOverview,
});
