import 'server-only';

import mongoose from 'mongoose';

/** Port of `cpccu-server/src/models/certificate.model.js` (default -> named export). */

// The four `contestType` / `certificateType` enums below are the PUBLIC
// vocabulary of the verification page. `contestType` is the KIND of event,
// `certificateType` is the PLACEMENT. Note that
// `services/certificate.service.js` and `statistics.service.js` both count
// winner types that are NOT in `certificateType` (`top-performer`, `1st-place`,
// `2nd-place`, `3rd-place`) — those are legacy values that predate the enum and
// can no longer be written through this schema. The dead clauses are preserved
// so the historical counts do not change.
const certificateSchema = new mongoose.Schema(
  {
    // The public certificate number. Unique + indexed: it is the only
    // identifier a certificate holder has, so a collision would let one person
    // present another's certificate. Duplicate-key errors on this field are
    // mapped to a 409 by `toErrorResponse` in `errors.js`.
    // The four `index: true` declarations below replaced the commented-out
    // `certificateSchema.index({ ... })` calls that sat at the bottom of the
    // Express file; those dead lines are not carried over, but the indexes they
    // described are identical.
    certificateId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },

    recipientName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    recipientId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    contestName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    contestType: {
      type: String,
      required: true,
      trim: true,
      enum: ['programming-contest', 'article-writing', 'hackathon', 'workshop'],
    },

    certificateType: {
      type: String,
      required: true,
      trim: true,
      enum: ['winner', 'runner-up', '2nd-runner-up', 'participation'],
    },

    // `null` (not 0) when a participation-only certificate has no placement,
    // so "no rank" is distinguishable from "rank zero", which is not a valid
    // rank — hence `min: 1`.
    rank: {
      type: Number,
      default: null,
      min: 1,
    },

    issueDate: {
      type: Date,
      required: true,
    },

    issuedBy: {
      type: String,
      required: true,
      trim: true,
      default: 'CPCCU - City University',
    },

    description: {
      type: String,
      required: true,
      trim: true,
    },
    // Head-count of participants in the contest who did NOT receive a
    // certificate. It is summed once per contest (not once per certificate) by
    // `getCertificateStatsService`, so it must hold the TOTAL for the contest,
    // not an increment. Overwriting it per certificate would inflate the
    // "Total Participants" stat.
    extraParticipants: {
      type: Number,
      default: 0,
      min: 0,
    },

    batch: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },
  },
  {
    timestamps: true,
    // `versionKey: false` drops `__v` from these documents. It is preserved
    // from the original: the certificate documents are seeded/rewritten
    // wholesale, and the optimistic-locking counter is not used by any caller.
    versionKey: false,
  },
);

// Mongoose caches compiled models on the mongoose instance. Under Next dev HMR the
// module graph is re-evaluated on every edit, so a bare mongoose.model() call would
// throw OverwriteModelError on the second evaluation. Reuse the cached model.
const Certificate =
  mongoose.models.Certificate ||
  mongoose.model('Certificate', certificateSchema);

export { Certificate };
