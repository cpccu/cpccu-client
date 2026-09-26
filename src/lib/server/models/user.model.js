import 'server-only';

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose, { Schema } from 'mongoose';

import { MAINTENANCE_DAY } from '@/lib/server/constants';

/**
 * Port of `cpccu-server/src/models/user.model.js`.
 *
 * The schema is byte-for-byte the Express original except for two things:
 *  1. every model is now a NAMED export (`export { User }`) instead of a default,
 *     because a barrel that re-exports the same symbol from two files makes the
 *     provenance of a model ambiguous, and App Router route files benefit from
 *     explicit named imports;
 *  2. the model is compiled through the `mongoose.models.X` re-registration
 *     guard (see the bottom of this file).
 *
 * The password/OTP hashing behaviour, the instance methods, the role enum and
 * the TTL index are all load-bearing and are documented where they appear.
 */

/**
 * Roles a user may hold. The enum is duplicated in `adminAuth.js` (`adminRoles`)
 * as the panel-access allowlist — the two lists are intentionally NOT the same
 * (see the note on `member` there): being a grantable role is not the same as
 * being a role that grants admin-panel access.
 */
const roleSchema = new Schema(
  {
    role: {
      type: String,
      enum: ['admin', 'moderator', 'mentor', 'member'],
      required: true,
    },
    position: {
      type: Number,
      required: true,
    },
    positionName: {
      type: String,
      required: true,
    },
  },
  { _id: false },
);

// One issued refresh token. `expire` is stored per entry (not derived from the
// JWT) so a single token can be revoked by removing just this sub-document.
const refreshTokenSchema = new Schema(
  {
    token: {
      type: String,
      required: true,
    },
    expire: {
      type: Date,
      required: true,
    },
  },
  {
    _id: false,
  },
);

const userSchema = new Schema(
  {
    // PRESENT ONLY for accounts created through Google sign-in. `sparse: true`
    // is required, not cosmetic: without it every Google-less user would
    // collide on the unique index because the field is absent rather than
    // null. The `unique` + `sparse` pair is the standard Mongo idiom for
    // "unique, but optional".
    googleID: {
      type: String,
      unique: true,
      sparse: true,
    },
    fullName: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      unique: true,
      required: true,
    },
    phone: {
      type: String,
    },
    bio: {
      type: String,
      default: '',
    },
    department: {
      type: String,
      default: '',
    },
    section: {
      type: String,
    },
    avatar: {
      type: String,
    },
    // Cloudinary write primitive kept alongside the delivery URL so the asset
    // can be destroyed later. NOTE: it is also in the `PUBLIC_ITEM` projection
    // (see constants.js) — a deliberate, flagged exposure.
    avatarPublicId: {
      type: String,
    },
    coverImage: {
      type: String,
    },
    coverImagePublicId: {
      type: String,
    },
    // BUSINESS RULE: a local (non-Google) account MUST declare its batch. Google
    // accounts have no batch, so the validator is conditional on `!this.googleID`
    // rather than unconditional. Same rule for `uniID` and `password` below.
    batch: {
      type: String,
      validate: {
        validator: function () {
          return !this.googleID;
        },
        message: 'Batch is required for non-Google users',
      },
    },
    github: {
      type: String,
    },
    linkedin: {
      type: String,
    },
    portfolio: {
      type: String,
    },
    // Moderation state of a member's job-application blurb. `hidden` is the
    // default so a newly submitted entry is NOT publicly visible until an admin
    // approves it — fail-closed rather than fail-open.
    jobPipelineStatus: {
      type: String,
      enum: ['hidden', 'pending', 'approved', 'rejected'],
      default: 'hidden',
    },
    jobPipelineTitle: {
      type: String,
      trim: true,
      default: '',
    },
    jobPipelineRejectionReason: {
      type: String,
      trim: true,
      default: '',
    },
    skills: {
      type: [
        {
          skillName: { type: String, required: true },
          experience: { type: String, required: true },
        },
      ],
      default: [],
    },
    // Sparse + unique for the same reason as `googleID` above; the validator
    // enforces the same "required for non-Google users" business rule.
    uniID: {
      type: String,
      unique: true,
      sparse: true,
      validate: {
        validator: function () {
          return !this.googleID;
        },
        message: 'University ID is required for non-Google users',
      },
    },
    // `required` as a FUNCTION so a Google account (which authenticates via
    // googleID and never sets a password) is not rejected. The value is bcrypt
    // hashed by the pre-save hook below, never stored in plain text.
    password: {
      type: String,
      required: function () {
        return !this.googleID;
      },
    },
    socialLinks: {
      type: [String],
      default: [],
    },
    // Privilege level of the account. Defaults to the LOWEST privilege, so an
    // account that is created without an explicit role can never accidentally
    // come into existence with elevated access.
    roles: {
      type: roleSchema,
      default: { role: 'member', position: 0, positionName: 'member' },
    },
    otp: {
      code: String,
      expire: Date,
      // Failed verification attempts against the current code. Reset whenever a
      // fresh OTP is issued; reaching the limit invalidates the code.
      attempts: {
        type: Number,
        default: 0,
      },
    },
    // Separate store from `otp`: a password-reset code must never be able to
    // satisfy, or be satisfied by, a registration code. They have different
    // lifetimes (RESET_TIME vs OTP_TIME) and different purposes.
    resetOTP: {
      code: String,
      expire: Date,
    },
    // Soft-disable flag, default FALSE, and it is two flags in one:
    //  - `false` for a freshly registered account means "OTP not yet verified";
    //  - `false` for a previously active account means "banned/deactivated".
    // `auth.js` rejects `isValid: false` even with a valid, unexpired token, and
    // the TTL index at the bottom of this file uses the same value to garbage
    // collect unverified accounts. Do not reuse this field for anything else.
    isValid: {
      type: Boolean,
      default: false,
    },
    refreshTokens: {
      type: [refreshTokenSchema],
      default: [],
    },
  },
  { timestamps: true },
);

