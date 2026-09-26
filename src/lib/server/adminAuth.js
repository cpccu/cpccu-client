import 'server-only';

import { ApiError } from '@/lib/server/errors';

const adminRoles = ['admin', 'moderator', 'mentor'];
const moderatorResources = ['events', 'gallery', 'posts', 'gallery-events'];

/** Mentors may only READ these admin sections, and only on a genuine prefix match. */
const mentorReadPaths = [
  '/overview',
  '/members',
  '/certificates',
  '/statistics',
];

/**
 * The exact path — RELATIVE to the `/api/v1/admin` mount — that content images
 * are uploaded to. Compared with `===` (EXACT match), not `startsWith`; the
 * asymmetry with the mentor prefix test is load-bearing, see below.
 */
const ADMIN_UPLOAD_PATH = '/uploads/image';

/**
 * Port of the `requireAdmin` half of
 * `cpccu-server/src/middlewares/admin.middleware.js`.
 *
 * Business rule: a principal counts as "admin" for panel purposes only if their
 * role is one of admin / moderator / mentor.
 *
 * NOTE the deliberate asymmetry: `member` is REJECTED here, even though
 * `controllers/admin.controller.js:13` allows `member` as a value that may be
 * ASSIGNED during role management. Being a role an admin may grant is not the
 * same as being a role that grants panel access. Do not "fix" this by adding
 * `member` to `adminRoles` — that would hand every ordinary member read access
 * to the whole admin panel.
 */
function requireAdmin(user) {
  if (!adminRoles.includes(user?.roles?.role)) {
    throw new ApiError(403, 'Admin access is required');
  }
  return user;
}

/**
 * Port of the `authorizeAdminAction` half of
 * `cpccu-server/src/middlewares/admin.middleware.js:14-44`.
 *
 * The Express version read its routing context off `req`:
 *
 *     const resource        = req.path.split('/')[2];
 *     const isAllowedUpload = req.path === '/uploads/image';
 *     const isAllowedContent =
 *       req.path.startsWith('/content/') && moderatorResources.includes(resource);
 *     const isReadOnly      = req.method === 'GET';
 *
 * and for mentors:
 *
 *     mentorReadPaths.some((p) => req.path.startsWith(p))
 *
 * Every one of those reads `req.path`, which inside a MOUNTED Express router is
 * RELATIVE to the mount point rather than the full URL. Mounted at
 * `/api/v1/admin`, a request for `/api/v1/admin/content/events` presents
 * `req.path === '/content/events'`, so `'/content/events'.split('/')` is
 * `['', 'content', 'events']` and index 2 is the RESOURCE.
 *
 * That index is an artefact of Express's mount-relative path handling and has NO
 * equivalent in the App Router, where `request.nextUrl.pathname` is always the
 * ABSOLUTE path: `/api/v1/admin/content/events`.split('/')` is
 * `['', 'api', 'v1', 'admin', 'content', 'events']`, whose index 2 is `'v1'`.
 *
 * A NAIVE PORT IS A SILENT AUTHORISATION FAILURE IN BOTH DIRECTIONS:
 *  - copied as-is, `resource === 'v1'`, which is in no allowlist, so every
 *    moderator write to posts / events / gallery is DENIED with a bare 403 and
 *    no server-side error — the moderator simply cannot publish;
 *  - "corrected" by using the last segment, or by inverting the index, the same
 *    code SILENTLY GRANTS moderators write access to resources they are not
 *    meant to control.
 * Neither variant throws, so neither shows up in a test that only checks the
 * happy path. That is why the mount-relative `path` is derived ONCE, inside
 * `describeAdminRoute`, and why a route author never supplies it: a route author
 * who has to state `resource` by hand can state it WRONG in a way that only ever
 * GRANTS.
 *
 * Two further details that are easy to lose in translation, both preserved:
 *  - Only the LITERAL string `'GET'` counts as a read. `HEAD` is DENIED, because
 *    `req.method === 'GET'` is an equality test, not an idempotent-method check.
 *    Do not "improve" this to `['GET', 'HEAD'].includes(method)`.
 *  - The upload check is an EXACT string match while the mentor paths are real
 *    PREFIX matches. `/uploads/image` must NOT match `/uploads/image-2`, whereas
 *    `/statistics` intentionally also covers `/statistics/2024`.
 *
 * STALE COMMENT IN THE SOURCE: `cpccu-server/src/routes/admin.route.js:76` says
 * that `/contributors` is "readable by any admin-role user" and that mentors can
 * read it. The CODE denies mentors: `contributors` is not in `mentorReadPaths`,
 * so a mentor GET falls through to the 403. The comment is wrong and the code is
 * authoritative — do not add `contributors` to `mentorReadPaths` "to match the
 * comment" as part of this port.
 *
 * EXPORTED FOR `requireAdminAction` AND FOR TESTS ONLY — and, for external
 * callers, DEPRECATED: see the `@deprecated` tag. Its arguments are PRE-DERIVED
 * values, so calling it directly means re-supplying by hand the very routing
 * context whose derivation is the failure mode described above. Route handlers
 * call `requireAdminAction(user, { method, pathname })`; tests that need to drive
 * a single role/method/path combination without a user document call
 * `authorizeAdminPath({ role, method, pathname })`.
 *
 * @param role      the principal's role, i.e. `user.roles.role`
 * @param method    the HTTP method, upper-case, e.g. `'GET'`
 * @param resource  the `:resource` dynamic segment for content routes, else null
 * @param isUpload  true only for the exact `/uploads/image` route
 * @param path      the MOUNT-RELATIVE path (what Express `req.path` was), used
 *                  for the moderator `content/` prefix test and the mentor prefix
 *                  test. Always derived by `describeAdminRoute`.
 * @deprecated EXTERNAL USE ONLY. `resource` and `isUpload` are caller-supplied
 *   and DERIVABLE from the path, which is precisely the fail-open direction: a
 *   route author who computes `pathname` correctly but hardcodes
 *   `resource: 'events'` on a `/content/gallery` route GRANTS a moderator a
 *   write they should not have, and nothing in the signature flags it. Use
 *   `requireAdminAction(user, { method, pathname })` from a route handler, or
 *   `authorizeAdminPath({ role, method, pathname })` in a test. This stays
 *   exported only because `requireAdminAction` and those tests use it, and
 *   because it is a faithful 1:1 port of the Express middleware.
 */
