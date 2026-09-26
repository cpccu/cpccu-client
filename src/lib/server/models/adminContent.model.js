import 'server-only';

import mongoose, { Schema } from 'mongoose';

/**
 * Port of `cpccu-server/src/models/adminContent.model.js`.
 *
 * This file is the DUMP collection module: thirteen unrelated content models
 * (events, gallery, people, audit, settings) share one file in the Express
 * original because they were all only ever touched by
 * `adminContent.controller.js`. The file grouping is kept as-is so a diff
 * against the backend stays one-to-one; splitting it per model would make
 * thirteen new files with no behavioural gain.
 *
 * All THIRTEEN exports are preserved verbatim, including `SiteData` — see the
 * note on it below.
 *
 * Schemas are declared in declaration order and models are compiled in the same
 * order. That order is not arbitrary: `gallerySchema` holds a `ref: 'GalleryEvent'`
 * and the docs use `autoIndex` builds, so a stable registration order keeps the
 * generated index builds reproducible.
 */

const eventSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    date: { type: Date, required: true },
    endDate: { type: Date, required: true },
    location: { type: String, default: '' },
    // `type` is a free-form String, NOT an enum. `statistics.service.js` counts
    // `type: 'contest'` to derive "Contests Held", and the admin UI writes
    // arbitrary values here — so the set of values is wider than the two the
    // backend happens to read. Adding an enum would break existing documents.
    type: { type: String, default: 'workshop' },
    status: { type: String, default: 'upcoming' },
    // `capacity: 0` means "unlimited / not set"; the admin UI treats 0 as
    // uncapped rather than as a capacity of zero.
    capacity: { type: Number, default: 0 },
    registered: { type: Number, default: 0 },
    organizer: { type: String, default: 'CPCCU' },
    image: { type: String, default: '' },
    eventHeadLine1: { type: String, default: '' },
    reward: String,
    // The three headline/rules pairs are positional: the public event page
    // renders headline N above rules N. They are plain strings rather than an
    // array of {headline, rules} objects, so the pairing is by field name only.
    eventHeadLine2: { type: String, default: 'Reward' },
    eventHeadLine3: { type: String, default: 'Rules' },
    rules1: { type: String, default: '' },
    rules2: { type: String, default: '' },
    rules3: { type: String, default: '' },
    rules4: { type: String, default: '' },
    btnText: { type: String, default: '' },
    btnLink: { type: String, default: '' },
    btnText1: { type: String, default: '' },
    btnLink1: { type: String, default: '' },
    // `order` is the manual sort key for the admin-managed lists; it is NOT a
    // creation timestamp, so a re-order intentionally changes the field.
    order: { type: Number, default: 0 },
    registrationLink: String,
    contestLink: String,
    meetLink: String,
    vjudgeGroupLink: String,
  },
  { timestamps: true },
);

const galleryEventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    // A FUNCTION reference, not `Date.now`. Mongoose invokes it per document
    // insert, so two events created in the same millisecond get distinct, real
    // timestamps. Passing `Date.now` itself would evaluate once and freeze the
    // value for every future insert.
    eventDate: { type: Date, default: Date.now },
    featured: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
  },
  { timestamps: true },
);

const gallerySchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    imageUrl: { type: String, required: true, trim: true },
    category: { type: String, default: 'events' },
    uploadedBy: { type: String, default: 'CPCCU' },
    uploadedAt: { type: Date, default: Date.now },
    featured: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
    // OPTIONAL link to the gallery event these photos belong to. `sparse` is
    // required: a photo may exist with no event at all, and without `sparse`
    // every one of those would collide on the index as `null`.
    eventId: {
      type: Schema.Types.ObjectId,
      ref: 'GalleryEvent',
      index: true,
      sparse: true,
    },
  },
  { timestamps: true },
);

