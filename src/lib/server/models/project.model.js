import 'server-only';

import mongoose, { Schema } from 'mongoose';

/** Port of `cpccu-server/src/models/project.model.js`. */

const projectSchema = new Schema(
  {
    // Indexed because the public profile reads a member's projects by
    // `userId` on every page view. `required` — unlike the optional
    // `developerProfile.userId` — because a project is meaningless without an
    // owner.
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    technologies: {
      type: [String],
      default: [],
    },
    // Both URLs default to '' rather than being required: a project may be
    // private with no repo, or hosted with no live deployment, and the renderer
    // branches on emptiness to decide which links to show.
    repoUrl: {
      type: String,
      default: '',
      trim: true,
    },
    liveUrl: {
      type: String,
      default: '',
      trim: true,
    },
    category: {
      type: String,
      default: '',
      trim: true,
    },
    // Real enum, defaulted to `active`: a newly added project shows on the
    // profile immediately, and archiving/hiding it is an explicit act.
    status: {
      type: String,
      enum: ['active', 'completed', 'archived'],
      default: 'active',
    },
    // Manual display order within a member's project list.
    order: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true },
);

// Mongoose caches compiled models on the mongoose instance. Under Next dev HMR the
// module graph is re-evaluated on every edit, so a bare mongoose.model() call would
// throw OverwriteModelError on the second evaluation. Reuse the cached model.
const Project =
  mongoose.models.Project || mongoose.model('Project', projectSchema);

export { Project };