function authorizeAdminAction({
  role,
  method,
  resource = null,
  isUpload = false,
  path = '/',
}) {
  if (role === 'admin') return true;

  if (role === 'moderator') {
    const isAllowedContent =
      path.startsWith('/content/') && moderatorResources.includes(resource);
    const isReadOnly = method === 'GET';

    if (isUpload || isAllowedContent || isReadOnly) return true;
  }

  if (role === 'mentor') {
    const isAllowedRead =
      method === 'GET' &&
      mentorReadPaths.some((prefix) => path.startsWith(prefix));

    if (isAllowedRead) return true;
  }

  throw new ApiError(403, 'You do not have permission for this admin action');
}

/**
 * Combined guard for an admin action: runs `requireAdmin` and then
 * `authorizeAdminAction`, so a route cannot be wired up with only one half.
 *
 * This matters because in the Express version the two were separate middlewares
 * applied per-route, and a route that registered only `requireAdmin` granted
 * every admin-role principal full access to that endpoint — `requireAdmin` alone
 * is only a role check and performs NO per-action authorisation.
 *
 * THE ROUTING CONTEXT IS DERIVED, NOT SUPPLIED. The signature takes only `method`
 * and `pathname`; `resource`, `isUpload` and the mount-relative `path` all come
 * from `describeAdminRoute(pathname)`. `resource` in particular is DERIVABLE from
 * the path, and an earlier version of this file took it — along with `isUpload`
 * — as independent caller-supplied arguments. That is a fail-OPEN footgun in a
 * function whose every other failure mode fails closed: a route author who
 * computes `pathname` correctly but hardcodes `resource: 'events'` on a
 * `/content/gallery` route (a copy-paste slip, not an attack) GRANTS a moderator
 * write access they should not have, and nothing in the signature or the
 * surrounding code flags it. There is no way to supply a wrong `resource` now,
 * because there is no way to supply one.
 *
 * @param user the authenticated document (from `verifyToken`)
 * @param ctx  `{ method, pathname }` — the raw request facts and nothing else
 * @returns the same `user`, so the call can be used inline
 */
