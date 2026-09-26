import 'server-only';

import mongoose, { Schema } from 'mongoose';

/** Port of `cpccu-server/src/models/role.model.js` (default -> named export). */

/**
 * Roles as ADMINISTRABLE RECORDS.
 *
 * This collection is distinct from the `roles` SUB-SCHEMA embedded on the user
 * document (`models/user.model.js`), and the two are deliberately not
 * reconciled: the embedded sub-schema pins `role` to the four-value enum
 * (admin / moderator / mentor / member) and is what `auth.js` and `adminAuth.js`
 * actually authorise against, while this collection is a free-form catalogue
 * the admin panel edits. Adding a role here does NOT grant it any privilege.
 */
const roleSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    // `lowercase: true` is applied by Mongoose on BOTH read and write, so
    // `'Mentor'` and `'mentor'` are the same stored value and cannot produce
    // two rows that differ only by case — the unique index would not catch that
    // on its own because it is case-sensitive.
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    // Soft off-switch for a catalogue entry, defaulting to ON. Setting it false
    // hides the role from the admin picker; it does not remove it, because
    // existing users may still hold it.
    active: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

// Supports the admin panel's "show only active roles" filter. In the Express
// original this was a separate statement after the schema; it is kept in the
// same place for a one-to-one diff.
roleSchema.index({ active: 1 });

// Mongoose caches compiled models on the mongoose instance. Under Next dev HMR the
// module graph is re-evaluated on every edit, so a bare mongoose.model() call would
// throw OverwriteModelError on the second evaluation. Reuse the cached model.
const Role = mongoose.models.Role || mongoose.model('Role', roleSchema);

export { Role };
