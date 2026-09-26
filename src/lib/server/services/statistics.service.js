import 'server-only';

import { VISITOR_RECORD_NAME } from '@/lib/server/constants';
import {
  CertificateVerificationLog,
  Event,
  GalleryItem,
} from '@/lib/server/models/adminContent.model';
import { Certificate } from '@/lib/server/models/certificate.model';
import { User } from '@/lib/server/models/user.model';
import { Visitor } from '@/lib/server/models/visitor.model';

/**
 * Port of `cpccu-server/src/services/statistics.service.js`.
 *
 * THE CIRCULAR IMPORT IS GONE, AND THAT WAS THE POINT.
 * The Express original imported the constant like this:
 *
 *     import { VISITOR_RECORD_NAME } from '../controllers/visitor.controller.js';
 *
 * which is a genuine cycle: the visitor controller imports models, the models
 * are shared, and the statistics service imported the CONTROLLER. ES modules
 * tolerate a cycle only when the imported binding is not READ during module
 * evaluation, which makes the whole thing evaluation-ORDER dependent — and that
 * order changes under a bundler. Next's bundler does not guarantee the
 * evaluation order Express's runtime loader happened to produce, so the binding
 * can be observed as `undefined`, and the failure mode is silent: the query
 * becomes `findOne({ name: undefined })`, which matches nothing (or, worse, an
 * arbitrary document) and the homepage visitor counter reads 0 forever.
 *
 * `VISITOR_RECORD_NAME` now lives in `@/lib/server/constants`, which is a LEAF
 * module with no imports at all, so the value cannot participate in a cycle no
 * matter how the graph is ordered. Importing it from here, and from the visitor
 * controller, keeps ONE definition of the key.
 */

/**
 * Certificate types that represent a recognized winner/achievement.
 * This is the exact classification used by the public certificate
 * verification page (getCertificateStatsService) so the admin
 * statistics always match the public "Winners Recognized" count.
 *
 * The list is INTENTIONALLY IDENTICAL to the `$in` array in
 * `certificate.service.js`. If the two ever drift, the admin dashboard and the
 * public page report different winners for the same data, and neither number is
 * wrong enough to look like a bug. Change both together.
 *
 * Four of the six values are not in the `certificateType` enum on the model and
 * are legacy-only; they are kept so historical documents still count.
 */
const WINNER_CERTIFICATE_TYPES = [
  'winner',
  'runner-up',
  'top-performer',
  '1st-place',
  '2nd-place',
  '3rd-place',
];

/**
 * Aggregates the real site statistics from the existing CPCCU data sources.
 *
 * This is the single source of truth used by both the admin
 * (`GET /admin/statistics`) and public (`GET /content/statistics`) endpoints,
 * so every consumer always sees the same live values.
 *
 * All counts are performed server-side with countDocuments()/findOne() —
 * no collection is loaded into memory just to count it.
 */
export const getSiteStatistics = async () => {
  // NINE INDEPENDENT ROUND TRIPS, FANNED OUT IN PARALLEL VIA `Promise.all`.
  // They share no data, so serialising them would multiply the endpoint's
  // latency by nine; running them concurrently costs nine concurrent Mongo
  // round trips within the single pooled connection instead. Every branch is a
  // `countDocuments()`/`findOne()` — a server-side count, never a `find()` that
  // would pull whole collections into memory just to read `.length`.
  const [
    members,
    photos,
    events,
    contestsHeld,
    certificatesIssued,
    winnersRecognized,
    certificateVerifications,
    failedCertificateVerifications,
    visitor,
  ] = await Promise.all([
    // Total Members — every record in the Members (User) collection.
    // NO `isValid: true` filter, matching the original: this is a head-count of
    // registered accounts, so unverified sign-ups and accounts that are merely
    // soft-disabled are both included.
    User.countDocuments(),
    // Gallery Photos — individual photos in the public Gallery (GalleryItem),
    // i.e. NOT GalleryEvent, which is the event that groups them.
    GalleryItem.countDocuments(),
    // Total Events — every event in the Events collection
    Event.countDocuments(),
    // Contests Held — events classified as contests by the Event type field.
    // `Event.type` is a free-form string with no enum, so the literal 'contest'
    // is matched exactly (case- and whitespace-sensitive) — see the note on
    // `type` in `adminContent.model.js`.
    Event.countDocuments({ type: 'contest' }),
    // Certificates Issued — every certificate record
    Certificate.countDocuments(),
    // Winners Recognized — certificates with a winner/achievement type
    Certificate.countDocuments({
      certificateType: { $in: WINNER_CERTIFICATE_TYPES },
    }),
    // Certificate Verifications — successful verification log entries
    CertificateVerificationLog.countDocuments({ success: true }),
    // Failed Verifications — unsuccessful verification log entries
    CertificateVerificationLog.countDocuments({ success: false }),
    // Total Visitors — the same record the homepage visitor counter reads,
    // located by the SINGLETON key from `@/lib/server/constants`.
    Visitor.findOne({ name: VISITOR_RECORD_NAME }),
  ]);

  return {
    members,
    photos,
    events,
    // Fail-open to 0: if the singleton counter document does not exist yet
    // (fresh database, or before the first request that increments it) this
    // endpoint reports zero visitors rather than failing. Note `|| 0` would also
    // map a legitimate count of 0 to 0, which is why the `?.` and the `||` are
    // both harmless here and the fallback is only ever the missing-document case
    // that matters.
    totalVisitors: visitor?.count || 0,
    certificatesIssued,
    certificateVerifications,
    failedCertificateVerifications,
    contestsHeld,
    winnersRecognized,
  };
};
