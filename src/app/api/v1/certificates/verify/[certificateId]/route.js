import { verifyCertificatePublic } from '@/lib/server/controllers/certificate.controller';
import { defineRoute } from '@/lib/server/handler';

/**
 * `GET /api/v1/certificates/verify/:certificateId` — THE CANONICAL REPLACEMENT for
 * the unmigrated root-level `GET /verify/:certificateId`.
 *
 * ================= WHY THE ROOT `/verify/:certificateId` IS NOT MIGRATED =================
 * The Express backend mounted it at the very top of `app.js`:
 *
 *     app.get('/verify/:certificateId', asyncHandler(verifyCertificatePublic))
 *
 * In App Router that is `src/app/verify/[certificateId]/route.js` — and
 * `src/app/verify/[certificateId]/page.jsx` ALREADY EXISTS (the human-facing
 * verification page). App Router FORBIDS a `page.jsx` and a `route.js` at the
 * same segment; the build fails on the conflict. Creating the route is therefore
 * not an oversight to be tidied up in a later phase, it is not a legal file.
 * This route is the canonical replacement, and it runs the SAME controller
 * (`verifyCertificatePublic`) the root route ran, so the response is identical.
 *
 * ================= ACTION REQUIRED BY THE FRONTEND TASK =================
 * `src/features/certificate/certificateApi.js` builds a SEPARATE, STANDALONE RTK
 * Query API instance called `publicApi` whose `verifyById` hits
 * `/verify/${certificateId}` — i.e. the ROOT path. `publicApi` exists ONLY
 * because the backend exposed verification outside the `/api/v1` base URL, which
 * is the entire reason a second `createApi` instance was needed. Now that
 * verification lives under `/api/v1`, that second instance should be DELETED and
 * its `verifyById` folded into the main `certificateApi`, or its URL repointed at
 * `certificates/verify/${certificateId}`.
 *
 * THIS IS A DOCUMENTED BREAKING PATH CHANGE FOR THE CLIENT, DEFERRED TO THAT
 * TASK. It is called out here rather than left implicit because the breakage is
 * not a 404 the developer will notice at build time — `publicApi` hitting a
 * client-side route would silently render the verification PAGE as if it were
 * JSON, which is the kind of failure that survives review.
 *
 * `public: true` — same justification as the search variant, including the fact
 * that every attempt writes a `CertificateVerificationLog` whether it succeeds or
 * not, which is the audit trail.
 *
 * ENVELOPE: `{ success, data }` / `{ success: false, message }`, NOT
 * `ApiResponse`. Not normalised.
 *
 * The 404 message here ('Certificate not found or invalid') differs from the
 * search route's ('Certificate not found'), and that is correct rather than
 * sloppy: a path segment is client-visible and a wrong one is at least as likely
 * as a missing one. Preserved.
 */

// `nodejs` because this route reaches `mongoose`, which is not Edge-compatible.
// `force-dynamic` because it writes a verification log row and reads a dynamic
// segment, so it must never be prerendered or cached.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = defineRoute({
  method: 'GET',
  public: true,
  controller: verifyCertificatePublic,
});
