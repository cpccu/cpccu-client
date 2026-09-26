import 'server-only';

import mongoose, { Schema } from 'mongoose';

/** Port of `cpccu-server/src/models/comment.model.js`. */

const commentSchema = new Schema(
  {
    postID: {
      type: Schema.Types.ObjectId,
      ref: 'Post',
      required: true,
    },
    commenter: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // The comment body is a free-form String with no trim and no maxlength at
    // the schema level. The limit is enforced in the controller layer, not
    // here — do not move it into the schema without also checking that layer,
    // which relies on this field returning the value verbatim.
    comment: {
      type: String,
    },
  },
  { timestamps: true },
);

// Mongoose caches compiled models on the mongoose instance. Under Next dev HMR the
// module graph is re-evaluated on every edit, so a bare mongoose.model() call would
// throw OverwriteModelError on the second evaluation. Reuse the cached model.
const Comment =
  mongoose.models.Comment || mongoose.model('Comment', commentSchema);

export { Comment };
