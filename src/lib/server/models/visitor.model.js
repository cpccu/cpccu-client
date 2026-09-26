import 'server-only';

import mongoose from 'mongoose';

/** Port of `cpccu-server/src/models/visitor.model.js` (default -> named export). */

/**
 * This collection holds a SINGLE counter document, not a per-visitor log. The
 * `name` field is that document's key and is `unique` precisely so there can
 * only ever be one of them; the value it is looked up by is
 * `VISITOR_RECORD_NAME` ('total-visitors') from `@/lib/server/constants`, and
 * the increment is an atomic `$inc` so concurrent requests cannot lose a count.
 * Adding a second `name` value would be a semantic change, not a new row of
 * data.
 */
const visitorSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
  },
  count: {
    type: Number,
    default: 0,
  },
});

// Mongoose caches compiled models on the mongoose instance. Under Next dev HMR the
// module graph is re-evaluated on every edit, so a bare mongoose.model() call would
// throw OverwriteModelError on the second evaluation. Reuse the cached model.
const Visitor =
  mongoose.models.Visitor || mongoose.model('Visitor', visitorSchema);

export { Visitor };
