import 'server-only';

import {
  Alumni,
  CommitteeMember,
  Contributor,
  DeveloperProfile,
  Donator,
  Event,
  GalleryEvent,
  GalleryItem,
} from '@/lib/server/models/adminContent.model';
import { ApiError } from '@/lib/server/errors';
import { ApiResponse } from '@/lib/server/response';
import { getSiteStatistics } from '@/lib/server/services/statistics.service';

/**
 * Port of `cpccu-server/src/controllers/content.controller.js`.
 *
 * This is the UNAUTHENTICATED read surface of every collection the admin panel
 * manages, and the `publicModels` whitelist below is the single security
 * control standing between an anonymous request and the database.
 */

/**
 * THE WHITELIST IS AN ALLOW-LIST, AND THAT IS THE POINT.
 *
 * `publicModels[resource]` is looked up with a key taken straight from the URL,
 * so anything NOT in this object is a 404 rather than a query. The original
 * explicitly checked `if (!Model) throw new ApiError(404, ...)` instead of
 * letting an unknown key reach a model lookup, and that is what stops
 * `?resource=users` or `?resource=adminauditlogs` from turning a public
 * endpoint into a data-exfiltration primitive. Do not replace this with a
 * dynamic `mongoose.model(resourceName)` lookup, and do not add a collection
 * here without checking what it holds — a collection that stores internal notes
 * or audit records is one line away from being public.
 *
 * The keys are URL segments, so `'gallery-events'` is hyphenated while the
 * exported model is `GalleryEvent`; the map is the only place that translation
 * exists.
 */
const publicModels = {
  alumni: Alumni,
  contributors: Contributor,
  committees: CommitteeMember,
  donators: Donator,
  events: Event,
  gallery: GalleryItem,
  'gallery-events': GalleryEvent,
  profiles: DeveloperProfile,
};

/**
 * Normalises the two historical shapes of a developer skill into one.
 *
 * A user's `skills` is an array whose entries are either `{ skillName, experience }`
 * (the legacy shape, still present on documents written before the change) or
 * `{ name, description }` (the current shape). Both are accepted, and the
 * `||` chain prefers the LEGACY key — so a document that somehow carries both
 * renders the legacy one. Preserved verbatim; the two shapes never coexist on
 * one entry in practice.
 *
 * Entries with no name at all are DROPPED by the `.filter`, because the public
 * page renders a skill chip per entry and a nameless chip is a blank box.
 */
const normalizeDeveloperSkills = (skills = []) =>
  (skills || [])
    .map((skill) => ({
      name: skill?.skillName || skill?.name,
      description: skill?.experience || skill?.description,
    }))
    .filter((skill) => skill.name);

/**
 * Flattens a `DeveloperProfile` plus its populated `userId` into the shape the
 * public developer page consumes.
 *
 * Returns `null` when `profile.userId` is unpopulated, and the caller filters
 * those out. That happens for a profile whose user was deleted: `.populate()`
 * sets the ref to `null` rather than removing the document, so a profile can
 * outlive its owner. Returning `null` and filtering is what keeps a deleted
 * member from appearing on the public page as a row of empty strings.
 *
 * `department` falls back `user.section` -> `user.batch` -> `'CPCCU'`, so the
 * card always has a label even for an account that filled in neither.
 */
const formatDeveloperProfile = (profile) => {
  const user = profile.userId;

  if (!user) return null;

  return {
    _id: profile._id,
    id: profile._id?.toString?.(),
    userId: user._id?.toString?.(),
    name: user.fullName || '',
    title: profile.title || '',
    email: user.email || '',
    phone: user.phone || '',
    photoUrl: user.avatar || '',
    githubUrl: user.github || '',
    linkedinUrl: user.linkedin || '',
    portfolioUrl: user.portfolio || '',
    skills: normalizeDeveloperSkills(user.skills),
    status: profile.status || 'pending',
    rejectionReason: profile.rejectionReason || '',
    submittedAt: profile.submittedAt || profile.createdAt,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
    memberSince: user.createdAt || profile.submittedAt || profile.createdAt,
    department: user.section || user.batch || 'CPCCU',
  };
};

