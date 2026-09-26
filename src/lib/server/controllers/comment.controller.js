import 'server-only';

import { Comment } from '@/lib/server/models/comment.model';
import { ApiError } from '@/lib/server/errors';
import { ApiResponse } from '@/lib/server/response';
import { isValidIdentity } from '@/lib/server/isValidIdentity';

/**
 * Port of `cpccu-server/src/controllers/comment.controller.js`.
 *
 * Contains the single most surprising change in the whole migration — see
 * `updateCommentHandler` below.
 */

const createCommentHandler = async (req, res) => {
  const { postID } = req.params;
  const { comment } = req.body;

  if (!postID) {
    throw new ApiError(400, 'Comment Id is required');
  }

  if (!isValidIdentity(postID)) {
    throw new ApiError(400, 'Invaild comment id');
  }

  // NOTE there is NO check that the post exists, and no check that `comment` is
  // non-empty — only that it is a well-formed ObjectId. So a comment can be
  // attached to an id that matches nothing. The original behaves identically;
  // the schema is the only thing that would reject a missing `comment`, and it
  // rejects it at save time. Preserved rather than fixed: adding a post lookup
  // is an extra round trip on a hot path, and orphaning a comment is not a
  // security issue.
  const newComment = await Comment.create({
    postID,
    // `commenter` comes from the verified token, never from the body.
    commenter: req.user._id,
    comment,
  });

  if (!newComment) {
    throw new ApiError(500, 'server site error while creating your comment');
  }

  return res
    .status(201)
    .json(
      new ApiResponse(201, newComment, 'Your comment created successfully'),
    );
};

const updateCommentHandler = async (req, res) => {
  const { commentID } = req.params;
  const { comment } = req.body;

  if (!commentID) {
    throw new ApiError(400, 'Comment ID is required');
  }

  if (!isValidIdentity(commentID)) {
    throw new ApiError(400, 'Invalid Comment ID');
  }

  const existedComment = await Comment.findById(commentID);

  if (!existedComment) {
    throw new ApiError(404, 'Comment not found');
  }

  // Ownership gate: only the author may edit their own comment. Moderators do
  // NOT get an exception here — the admin panel edits content through
  // `adminContent.controller.js`, not through this endpoint.
  if (existedComment.commenter.toString() !== req.user._id.toString()) {
    throw new ApiError(403, 'You do not have permission to edit this comment');
  }

  existedComment.comment = comment;
  // ---------------------------------------------------------------------
  // BEHAVIOUR CHANGE — the one endpoint that was 100% broken and now works.
  //
  // The original read:
  //
  //     existedComment.comment = comment;
  //     updatedComment = await existedComment.save();
  //
  // `updatedComment` was NEVER DECLARED. ES modules are always in strict mode,
  // so an assignment to an undeclared identifier is a `ReferenceError` — not a
  // silent implicit global as it would be in a non-strict CommonJS file, which
  // is why this went unnoticed while the rest of the codebase used ESM. The
  // throw happens AFTER the save, so the comment was in fact edited in the
  // database and the client still received a 500.
  //
  // Consequence in the original, for every single request to
  // `PATCH /api/v1/comment/update-comment/:commentID`: the write succeeded and
  // the caller was told it failed. A client that retries, or that reloads and
  // re-submits, would loop on a 500 that it could never fix. There is no
  // possible input — not an admin token, not an empty body — that avoided it.
  //
  // The fix is `const`, and it is a one-character change with no behavioural
  // surface beyond the status code: same authorisation, same validation, same
  // save, same response body. A 500 becomes a working 200. This is the only
  // place in the migration where a ported controller becomes more correct
  // rather than more faithful, and it is flagged for the orchestrator because a
  // behaviour change made silently during a migration is how nobody notices the
  // next one.
  // ---------------------------------------------------------------------
  const updatedComment = await existedComment.save();

  return res
    .status(200)
    .json(new ApiResponse(200, updatedComment, 'Comment updated successfully'));
};

const deleteCommentHandler = async (req, res) => {
  const { commentID } = req.params;

  if (!commentID) {
    throw new ApiError(400, 'Comment ID is required');
  }

  if (!isValidIdentity(commentID)) {
    throw new ApiError(400, 'Invalid Comment ID');
  }

  const existedComment = await Comment.findById(commentID);

  if (!existedComment) {
    throw new ApiError(404, 'Comment not found');
  }

  // Same ownership gate and — verbatim from the original — the SAME message as
  // the update path ('edit this comment'). The wording is wrong for a delete,
  // but it is a string the client may key off, so it is not "corrected" here.
  if (existedComment.commenter.toString() !== req.user._id.toString()) {
    throw new ApiError(403, 'You do not have permission to edit this comment');
  }

  await existedComment.deleteOne();

  // The success message is lower-case 'comment deleted successfully' where every
  // other handler in this codebase capitalises it. Preserved: it is on the wire.
  return res
    .status(200)
    .json(new ApiResponse(200, null, 'comment deleted successfully'));
};

export { createCommentHandler, deleteCommentHandler, updateCommentHandler };
