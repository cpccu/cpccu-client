/*
 * Builds the `<head>` for a public certificate page, from the database.
 *
 * SERVER-ONLY BY CONSTRUCTION. `import 'server-only'` is asserted here (not
 * just inherited from the service) so that a Client Component importing this
 * module fails the build loudly at the import site, instead of dragging Mongoose
 * into the browser bundle. Its one importer,
 * `src/app/(main)/certificate/[certificateId]/page.jsx`, is a Server Component
 * (it awaits `params` and has no `'use client'`).
 *
 * TWO REMOVALS WORTH RECORDING, BOTH OF WHICH WERE SILENT FAILURES:
 *
 * 1. THE `API_BASE_URL` DEFAULT IS GONE, AND WITH IT AN ENTIRE CLASS OF BUG.
 *    This file used to build a URL from
 *    `process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000/api/v1'`.
 *    `.env.sample:31-39` documents that variable as STALE — it still points at
 *    the retired Express origin. A wrong or unset value did not throw: the fetch
 *    failed, the `catch` ran, and `getFallbackMetadata` returned
 *    `robots: { index: false, follow: false }`. The site built, deployed, served
 *    200s, and logged nothing alarming — while every certificate page silently
 *    became `noindex` and dropped out of search results. Reading the database
 *    directly removes the environment variable from this code path entirely, so
 *    that failure can no longer occur here.
 *
 * 2. `credentials: 'include'` WAS MEANINGLESS AND HAS BEEN REMOVED. There is no
 *    cookie jar on the server side of a Server Component render; the option
 *    applied to nothing. Leaving it in was actively misleading, because it
 *    reads as "this request is authenticated" to the next person who opens the
 *    file. The verify endpoint is `public: true` anyway — it has to be, since
 *    the whole point is that a logged-out recipient can check their certificate.
 */
import 'server-only';

import { getDb } from '@/lib/server/db';
import { verifyCertificateService } from '@/lib/server/services/certificate.service';

const SITE_NAME = 'Competitive Programming Camp City University';
const SITE_URL = 'https://www.cpccu.club';
const OG_IMAGE = `${SITE_URL}/cpccu.png`;
const FALLBACK_CERTIFICATE_TITLE = 'Certificate Verification | CPCCU';
const FALLBACK_CERTIFICATE_DESCRIPTION = 'Verify certificates issued by Competitive Programming Camp City University.';

const CERTIFICATE_TYPE_LABELS = {
  winner: 'Winner',
  'runner-up': 'Runner Up',
  'top-performer': 'Top Performer',
  participation: 'Participation',
};

function formatCertificateType(type) {
  if (!type) return '';
  return CERTIFICATE_TYPE_LABELS[type] || type.replace(/-/g, ' ');
}

function getCertificateTypeLabel(certificate) {
  const type = certificate?.certificateType;
  if (!type) return '';
  return formatCertificateType(type);
}

function getFallbackMetadata(certificateId) {
  const canonicalUrl = certificateId ? `${SITE_URL}/certificate/${certificateId}` : `${SITE_URL}/certificate`;

  return {
    title: FALLBACK_CERTIFICATE_TITLE,
    description: FALLBACK_CERTIFICATE_DESCRIPTION,
    alternates: {
      canonical: canonicalUrl,
    },
    robots: {
      index: false,
      follow: false,
    },
    openGraph: {
      title: FALLBACK_CERTIFICATE_TITLE,
      description: FALLBACK_CERTIFICATE_DESCRIPTION,
      url: canonicalUrl,
      siteName: SITE_NAME,
      type: 'website',
      locale: 'en_US',
      images: [OG_IMAGE],
    },
    twitter: {
      card: 'summary_large_image',
      title: FALLBACK_CERTIFICATE_TITLE,
      description: FALLBACK_CERTIFICATE_DESCRIPTION,
      images: [OG_IMAGE],
    },
  };
}

