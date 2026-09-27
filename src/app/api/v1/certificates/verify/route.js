import { verifyCertificate } from '@/lib/server/controllers/certificate.controller';
import { defineRoute } from '@/lib/server/handler';

/**
 * `GET /api/v1/certificates/verify` — search-based certificate verification.
 *
 * `public: true` because the whole point of the endpoint is that a member who
 * is NOT logged in can check a certificate: it is linked from shareable
 * documents and read on the public site. Justified, and there is a second
 * reason it must be: EVERY verification writes a `CertificateVerificationLog`,
 * on the found path AND the not-found path. A series of failed lookups against a
 * real certificate number is the audit signal an administrator wants, so gating
 * this behind a login would destroy the trail it exists to produce.
 *
 * THE ENVELOPE IS `{ success, data }` ON SUCCESS AND `{ success: false, message }`
 * ON FAILURE — NOT `ApiResponse`, and deliberately NOT NORMALISED. This is
 * envelope #3 of the four documented in `response.js`. Collapsing the four into
 * one shape is an API-breaking change the frontend must be migrated against in
 * the same commit; doing it "while porting" would silently break whichever
 * client branch reads the removed key.
 *
 * `data` MAY BE AN ARRAY OR A SINGLE DOCUMENT depending on how many records the
 * search matched, which is why the controller's `Array.isArray` test is load-
 * bearing rather than defensive. Preserved.
 *
 * Takes its input from the QUERY STRING (`certificateId`, `recipientName`,
 * `recipientId`), which is why the sibling `[certificateId]` file exists as a
 * narrower, single-input variant for the link a recipient follows from their
 * email.
 */

// `nodejs` because this route reaches `mongoose`, which is not Edge-compatible.
// `force-dynamic` because it writes a verification log row per request and reads
// query parameters, so it must never be prerendered or cached.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = defineRoute('GET', {
  public: true,
  controller: verifyCertificate,
});
