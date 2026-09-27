import { changePassword } from '@/lib/server/controllers/user.controller';
import { defineRoute } from '@/lib/server/handler';

/**
 * `PATCH /api/v1/users/password` — change the caller's own password.
 *
 * AUTHENTICATED (`public` absent). The current password is verified inside the
 * handler against the stored bcrypt hash, so an access token alone is not enough
 * to take over the account — the classic defence against a stolen session being
 * escalated into a permanent one.
 *
 * On success every OTHER live refresh token is revoked, which is the server-side
 * half of "changing your password logs out your other devices".
 */

// `nodejs` because this route reaches `mongoose`, `bcryptjs` and
// `jsonwebtoken`, none of which are Edge-compatible. `force-dynamic` because it
// reads the auth cookie and the request body, and must never be prerendered.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const PATCH = defineRoute('PATCH', {
  controller: changePassword,
});
