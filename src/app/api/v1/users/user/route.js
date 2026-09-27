import {
  deleteOwnAccount,
  getUserInfo,
} from '@/lib/server/controllers/user.controller';
import { defineRoute } from '@/lib/server/handler';

/**
 * `/api/v1/users/user` — the caller's OWN account. Two methods, one file.
 *
 * App Router supports MULTIPLE METHOD EXPORTS PER FILE, and this file uses that
 * to mirror the Express original, where `user.route.js` mounted `/user` twice:
 *
 *     router.route('/user').get(verifyToken, getUserInfo)
 *     router.route('/user').delete(verifyToken, deleteOwnAccount)
 *
 * One Express router file per mount became one App Router file per PATH, with
 * one export per METHOD. The split by method rather than by path is the only
 * difference, and it is not a change of contract: the URLs, verbs, auth
 * requirement and handlers are identical.
 *
 * BOTH ARE AUTHENTICATED — `public` is simply ABSENT, which is the lock. The
 * Express chain said `verifyToken` in both cases; here the absence of
 * `public: true` says the same thing, and it cannot be forgotten by accident.
 *
 * `DELETE` DELETES THE CALLER'S OWN ACCOUNT ONLY. It takes no id: the subject is
 * `req.user._id`, taken from the verified token and never from the body, so
 * there is no impersonation path.
 */

// `nodejs` because these routes reach `mongoose`, `bcryptjs` and
// `jsonwebtoken`, none of which are Edge-compatible. `force-dynamic` because
// both handlers read the `accessToken` cookie and the user document, and must
// never be prerendered or cached.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = defineRoute({
  method: 'GET',
  controller: getUserInfo,
});

export const DELETE = defineRoute({
  method: 'DELETE',
  controller: deleteOwnAccount,
});
