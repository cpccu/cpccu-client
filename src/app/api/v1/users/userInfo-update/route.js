import { updateUserInfo } from '@/lib/server/controllers/user.controller';
import { defineRoute } from '@/lib/server/handler';

/**
 * `PATCH /api/v1/users/userInfo-update` — update the caller's own profile fields.
 *
 * AUTHENTICATED (`public` is absent, which is the lock). The Express original
 * listed `verifyToken` in the chain; here the absence of `public: true` is the
 * equivalent and cannot be forgotten silently.
 *
 * The controller writes only the fields it names and takes the subject from
 * `req.user._id`, so there is no mass-assignment or impersonation path — which is
 * the opposite of `POST /contact/messages`, and worth stating because the two
 * are easy to confuse.
 *
 * `userInfo-update` is a STATIC segment at this level, so it is matched
 * literally. It is not in conflict with `user/[id]` — that lives one level
 * deeper, under `user/`, so `/users/userInfo-update` has two segments after
 * `/users` and `/users/user/<id>` has three.
 */

// `nodejs` because this route reaches `mongoose` and `jsonwebtoken`, neither of
// which is Edge-compatible. `force-dynamic` because it reads the auth cookie and
// the request body, and must never be prerendered.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const PATCH = defineRoute({
  method: 'PATCH',
  controller: updateUserInfo,
});