function requireAdminAction(user, { method, pathname } = {}) {
  requireAdmin(user);
  authorizeAdminPath({ role: user?.roles?.role, method, pathname });
  return user;
}

/**
 * PATH-ONLY VARIANT OF `authorizeAdminAction` — the shape a test should use.
 *
 * It takes the raw request facts, derives the routing context internally through
 * `describeAdminRoute`, and then calls the pre-derived helper. So the ONLY
 * difference from `requireAdminAction` is that it takes a `role` instead of a
 * `user` document (a test wants to exercise the role matrix without standing up
 * a Mongoose user), and the only difference from `authorizeAdminAction` is that
 * its caller cannot supply `resource`, `isUpload` or the mount-relative `path`.
 *
 * THAT LAST POINT IS THE WHOLE REASON THIS EXISTS. `authorizeAdminAction`
 * re-supplies by hand the exact context whose derivation was the fail-open bug
 * documented above: every one of its arguments except `role` and `method` is
 * derivable, and a derivable argument that the caller may also override is an
 * argument that will eventually be overridden wrongly. A test that builds the
 * context itself can therefore assert the WRONG thing and pass — the test would
 * be pinning the bug, not the behaviour. This function makes that impossible.
 *
 * @param role      the principal's role, i.e. `user.roles.role`
 * @param method    the HTTP method, upper-case
 * @param pathname  the ABSOLUTE request pathname, e.g. `/api/v1/admin/content/events`
 * @throws {ApiError} 403 when the role may not perform this action
 */
function authorizeAdminPath({ role, method, pathname }) {
  const { path, resource, isUpload } = describeAdminRoute(pathname);

  // `role` is spread LAST so the derive-from-path values are never overridable
  // by a caller. Order here is not cosmetic: it is the only thing stopping a
  // future edit from re-introducing a caller-supplied `resource`.
  authorizeAdminAction({
    path,
    resource,
    isUpload,
    method,
    role,
  });
}

/**
 * Computes the mount-relative routing context that the Express middleware used
 * to read off `req.path`, for an App Router pathname.
 *
 * Strips the mount prefix so the result is directly comparable with
 * `ADMIN_UPLOAD_PATH`, with the `content/` prefix and with `mentorReadPaths`.
 * `mountPrefix` is an argument (not hard-coded) so that if the admin routes are
 * ever mounted somewhere else the derivation still lines up with the allowlists.
 *
 * THE PREFIX IS MATCHED ON A SEGMENT BOUNDARY, NOT WITH A BARE `startsWith`.
 * `/api/v1/administrator/…` also starts with the string `/api/v1/admin`, so a
 * bare prefix test strips it to `istrator/…` and hands that to the allowlists.
 * That FAILS CLOSED today (`'istrator/…'` matches nothing, so the request is
 * denied), which is why the bug is easy to miss — but the two tests below are
 * deliberately asymmetric (`isUpload` is an exact `===`, the mentor paths are
 * prefixes), and a bare `startsWith` here makes it look as though the prefix
 * strip were equally sloppy, inviting a future "cleanup" that reintroduces the
 * fail-open variant. KEEP THE BOUNDARY CHECK: `pathname === mountPrefix` covers
 * the admin root, `pathname.startsWith(mountPrefix + '/')` covers everything
 * genuinely mounted underneath it, and nothing else.
 */
function describeAdminRoute(pathname, mountPrefix = '/api/v1/admin') {
  const relative =
    pathname === mountPrefix || pathname.startsWith(`${mountPrefix}/`)
      ? pathname.slice(mountPrefix.length) || '/'
      : pathname;

  const segments = relative.split('/').filter(Boolean);

  return {
    path: relative,
    // `/content/:resource` and `/content/:resource/:id` are the only routes whose
    // path carries a collection segment; every other admin route has none.
    resource:
      segments[0] === 'content' && segments.length > 1 ? segments[1] : null,
    isUpload: relative === ADMIN_UPLOAD_PATH,
  };
}

export {
  ADMIN_UPLOAD_PATH,
  adminRoles,
  authorizeAdminAction,
  authorizeAdminPath,
  describeAdminRoute,
  mentorReadPaths,
  moderatorResources,
  requireAdmin,
  requireAdminAction,
};
