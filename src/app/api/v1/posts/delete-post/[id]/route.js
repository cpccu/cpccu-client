import { deletePostHandler } from '@/lib/server/controllers/post.controller';
import { defineRoute } from '@/lib/server/handler';

/**
 * `DELETE /api/v1/posts/delete-post/:id` — delete the caller's own post.
 *
 * AUTHENTICATED (`public` absent). The id is a path segment, supplied by the
 * bridge as `params: routeContext.params`; the controller validates it as an
 * ObjectId, loads the post, and compares `post.owner` to `req.user._id` before
 * deleting — that comparison is the only authorisation, exactly as in Express.
 *
 * DELETING A POST DOES NOT DESTROY ITS CLOUDINARY MEDIA. The post document goes;
 * the uploaded assets stay live in Cloudinary and nothing in this application
 * records that they exist, so they are an unrecoverable storage cost. Preserved
 * from the original (`post.controller.js` documents the same gap on the update
 * path) and deliberately not repaired here.
 *
 * No `fileField` and no `maxFiles`: the Express route mounted no upload
 * middleware at all, so a multipart body here is not part of the contract.
 */

// `nodejs` because this route reaches `mongoose` and `jsonwebtoken`, neither of
// which is Edge-compatible. `force-dynamic` because it reads the auth cookie and
// a dynamic segment, and must never be prerendered or cached.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const DELETE = defineRoute('DELETE', {
  controller: deletePostHandler,
});
