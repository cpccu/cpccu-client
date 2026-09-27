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
 * ================= ONE API INSTANCE IS ALL THIS ENDPOINT EVER NEEDED =================
 * Certificate verification is served by the SINGLE RTK Query API instance
 * (`src/services/baseApi.js` -> `src/features/certificate/certificateApi.js`)
 * at `/certificates/verify/:certificateId` — an ordinary endpoint on the
 * existing `/api/v1` base URL. A second `createApi` instance is never needed
 * again, and reintroducing one here would be a regression, not a fix.
 *
 * WHY ONE USED TO EXIST (history, so nobody "restores" it). A standalone
 * instance named `publicApi` was created because the Express backend mounted
 * verification at the ROOT path, outside the `/api/v1` base URL:
 *
 *     app.get('/verify/:certificateId', asyncHandler(verifyCertificatePublic))
 *     -- cpccu-server/src/app.js:76
 *
 * With verification unreachable under the base URL, a second instance with a
 * `baseUrl` that stripped `/api/v1` was the only way to hit that one endpoint.
 * That rewrite is now obsolete, and `publicApi` has been deleted along with its
 * store registration. Nothing about THIS route requires it.
 *
 * ================= THE ROOT PATH IS NOT MIGRATED, AND CANNOT BE =================
 * `/verify/:certificateId` is not merely un-migrated, it is not a legal file to
 * add: `src/app/verify/[certificateId]/page.jsx` already occupies that segment
 * and App Router forbids a `page.jsx` and a `route.js` at the same segment (the
 * build fails on the conflict). See the block above for that in full.
 *
 * CONSEQUENCE FOR ANY CLIENT STILL CALLING THE ROOT PATH: it does not 404, and
 * that is the danger. `/verify/${certificateId}` resolves to the client-side
 * verification PAGE, so the caller silently receives rendered HTML where it
 * expected JSON — no exception, no failed build, no network error to grep for.
 * This route is therefore THE canonical replacement; point any remaining caller
 * at `/api/v1/certificates/verify/:certificateId` and treat a JSON parse failure
 * on the root path as this exact cause.
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

export const GET = defineRoute('GET', {
  public: true,
  controller: verifyCertificatePublic,
});
