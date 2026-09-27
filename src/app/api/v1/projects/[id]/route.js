import {
  deleteProject,
  updateProject,
} from '@/lib/server/controllers/project.controller';
import { defineRoute } from '@/lib/server/handler';

/**
 * `/api/v1/projects/:id` — edit or delete ONE OF THE CALLER'S OWN projects.
 * Two methods, one file.
 *
 * App Router supports MULTIPLE METHOD EXPORTS PER FILE, mirroring the Express
 * original: `router.route('/:id').patch(updateProject).delete(deleteProject)`.
 *
 * ============================ WHY THIS IS NOT A PUBLIC LEAK ============================
 * THIS IS THE DYNAMIC SIBLING OF THE PUBLIC ROUTE, and the pairing is the
 * highest-risk routing decision in the migration, so the reasoning is stated in
 * full. `/api/v1/projects/user/<id>` is ANONYMOUS (see
 * `src/app/api/v1/projects/user/[userId]/route.js`); everything reaching THIS
 * file is AUTHENTICATED.
 *
 * THEY ARE DISJOINT BY DEPTH, verified against the generated paths:
 *   this file           → /api/v1/projects/<id>          (4 segments)
 *   the public sibling  → /api/v1/projects/user/<userId> (5 segments)
 * Four is not five, so NO request can match both. Every concrete case:
 *   /api/v1/projects/abc       → this file, id='abc'.                AUTHENTICATED.
 *   /api/v1/projects/user/abc  → the public sibling, 5 segments.     ANONYMOUS (correct).
 *   /api/v1/projects/user      → this file, id='user'.              AUTHENTICATED, then a
 *                                 bad-id failure inside the controller — the safe
 *                                 direction, because it cannot be reached anonymously.
 *   /api/v1/projects/user/a/b  → 6 segments. Matches nothing. 404.
 *
 * App Router ALSO resolves the literal `user` as a static segment ahead of any
 * dynamic one, which removes the same-depth ambiguity; the depth difference
 * already suffices, and no catch-all (`[...path]`) is used anywhere in this
 * router precisely because a catch-all would need a hand-written `user`
 * special-case, and omitting it would publicly expose every user's projects.
 *
 * `public` IS ABSENT, so both verbs require a valid access (or refreshable)
 * token. The controllers additionally scope every query to `req.user._id` and
 * 404 when the document is not the caller's, so there is no cross-user write
 * path even for a valid id.
 *
 * The `id` is a path segment, supplied by the bridge as
 * `params: routeContext.params` so the controller's `req.params.id` read works.
 */

// `nodejs` because these routes reach `mongoose` and `jsonwebtoken`, neither of
// which is Edge-compatible. `force-dynamic` because both read the auth cookie and
// a dynamic segment, and must never be prerendered or cached.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const PATCH = defineRoute('PATCH', {
  controller: updateProject,
});

export const DELETE = defineRoute('DELETE', {
  controller: deleteProject,
});