export async function getCertificateMetadata(certificateId) {
  if (!certificateId || typeof certificateId !== 'string') {
    return getFallbackMetadata(certificateId);
  }

  // ==========================================================================
  // WHY THIS CALLS THE SERVICE INSTEAD OF THE HTTP ENDPOINT
  // ==========================================================================
  // `GET /api/v1/certificates/verify` writes ONE `CertificateVerificationLog`
  // row per REQUEST — on the found path and the not-found path alike
  // (`src/app/api/v1/certificates/verify/route.js:34-36` ->
  // `src/lib/server/controllers/certificate.controller.js:113-131`). The audit
  // write lives in the CONTROLLER, not in `certificate.service.js`, which is
  // pure Mongoose reads. So the service call below is the same lookup with the
  // audit side effect removed.
  //
  // Both the metadata path (`generateMetadata` in
  // `src/app/(main)/certificate/[certificateId]/page.jsx`) and the client path
  // (`useEffect` -> `useLazyVerifyCertificateQuery` in
  // `src/components/CERTIFICATE/verify-form.jsx`) used to hit the endpoint, so
  // ONE human page view produced TWO audit rows — permanently doubling the
  // `certificateVerifications` / `failedCertificateVerifications` counters that
  // `src/lib/server/services/statistics.service.js:110-112` publishes on both
  // the public and the admin dashboard. Reading via the service leaves exactly
  // ONE row per human page view (the client fetch), which is the intent: the
  // audit trail records people verifying certificates, not render passes.
  //
  // The call shape is deliberately IDENTICAL to the one the controller uses
  // (`verifyCertificateService({ certificateId, recipientName, recipientId })`,
  // `certificate.controller.js:94-98`) so the metadata lookup cannot drift away
  // from the lookup the audit log is written against — a different filter here
  // would make the row and the title disagree about the same certificate. Only
  // `certificateId` is passed, so the service takes its `findOne` branch and
  // returns a single document (never an array), which is what the field reads
  // below assume.
  try {
    // The connection is opened explicitly, exactly as a route handler does
    // (`getDb` in `src/lib/server/db.js`). Mongoose buffers commands for ~10 s
    // when it has no connection rather than failing fast, so skipping this would
    // add a ten-second hang to every certificate page view instead of an error.
    await getDb();

    const certificate = await verifyCertificateService({ certificateId });

    if (!certificate) {
      console.log('[Certificate Metadata] Certificate not found:', {
        certificateId,
        reasonForFallback: 'No certificate document matched this id',
      });
      return getFallbackMetadata(certificateId);
    }

    const recipientName = certificate.recipientName || 'CPCCU';
    const contestName = certificate.contestName || '';
    const certificateType = getCertificateTypeLabel(certificate);

    const canonicalUrl = `${SITE_URL}/certificate/${certificateId}`;

    const title = `Certificate Verification | ${recipientName}`;
    const description = `Verified ${certificateType} Certificate.\n\nRecipient:\n${recipientName}\n\nContest:\n${contestName}\n\nIssued by Competitive Programming Camp City University.`;
    const ogDescription = `Verified ${certificateType} Certificate.\n\nRecipient:\n${recipientName}\n\nContest:\n${contestName}`;

    return {
      title,
      description,
      alternates: {
        canonical: canonicalUrl,
      },
      robots: {
        index: true,
        follow: true,
      },
      openGraph: {
        title,
        description: ogDescription,
        url: canonicalUrl,
        siteName: SITE_NAME,
        type: 'website',
        locale: 'en_US',
        images: [OG_IMAGE],
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description: ogDescription,
        images: [OG_IMAGE],
      },
    };
  } catch (error) {
    // NEVER THROW FROM HERE. `generateMetadata` has no error boundary of its
    // own: anything it throws takes down the whole page render, not just the
    // <head>. A database blip must degrade to the generic title, which is what
    // `getFallbackMetadata` is for.
    console.log('[Certificate Metadata] Lookup error:', {
      certificateId,
      error: error.message,
      reasonForFallback: 'Certificate lookup threw an exception',
    });
    return getFallbackMetadata(certificateId);
  }
}