const contributorSchema = new Schema(
  {
    username: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },
    avatarUrl: { type: String, default: '' },
    githubUrl: { type: String, default: '' },
    linkedinUrl: String,
    // `commits` is a DENORMALISED counter maintained by a seed/sync job, not a
    // value derived from GitHub at read time. The public site trusts it as-is.
    commits: { type: Number, default: 0 },
    role: { type: String, default: 'Contributor' },
    joinedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

const donatorSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    avatarUrl: { type: String, default: '' },
    contribution: { type: String, required: true, trim: true },
    // `amount` is NOT required and NOT defaulted: the frontend renders the
    // contribution text with no amount when the donor was in kind (goods,
    // effort) rather than cash. Making it required would force a fake 0.
    amount: Number,
    donatedAt: { type: Date, default: Date.now },
    // Privacy rule: the admin records the real name anyway, and the public
    // renderer decides whether to display it based on this flag.
    isAnonymous: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
  },
  { timestamps: true },
);

const developerProfileSchema = new Schema(
  {
    // Sparse + indexed: a developer profile may be submitted by someone whose
    // `User` record is later removed, in which case `userId` is simply absent
    // rather than null.
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
      sparse: true,
    },
    title: { type: String, required: true, trim: true },
    // Free-form status, defaulted to `pending`, i.e. a newly submitted profile
    // is awaiting review rather than public. Fail-closed by default.
    status: { type: String, default: 'pending' },
    rejectionReason: { type: String, trim: true, default: '' },
    submittedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

const contactMessageSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true },
    subject: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    // Inbox state. `unread` is the default because this collection is only
    // written by the public contact form, so every new row starts unread.
    status: { type: String, default: 'unread' },
    receivedAt: { type: Date, default: Date.now },
    repliedAt: Date,
    reply: String,
  },
  { timestamps: true },
);

const committeeMemberSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    fullName: { type: String, trim: true },
    email: { type: String, default: '', trim: true },
    phone: { type: String, default: '' },
    position: { type: String, required: true, trim: true },
    avatar: { type: String, default: '' },
    // NOTE: `avatar` and `img` are BOTH present. They are redundant field
    // names that different admin screens write to, which is why documents in
    // this collection can have a populated `avatar` and an empty `img` and
    // still render. Do not "de-duplicate" them as part of a port — the admin
    // forms read both.
    img: { type: String, default: '' },
    term: { type: String, default: 'Running Committee', trim: true },
    // Explicit enum rather than a boolean: the UI groups members into
    // "running" vs "previous" committees, and `order` only sorts within a group.
    group: { type: String, enum: ['running', 'previous'], default: 'running' },
    order: { type: Number, default: 0 },
  },
  { timestamps: true },
);

const systemSettingsSchema = new Schema(
  {
    // Singleton key. `unique: true` is what makes this a single-row collection
    // by convention: the controller upserts on `key: 'system'`, and a duplicate
    // insert is rejected by the index rather than by application logic.
    key: { type: String, default: 'system', unique: true },
    // `Schema.Types.Mixed` for every section: these are pass-through
    // configuration blobs owned entirely by the admin UI, so pinning a shape
    // here would make a settings change a schema migration.
    general: { type: Schema.Types.Mixed, default: {} },
    notifications: { type: Schema.Types.Mixed, default: {} },
    security: { type: Schema.Types.Mixed, default: {} },
    appearance: { type: Schema.Types.Mixed, default: {} },
    siteMetadata: { type: Schema.Types.Mixed, default: {} },
    maintenance: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

const alumniSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    position: { type: String, default: '', trim: true },
    batch: { type: String, default: '', trim: true },
    technology: { type: String, default: '', trim: true },
    // Mixed, not a structured sub-schema: `job` and `socials` hold whatever the
    // alumni submission form collected (company, role, links) and are rendered
    // by a generic key/value component on the public site.
    job: { type: Schema.Types.Mixed, default: {} },
    email: { type: String, default: '', trim: true },
    phone: { type: String, default: '', trim: true },
    img: { type: String, default: '' },
    avatar: { type: String, default: '' },
    socials: { type: Schema.Types.Mixed, default: {} },
    order: { type: Number, default: 0 },
  },
  { timestamps: true },
);

