import {
  createProject,
  getProjects,
} from '@/lib/server/controllers/project.controller';
import { defineRoute } from '@/lib/server/handler';

/**
 * `/api/v1/projects` — the caller's OWN project list, and project creation.
 * Two methods, one file.
 *
 * App Router supports MULTIPLE METHOD EXPORTS PER FILE, mirroring the Express
 * original, where one mounted router served both verbs:
 *
 *     router.route('/').get(getProjects).post(createProject)
 *
 * One router file per mount became one App Router file per PATH with one export
 * per METHOD. URLs, verbs, auth requirement and handlers are unchanged.
 *
 * BOTH ARE AUTHENTICATED (`public` absent), which in Express was expressed by
 * `router.use(verifyToken)` sitting ABOVE this route. In App Router that gate
 * does not exist as a concept, so it is re-established per file by the ABSENCE
 * of `public: true` — see the depth argument in
 * `src/app/api/v1/projects/user/[userId]/route.js` for why the public
 * `/projects/user/<id>` route is one segment deeper and therefore cannot reach
 * this file.
 *
 * `getProjects` SCOPES EVERY QUERY TO `req.user._id`, so a member can only ever
 * read their own projects; `createProject` takes the owner from the session and
 * never from the body, so there is no impersonation path.
 *
 * This URL is `/api/v1/projects` with NO trailing segment. That is safe against
 * the sibling `[id]` route precisely because App Router does not treat a
 * directory and its index as interchangeable: a request for the bare path
 * matches this file's exports, and `/projects/<id>` matches `[id]`.
 */

// `nodejs` because these routes reach `mongoose` and `jsonwebtoken`, neither of
// which is Edge-compatible. `force-dynamic` because both read the auth cookie and
// the database, and must never be prerendered or cached.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = defineRoute({
  method: 'GET',
  controller: getProjects,
});

export const POST = defineRoute({
  method: 'POST',
  controller: createProject,
});