/**
 * Pre-save hook — FOUR INDEPENDENT responsibilities, deliberately kept in one
 * hook because Mongoose only runs the last registered `pre('save')` per hook
 * name; splitting them into four hooks would silently drop three of them.
 *
 * This hook is SECURITY-CRITICAL. Each block below must stay.
 */
userSchema.pre('save', async function () {
  // (1) PASSWORD HASHING.
  // Guarded by `isModified` so a re-save of an unrelated field (e.g. pushing a
  // refresh token) does NOT re-hash an already-hashed password — bcrypt is
  // salted, so a second hash would make the stored value a hash of a hash and
  // `isPasswordCorrect` would stop working for that user.
  // Cost factor 10 is bcrypt's standard default here; the value is not
  // configurable because changing it would not re-hash existing passwords.
  if (this.isModified('password') && this.password) {
    this.password = await bcrypt.hash(this.password, 10);
  }

  // (2) EXPIRED REFRESH-TOKEN PRUNING.
  // A user can hold several refresh tokens at once (one per logged-in device),
  // and the array grows without bound otherwise — it is only ever appended to,
  // never rewritten wholesale. Without this sweep the sub-document array on a
  // frequently-used account becomes a large permanent document.
  // Security value beyond size: an expired token left in the array would still
  // be rejected by `auth.js` (it checks `rt.expire > Date.now()`), so this is
  // housekeeping, NOT the access check. The comparison is `token.expire >
  // Date.now()` — a JS Date coerced to a number — kept verbatim.
  if (this.isModified('refreshTokens')) {
    this.refreshTokens = this.refreshTokens.filter(
      (token) => token.expire > Date.now(),
    );
  }

  // (3) OTP HASHING.
  // Same reasoning as the password: a stored OTP is a single-factor credential
  // on an UNAUTHENTICATED endpoint, so it is bcrypt hashed rather than stored
  // in clear. Hashing means the code cannot be read back out of a database dump
  // or a leaked projection. Guarded by `isModified` for the same reason as (1).
  if (this.isModified('otp.code') && this.otp && this.otp.code) {
    this.otp.code = await bcrypt.hash(this.otp.code, 10);
  }

  // (4) RESET-OTP HASHING.
  // Separate from (3) on purpose: `resetOTP` is a higher-value credential (it
  // authorises a password change) and must not share state with the
  // registration OTP. Same `isModified` guard, same cost factor.
  if (this.isModified('resetOTP.code') && this.resetOTP && this.resetOTP.code) {
    this.resetOTP.code = await bcrypt.hash(this.resetOTP.code, 10);
  }
});

/**
 * Instance methods — five behavioural checkers plus three token factories.
 * (The task brief called these "6 instance methods"; the Express original
 * actually defines EIGHT, and all eight are ported here.)
 *
 * All comparisons go through `bcrypt.compare`, never an equality check — the
 * stored value is a hash, so `===` could never succeed.
 */

// Method to check password correctness
userSchema.methods.isPasswordCorrect = async function (password) {
  return await bcrypt.compare(password, this.password);
};

// Verify OTP code
userSchema.methods.isOTPcorrect = async function (inputOTP) {
  if (!this.otp || !this.otp.code) return false;
  // Hash the inputOTP to compare with the stored OTP code
  return await bcrypt.compare(inputOTP, this.otp.code);
};

