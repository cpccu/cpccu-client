import { createCommentHandler } from '@/lib/server/controllers/comment.controller';
import { defineRoute } from '@/lib/server/handler';

/**
 * `POST /api/v1/comments/create-comment/:postID` — comment on a post.
 *
 * AUTHENTICATED (`public` absent). TWO SUBJECT RULES, and both matter:
 *  - `commenter` IS TAKEN FROM `req.user._id` AND NEVER FROM THE BODY. A caller
 *    cannot post as someone else;
 *  - there is NO CHECK THAT THE POST EXISTS, and no non-empty check on the
 *    comment text. A comment can therefore be attached to an ObjectId that
 *    matches nothing, and only the schema will reject a missing `comment`, at
 *    save time. Preserved verbatim: the original behaves identically, and adding
 *    a post lookup is an extra round trip on a hot path.
 *
 * The `postID` is a path segment, supplied by the bridge as
 * `params: routeContext.params` so the controller's `req.params.postID` read
 * works, and validated as an ObjectId inside the handler.
 */

// `nodejs` because this route reaches `mongoose` and `jsonwebtoken`, neither of
// which is Edge-compatible. `force-dynamic` because it reads the auth cookie,
// the body and a dynamic segment, and must never be prerendered.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = defineRoute('POST', {
  controller: createCommentHandler,
});
