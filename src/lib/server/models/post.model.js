import 'server-only';

import mongoose, { Schema } from 'mongoose';

/** Port of `cpccu-server/src/models/post.model.js`. */

/**
 * One media attachment on a post. `_id: false` because the array is a value
 * list, not a set of addressable sub-documents — nothing ever joins or updates
 * a media entry by its own id, and suppressing the id keeps the post document
 * (and the `PUBLIC_ITEM`-style projections over it) smaller.
 *
 * `type` is a real enum rather than a derived value: Cloudinary's
 * `resource_type: 'auto'` decides at upload time whether an asset is an image
 * or a video, and this enum is where that decision is persisted so the frontend
 * can pick a player. Video posts depend on it.
 */
const mediaSchema = new Schema(
  {
    url: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ['image', 'video'],
      required: true,
    },
  },
  {
    _id: false,
  },
);

const postSchema = new Schema(
  {
    owner: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    caption: {
      type: String,
    },
    title: String,
    // Denormalised slug. `unique` is deliberately NOT set on it: the backend
    // never enforced slug uniqueness, and adding the index now would fail
    // `autoIndex` on any collection that already contains duplicates.
    slug: String,
    content: String,
    excerpt: String,
    // `author` is a display name snapshotted at write time, separate from
    // `owner` (the ObjectId). Renaming a user therefore does not rewrite the
    // byline on their historic posts.
    author: String,
    // `blog` and `draft` are the fail-closed defaults: an unattributed or
    // un-categorised post is neither listed publicly nor visible until an
    // admin publishes it.
    category: { type: String, default: 'blog' },
    status: { type: String, default: 'draft' },
    tags: { type: [String], default: [] },
    // Denormalised read counter incremented on view. It is intentionally not
    // exact: concurrent increments are allowed to lose an update rather than
    // serialising every page view through an atomic `$inc` + read.
    views: { type: Number, default: 0 },
    media: {
      type: [mediaSchema],
      default: [],
    },
  },
  { timestamps: true },
);

// Mongoose caches compiled models on the mongoose instance. Under Next dev HMR the
// module graph is re-evaluated on every edit, so a bare mongoose.model() call would
// throw OverwriteModelError on the second evaluation. Reuse the cached model.
const Post = mongoose.models.Post || mongoose.model('Post', postSchema);

export { Post };