/**
 * Check if OTP has expired.
 * MISSING OTP or missing expiry is reported as EXPIRED (`true`), not as valid.
 * That is the fail-closed direction: an account with a half-written OTP record
 * must not be treated as having a usable code.
 */
userSchema.methods.isOTPExpired = function () {
  if (!this.otp || !this.otp.expire) return true;
  return Date.now() > new Date(this.otp.expire).getTime();
};

// Verify reserOTP code
userSchema.methods.isresetOTPcorrect = async function (inputOTP) {
  if (!inputOTP || !this.resetOTP.code) return false;
  return await bcrypt.compare(inputOTP, this.resetOTP.code);
};

/**
 * Check if resetOTP has expired.
 * Same fail-closed rule as `isOTPExpired`: no expiry date means expired. The
 * original comment "Assume expired if no expiry date" states the intent and is
 * load-bearing, so it is kept.
 */
userSchema.methods.isresetOTPExpired = function () {
  if (!this.resetOTP || !this.resetOTP.expire) return true; // Assume expired if no expiry date
  return Date.now() > this.resetOTP.expire;
};

/**
 * Method to generate a refresh token.
 * SIGNED WITH A DIFFERENT SECRET from the access token (`REFRESH_TOKEN_SECRET`),
 * so a stolen access token can never be replayed as a refresh token and vice
 * versa. Expiry comes from the env, not from a constant here, so the two token
 * lifetimes can be tuned without a redeploy of the code.
 */
userSchema.methods.generateRefreshToken = function () {
  return jwt.sign(
    { _id: this._id },
    process.env.REFRESH_TOKEN_SECRET, // Use a different secret for refresh token
    { expiresIn: process.env.REFRESH_TOKEN_EXPIRE },
  );
};

/**
 * Method to generate an access token.
 * The payload is only `{ _id }` — no roles, no email — so a role change or a
 * ban takes effect on the next `findById` inside `auth.js` rather than being
 * frozen into a token that stays valid for its full lifetime.
 */
userSchema.methods.generateAccessToken = function () {
  return jwt.sign({ _id: this._id }, process.env.ACCESS_TOKEN_SECRET, {
    expiresIn: process.env.ACCESS_TOKEN_EXPIRE,
  });
};

/**
 * Method to generate a password reset token.
 * Signed with a THIRD secret (`PASSWORD_TOKEN_SECRET`) so it is not accepted
 * by any endpoint that verifies access or refresh tokens, and so its compromise
 * does not affect normal session auth.
 */
userSchema.methods.generatePasswordToken = function () {
  return jwt.sign({ _id: this._id }, process.env.PASSWORD_TOKEN_SECRET, {
    expiresIn: process.env.PASSWORD_TOKEN_EXPIRE,
  });
};

/**
 * TTL INDEX — the soft-delete / ban sweep, and the single most surprising piece
 * of this schema.
 *
 * A Mongo TTL index does not delete a document a fixed time after a MODIFICATION;
 * it deletes it `expireAfterSeconds` after the value of its indexed field, which
 * here is `createdAt`. Combined with `partialFilterExpression: { isValid: false }`
 * the effect is:
 *
 *  - an account that was created but never OTP-verified is REMOVED
 *    `MAINTENANCE_DAY * 24 * 60 * 60` seconds after it was created. Note the
 *    original source comment said "one month", but the constant is
 *    `MAINTENANCE_DAY = 15`, so the real window is
 *    15 * 24 * 60 * 60 = 1,296,000 s = 15 DAYS. The comment is wrong; the
 *    number is what ships. Flagged so nobody "fixes" the constant to 30 by
 *    trusting the prose.
 *  - a BAN — setting `isValid: false` on an account that was created weeks ago —
 *    arms the same index with a timestamp that is already far in the past, so
 *    the account is removed by the very next TTL sweep (Mongo runs the monitor
 *    about once a minute) rather than being kept as a disabled record.
 *
 * Consequences to keep in mind: this is a HARD delete, not a soft delete — the
 * TTL monitor is not transactional with anything, and unverified sign-ups are
 * removed without any notification. TTL indexes are only created when
 * `autoIndex` is enabled, which it is by default outside production, so an
 * index built at deploy time may be missing on a long-lived database.
 */
userSchema.index(
  { createdAt: 1 },
  {
    expireAfterSeconds: MAINTENANCE_DAY * 24 * 60 * 60,
    partialFilterExpression: { isValid: false },
  },
);

// Mongoose caches compiled models on the mongoose instance. Under Next dev HMR the
// module graph is re-evaluated on every edit, so a bare mongoose.model() call would
// throw OverwriteModelError on the second evaluation. Reuse the cached model.
const User = mongoose.models.User || mongoose.model('User', userSchema);

export { User };
