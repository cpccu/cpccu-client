import 'server-only';

import { Certificate } from '@/lib/server/models/certificate.model';

/**
 * Port of `cpccu-server/src/services/certificate.service.js`.
 * Pure Mongoose — no Express, no `req`/`res`.
 */

/**
 * Escapes a user-supplied string for safe use inside a Mongo `$regex`.
 *
 * WITHOUT THIS, a recipient name containing regex metacharacters is a ReDoS /
 * logic-injection vector: `(a+)+$` or `.*` typed into the public verification
 * form is handed straight to the database as a pattern, matching far more rows
 * than the user asked for (and `.*` alone makes the query scan the whole
 * collection). Escaping every metacharacter makes the value a LITERAL string
 * match, which is what "search for this person's certificates" means.
 *
 * The character class covers the full set of regex metacharacters
 * (`. * + ? ^ $ { } ( ) | [ ] \`) and the replacement `\\$&` re-emits the
 * matched character after a backslash.
 */
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * The public certificate lookup.
 *
 * RETURN TYPE IS EITHER A DOCUMENT OR AN ARRAY, AND THE CONTROLLER DEPENDS ON
 * THAT DISTINCTION — this is not an oversight to be tidied up:
 *  - `certificateId` given  -> a single `Certificate` DOCUMENT (or `null`).
 *    This is the "verify this exact certificate number" path, and the
 *    controller reads `.recipientName` etc. directly off the result. Returning
 *    an array here would make every field access `undefined` and the handler
 *    would report "invalid certificate" for a perfectly valid one.
 *  - `certificateId` absent -> an ARRAY of certificates, matched by recipient
 *    name and/or recipient ID.
 *
 * A caller must therefore branch on its own input before touching the result.
 * Do not normalise this to always-return-an-array.
 */
export const verifyCertificateService = async ({
  certificateId,
  recipientName,
  recipientId,
}) => {
  const query = {};

  if (certificateId) {
    query.certificateId = certificateId.trim();
    return await Certificate.findOne(query);
  }

  // `recipientName` is a SUBSTRING match, case-insensitive: users type a partial
  // name ("Rahim" for "Abdur Rahim") and expect to find their certificates.
  if (recipientName) {
    query.recipientName = {
      $regex: escapeRegex(recipientName.trim()),
      $options: 'i',
    };
  }

  // `recipientId` is an ANCHORED exact match (`^...$`) even though it is
  // case-insensitive — it is an identifier, not a name, so a prefix or a
  // substring of somebody else's ID must not match. The anchors are the whole
  // point of the difference from the name search above.
  if (recipientId) {
    query.recipientId = {
      $regex: `^${escapeRegex(recipientId.trim())}$`,
      $options: 'i',
    };
  }

  // Newest first. `issueDate` is the semantic date and `createdAt` breaks ties
  // between certificates issued on the same day (e.g. one contest, several
  // placements) deterministically — without the second key that ordering is
  // unstable across calls.
  return await Certificate.find(query).sort({ issueDate: -1, createdAt: -1 });
};

/**
 * Aggregate certificate statistics for the public verification page.
 */
export const getCertificateStatsService = async () => {
  // Total number of certificates issued
  const totalCertificates = await Certificate.countDocuments();

  // Total number of unique contests held
  const totalContests = (await Certificate.distinct('contestName')).length;

  // Calculate Total Participants:
  // 1. Every certificate counts as one participant entry, because one person can
  //    participate in multiple contests and each of those is a real
  //    participation we should not double-count within a single contest.
  //    NOTE: the original ran `Certificate.countDocuments()` a SECOND time here
  //    as `certificateCount`, producing a value identical to
  //    `totalCertificates` by definition and costing a redundant round trip.
  //    The second call is collapsed into `totalCertificates` below. The
  //    returned object is unchanged.
  const certificateCount = totalCertificates;

  // 2. Sum up the 'extraParticipants' field from unique contests.
  //    The aggregation GROUPS BY `contestName` and takes `$first` of
  //    `extraParticipants` before summing — the group-then-sum (rather than a
  //    plain `sum` over the collection) is what makes it "once per contest":
  //    a contest with 40 certificates carries the same head-count on every one
  //    of them, and summing naively would multiply it by 40.
  //    `$toInt` coerces in-database, so a value that was written as a string
  //    (pre-existing data) still adds up as a number instead of string-concatenating.
  const extraParticipantsData = await Certificate.aggregate([
    {
      $group: {
        _id: '$contestName',
        extra: { $first: '$extraParticipants' },
      },
    },
    {
      $project: {
        extra: { $toInt: { $ifNull: ['$extra', 0] } },
      },
    },
    {
      $group: {
        _id: null,
        totalExtra: { $sum: '$extra' },
      },
    },
  ]);

  // `$ifNull` inside the pipeline already defaults a missing value to 0, so the
  // `length > 0` test here only guards the case where the collection is empty
  // and the pipeline returned no rows at all.
  const totalExtra =
    extraParticipantsData.length > 0 ? extraParticipantsData[0].totalExtra : 0;
  // Total participants = every certificate holder, plus the non-certificate
  // participants of each contest.
  const totalParticipants = certificateCount + totalExtra;

  // Total winners recognized.
  // NOTE: four of these six values ('top-performer', '1st-place', '2nd-place',
  // '3rd-place') are NOT in the `certificateType` enum on the Certificate model
  // and can no longer be written through it. They are legacy values and the
  // clauses are kept so historical documents still count. Do not "tidy" the list
  // down to the enum without accepting that the public "Winners Recognized"
  // number would change.
  const totalWinners = await Certificate.countDocuments({
    certificateType: {
      $in: [
        'winner',
        'runner-up',
        'top-performer',
        '1st-place',
        '2nd-place',
        '3rd-place',
      ],
    },
  });

  return {
    totalCertificates,
    totalContests,
    totalParticipants,
    totalWinners,
  };
};

/**
 * The five most recently CREATED certificates.
 *
 * Sorted on `createdAt` and not `issueDate`: this feeds an admin "recently
 * added" list, which is about when a row was entered, not when the contest ran.
 * `limit(5)` is the count; the original hard-coded it inline.
 */
export const getRecentCertificatesService = async () => {
  return await Certificate.find().sort({ createdAt: -1 }).limit(5);
};
