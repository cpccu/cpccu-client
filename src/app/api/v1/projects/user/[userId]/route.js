import { getPublicProjects } from '@/lib/server/controllers/project.controller';
import { defineRoute } from '@/lib/server/handler';

/**
 * `GET /api/v1/projects/user/:userId` — a member's PUBLIC project portfolio.
 *
 * ====================== THE HIGHEST-RISK ROUTING TRAP IN THE MIGRATION ======================
 * In the Express source this route is registered BEFORE the `router.use(verifyToken)`
 * gate, and everything below that gate is authenticated:
 *
 *     router.route('/user/:userId').get(getPublicProjects);   // ← PUBLIC, above the gate
 *     router.use(verifyToken);                               // ← everything below is gated
 *     router.route('/').get(getProjects).post(createProject);
 *     router.route('/:id').patch(updateProject).delete(deleteProject);
 *
 * So the original's public/protected split is a PROPERTY OF REGISTRATION ORDER
 * WITHIN ONE ROUTER, not a property of the URL. App Router has no equivalent
 * concept: authorisation is per-file, declared by `public`, and URL matching is
 * resolved by the filesystem. Both halves of that have to be re-established by
 * hand, and getting the routing half wrong is a DATA DISCLOSURE, not a 404.
 *
 * ---------------------------------------------------------------------------------
 * PROOF THAT `projects/user/[userId]` AND `projects/[id]` ARE DISJOINT — checked
 * against the actual generated paths rather than assumed:
 *
 *   /api/v1/projects/[id]          → segments: api, v1, projects, <id>          (4)
 *   /api/v1/projects/user/[userId] → segments: api, v1, projects, user, <userId> (5)
 *
 * THE DEPTHS DIFFER (4 vs 5), SO NO SINGLE REQUEST CAN MATCH BOTH. That is the
 * primary, sufficient guarantee, and it does not depend on segment ORDER at all.
 * Concretely, for every possible request:
 *
 *   /api/v1/projects/abc
 *       → 4 segments. `projects/[id]` matches with id='abc'. The
 *         `user/[userId]` route needs 5 and is not even a candidate. → AUTH.
 *
 *   /api/v1/projects/user/abc
 *       → 5 segments. `projects/[id]` is 4 deep and cannot match.
 *         `projects/user/[userId]` matches with userId='abc'. → PUBLIC.
 *
 *   /api/v1/projects/user
 *       → 4 segments. `projects/[id]` matches with id='user'! `projects/user/
 *         [userId]` needs 5. So this URL is AUTHENTICATED and would look up a
 *         project whose id is the literal string 'user' — a 404/cast error from
 *         the controller, not a public read. In the Express original the same
 *         URL matched `/user/:userId`… no: `:userId` is required, so
 *         `/projects/user` matched NEITHER route and 404'd. The difference is
 *         that here it fails INSIDE an authenticated route, which is the safe
 *         direction — it cannot be reached anonymously.
 *
 *   /api/v1/projects/user/abc/extra
 *       → 6 segments. Matches nothing, 404. Neither route is deeper than 5.
 *
 * SECONDARY, AND NOT RELIED ON: App Router also resolves static segments before
 * dynamic ones, so the literal `user` in the public path is matched as a static
 * segment rather than being captured by `[id]`. The depth argument above already
 * makes this redundant for THIS pair; the static-first rule is stated because it
 * is what removes the ambiguity for any pair at the SAME depth, and because it is
 * the property that would start to matter if these paths were ever flattened to
 * one level.
 *
 * ---------------------------------------------------------------------------------
 * THE CATCH-ALL WARNING, WHICH IS WHY THERE IS NO `[...path]` ANYWHERE HERE.
 * The two routes could have been expressed as `projects/[...path]/route.js` with
 * the `user` segment unwrapped by hand. That version would be publicly reachable
 * for ANY `/projects/<anything>` unless the handler special-cased the literal
 * string `'user'`, and forgetting that case is the single most likely way to
 * publicly expose every user's projects. The filesystem tree makes the
 * distinction structural instead of conditional, which is why it is used.
 *
 * `public: true` is therefore CORRECT and SAFE here, and only here: this file is
 * one segment deeper than the authenticated `[id]` route, so the public surface
 * is exactly `/projects/user/<id>` and nothing else.
 *
 * `userId` is a path segment, supplied by the bridge as
 * `params: routeContext.params`. There is NO `isValidIdentity` check on it in the
 * controller, unlike almost every other handler — a malformed id simply matches
 * no `userId` and renders as an empty portfolio. That is preserved.
 */

// `nodejs` because this route reaches `mongoose`, which is not Edge-compatible.
// `force-dynamic` because it reads the database per request and must never be
// prerendered into a static portfolio at build time.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = defineRoute('GET', {
  public: true,
  controller: getPublicProjects,
});
