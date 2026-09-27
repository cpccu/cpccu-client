import { deleteCommentHandler } from '@/lib/server/controllers/comment.controller';
import { defineRoute } from '@/lib/server/handler';

/**
 * `DELETE /api/v1/comments/delete-comment/:commentID` — delete your own comment.
 *
 * AUTHENTICATED (`public` absent). Same ownership gate as the update path —
 * author only, no moderator exception — and the SAME 403 MESSAGE ('edit this
 * comment'), which is wrong for a delete but is a string the client may key off,
 * so it is not "corrected" here.
 *
 * The success message is the lower-case 'comment deleted successfully' where
 * every other handler capitalises it. That is on the wire and therefore preserved.
 *
 * The `commentID` is a path segment, supplied by the bridge as
 * `params: routeContext.params` and validated as an ObjectId inside the handler.
 */

// `nodejs` because this route reaches `mongoose` and `jsonwebtoken`, neither of
// which is Edge-compatible. `force-dynamic` because it reads the auth cookie and
// a dynamic segment, and must never be prerendered or cached.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const DELETE = defineRoute('DELETE', {
  controller: deleteCommentHandler,
});