const listPublicContent = async (req, res) => {
  const resource = req.params.resource;

  // THE BESPOKE GALLERY BRANCH, and it exists because gallery items are not
  // standalone content: each one belongs to an event, and the public gallery
  // renders the event's title, description and date next to the image. The
  // generic path below would return bare items with an unpopulated `eventId`
  // string, so this branch joins the three fields explicitly rather than
  // shipping the whole populated `Event` document (which would leak the event's
  // internal fields to an anonymous caller).
  //
  // Note it bypasses the whitelist entirely: `'gallery'` is in `publicModels` as
  // well, so the 404 for an unknown resource below is unaffected — this branch
  // simply returns earlier. It also means the gallery is NOT filtered by
  // anything, deliberately: there is no status field on a gallery item.
  if (resource === 'gallery') {
    const galleryItems = await GalleryItem.find({})
      .populate('eventId', 'title description eventDate')
      .sort({ order: 1, createdAt: -1 });

    const items = galleryItems.map((item) => ({
      ...item.toObject(),
      eventTitle: item.eventId?.title,
      eventDescription: item.eventId?.description,
      eventDate: item.eventId?.eventDate,
    }));

    return res.status(200).json(new ApiResponse(200, items, 'Gallery items'));
  }

  const Model = publicModels[resource];

  if (!Model) {
    throw new ApiError(404, 'Public content resource not found');
  }

  // TWO per-resource visibility filters, both business rules rather than
  // implementation detail:
  //  - `donators`: `{ isAnonymous: { $ne: true } }`. `$ne` rather than
  //    `isAnonymous: false` on purpose — a donator record created before the
  //    flag existed has NO `isAnonymous` field at all, and `$ne: true` matches
  //    those, so they stay public. An equality test would silently unlist every
  //    legacy donator. This is the one place in the API where an anonymity
  //    decision is enforced in a query rather than by omitting the field.
  //  - `profiles`: `{ status: 'approved' }`. Only admin-approved developer
  //    profiles are public; `pending` and `rejected` are admin-only states.
  const query =
    resource === 'donators'
      ? { isAnonymous: { $ne: true } }
      : resource === 'profiles'
        ? { status: 'approved' }
        : {};

  // The `profiles` branch gets its OWN handler, immediately after the `query`
  // above has already been computed and then not used. That is dead work in the
  // original (one unused object literal, no extra round trip) and is preserved
  // so the diff against the source stays clean. The real differences from the
  // generic path are: an EXTRA condition on the query
  // (`userId: { $exists: true, $ne: null }` — a profile with no user cannot be
  // rendered, so it is filtered in the database rather than in JS), a
  // `.populate('userId')` join, a DIFFERENT sort (`submittedAt` first, because
  // the public page is ordered by how recently a developer was approved, not by
  // the `order` field the other collections use), and the `formatDeveloperProfile`
  // projection.
  if (resource === 'profiles') {
    const profileItems = await Model.find({
      status: 'approved',
      userId: { $exists: true, $ne: null },
    })
      .populate('userId')
      .sort({ submittedAt: -1, createdAt: -1 });
    const items = profileItems.map(formatDeveloperProfile).filter(Boolean);

    return res
      .status(200)
      .json(new ApiResponse(200, items, 'Public content data'));
  }

  // Generic path: `query` is `{}` for every remaining resource, so all
  // alumni, contributors, committee members, events and gallery-events are
  // returned. Sorted by `order` then `createdAt: -1` — the same convention as
  // every other listing in this API.
  const items = await Model.find(query).sort({ order: 1, createdAt: -1 });

  return res
    .status(200)
    .json(new ApiResponse(200, items, 'Public content data'));
};

const getPublicStatistics = async (req, res) => {
  // Same real values served to the admin panel — the public site and the
  // admin Site Statistics page always represent the same underlying data.
  // Deliberately the SAME service the admin statistics endpoint uses rather
  // than a cheaper public-only aggregate: a public counter that disagreed with
  // the admin one would be a visible inconsistency, and the collection sizes
  // this site has are not a performance concern.
  const stats = await getSiteStatistics();

  return res
    .status(200)
    .json(new ApiResponse(200, stats, 'Public site statistics'));
};

export { getPublicStatistics, listPublicContent };