const siteDataSchema = new Schema(
  {
    // `resource` is the logical content key (e.g. a page slug) and is indexed
    // because every read looks a resource up by it.
    resource: { type: String, required: true, index: true },
    // `sourceFile` is the file the seed data came from and is UNIQUE, so the
    // same source file cannot seed two resources. This field exists purely for
    // the seed script, which lives outside `src/` — see the note on the model
    // below.
    sourceFile: { type: String, required: true, unique: true },
    data: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

const adminAuditLogSchema = new Schema(
  {
    // Append-only audit trail. `adminId` is a plain ref with NO index and NO
    // `required`: the log must still record the action when the acting
    // principal's user document has already been deleted, so `adminName` is
    // denormalised alongside it as the durable human-readable record.
    adminId: { type: Schema.Types.ObjectId, ref: 'User' },
    adminName: { type: String, default: '' },
    action: { type: String, required: true },
    resource: { type: String, required: true },
    // Stored as a String, not an ObjectId: the same audit collection records
    // writes to documents across many collections, and `_id` is not the only
    // identifier some of them are addressed by.
    resourceId: { type: String, default: '' },
    summary: { type: String, default: '' },
  },
  { timestamps: true },
);

const certificateVerificationLogSchema = new Schema(
  {
    certificateId: { type: String, required: true, index: true },
    // Both outcomes are recorded — a failed verification is the interesting
    // one. `success` defaults to false, so a write that omits it is counted as
    // a failure by `statistics.service.js` rather than inflating the success
    // count.
    success: { type: Boolean, default: false },
    // IP and user agent are stored to make credential-stuffing / scraping of
    // the PUBLIC certificate verification endpoint visible after the fact.
    ip: { type: String, default: '' },
    userAgent: { type: String, default: '' },
  },
  { timestamps: true },
);

// Mongoose caches compiled models on the mongoose instance. Under Next dev HMR the
// module graph is re-evaluated on every edit, so a bare mongoose.model() call would
// throw OverwriteModelError on the second evaluation. Reuse the cached model.
// The same guard is applied to all thirteen models compiled below.
const Event = mongoose.models.Event || mongoose.model('Event', eventSchema);
const GalleryEvent =
  mongoose.models.GalleryEvent ||
  mongoose.model('GalleryEvent', galleryEventSchema);
const GalleryItem =
  mongoose.models.GalleryItem || mongoose.model('GalleryItem', gallerySchema);
const Contributor =
  mongoose.models.Contributor ||
  mongoose.model('Contributor', contributorSchema);
const Donator =
  mongoose.models.Donator || mongoose.model('Donator', donatorSchema);
const Alumni = mongoose.models.Alumni || mongoose.model('Alumni', alumniSchema);
const DeveloperProfile =
  mongoose.models.DeveloperProfile ||
  mongoose.model('DeveloperProfile', developerProfileSchema);
const ContactMessage =
  mongoose.models.ContactMessage ||
  mongoose.model('ContactMessage', contactMessageSchema);
const CommitteeMember =
  mongoose.models.CommitteeMember ||
  mongoose.model('CommitteeMember', committeeMemberSchema);
const SystemSettings =
  mongoose.models.SystemSettings ||
  mongoose.model('SystemSettings', systemSettingsSchema);
// `SiteData` is consumed by a SEED script that lives outside `src/`
// (`scripts/`), which imports this module by name. That external caller is why
// this export must be preserved by name — do not drop it as unused.
const SiteData =
  mongoose.models.SiteData || mongoose.model('SiteData', siteDataSchema);
const AdminAuditLog =
  mongoose.models.AdminAuditLog ||
  mongoose.model('AdminAuditLog', adminAuditLogSchema);
const CertificateVerificationLog =
  mongoose.models.CertificateVerificationLog ||
  mongoose.model(
    'CertificateVerificationLog',
    certificateVerificationLogSchema,
  );

/**
 * All thirteen exports are preserved by name from the Express original, in the
 * same order. `SiteData` in particular has a consumer outside `src/`
 * (`cpccu-server/scripts/seedDataFromJson.js`), so it is not unused.
 */
export {
  AdminAuditLog,
  Alumni,
  CertificateVerificationLog,
  ContactMessage,
  CommitteeMember,
  Contributor,
  DeveloperProfile,
  Donator,
  Event,
  GalleryEvent,
  GalleryItem,
  SiteData,
  SystemSettings,
};
