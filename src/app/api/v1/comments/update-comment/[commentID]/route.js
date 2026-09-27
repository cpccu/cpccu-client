import { updateCommentHandler } from '@/lib/server/controllers/comment.controller';
import { defineRoute } from '@/lib/server/handler';

/**
 * `PATCH /api/v1/comments/update-comment/:commentID` — edit your own comment.
 *
 * AUTHENTICATED (`public` absent), and the OWNERSHIP GATE IS INSIDE THE HANDLER:
 * `existedComment.commenter === req.user._id`, with NO moderator exception.
 * Moderators edit content through the admin panel, not through this endpoint.
 *
 * ================== DELIBERATE DIVERGENCE: THIS ENDPOINT NOW WORKS ==================
 * IN THE EXPRESS ORIGINAL THIS ROUTE WAS 100% BROKEN AND ALWAYS RETURNED A 500.
 * The original read:
 *
 *     existedComment.comment = comment;
 *     updatedComment = await existedComment.save();
 *
 * `updatedComment` was NEVER DECLARED. ES modules are always in strict mode, so
 * the assignment is a `ReferenceError` — not a silent implicit global as it
 * would be in non-strict CommonJS, which is exactly why this survived in a
 * codebase that otherwise used ESM throughout. The throw happens AFTER the save,
 * so the write DID land and the caller was told it failed: a client that retried
 * would loop on a 500 it could never fix. There was no input — no admin token,
 * no empty body — that avoided it.
 *
 * THE PORT FIXES IT (`const updatedComment = …`), which makes a 500 into a
 * working 200. This is the ONE place in the migration where a ported controller
 * becomes more correct rather than more faithful, and it is stated here, in
 * `comment.controller.js`, and in the report rather than left for someone to
 * discover as an unexplained behaviour change. The change is one character and
 * has no surface beyond the status code: same validation, same authorisation,
 * same save, same response body.
 */

// `nodejs` because this route reaches `mongoose` and `jsonwebtoken`, neither of
// which is Edge-compatible. `force-dynamic` because it reads the auth cookie,
// the body and a dynamic segment, and must never be prerendered or cached.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const PATCH = defineRoute('PATCH', {
  controller: updateCommentHandler,
});
