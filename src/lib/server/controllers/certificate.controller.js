import 'server-only';

import { CertificateVerificationLog } from '@/lib/server/models/adminContent.model';
import {
  getCertificateStatsService,
  getRecentCertificatesService,
  verifyCertificateService,
} from '@/lib/server/services/certificate.service';

/**
 * Port of `cpccu-server/src/controllers/certificate.controller.js`.
 *
 * ============================ THE ODD ONE OUT ============================
 * These four handlers do NOT use `ApiError` or `ApiResponse`. They have their
 * own envelope, which `response.js` documents as envelope #3 of the four that
 * coexist in this codebase:
 *
 *     success ->  { success: true,  data }
 *     failure ->  { success: false, message }        (404 only)
 *
 * That is NOT the same as the `{ statusCode, data, message, success }` an
 * `ApiResponse` produces, and it is not the `{ status, message, errors }` an
 * `ApiError` produces. In particular there is no `status` key at all — a client
 * that reads `body.status` here gets `undefined`. Do not "helpfully" wrap these
 * in `ApiResponse`; that is an API-breaking change to whichever client branch
 * reads `success`.
 *
 * `next(error)` BECOMES A RETHROW. This is the ONE controller in the whole
 * migration that uses Express's third argument: the Express error handler in
 * `app.js:78-117` is a direct port in `errors.js`, so `next(error)` and
 * `throw error` produce the IDENTICAL response through the identical code
 * path. `toErrorResponse` in `errors.js` reproduces all four branches of that
 * handler, and `apiRoute` calls it for anything a handler throws. So each
 * `catch (error) { next(error); }` below is a `catch (error) { throw error; }`
 * — an exact substitution, not an approximation, and the only reason it is not
 * simply deleted is that keeping the `try`/`catch` visible makes the
 * line-for-line correspondence with the original auditable.
 *
 * There is no behavioural consequence either way: the `catch` had no `return`,
 * so after calling `next` the function fell off the end and resolved to
 * `undefined`, which the route discarded.
 */

/**
 * Aggregate certificate counts for the public stats page.
 *
 * Failures are NOT swallowed — see the module docblock. In the original a
 * Mongo outage here produced the Express `500 { status, message }` envelope with
 * no `errors` key; it does the same now.
 */
export const getCertificateStats = async (req, res) => {
  try {
    const stats = await getCertificateStatsService();
    return res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    throw error;
  }
};

/** The most recently issued certificates, for the public verification page. */
export const getRecentCertificates = async (req, res) => {
  try {
    const certificates = await getRecentCertificatesService();
    return res.status(200).json({
      success: true,
      data: certificates,
    });
  } catch (error) {
    throw error;
  }
};

/**
 * Certificate verification by QUERY PARAMETERS (`?certificateId=` OR
 * `?recipientName=&recipientId=`), which is why it accepts three inputs and
 * delegates the disambiguation to `verifyCertificateService`.
 *
 * THE RETURN SHAPE DEPENDS ON THE INPUT, and this is a genuine API quirk rather
 * than an accident of this port. `verifyCertificateService` returns an ARRAY
 * when it searches by name (a name is not unique — two people can share one) and
 * a single DOCUMENT when it is given a certificate id. So `data` on the 200 is
 * sometimes an object and sometimes an array, and a client must know which query
 * it issued to interpret the response. The `Array.isArray` test below is
 * therefore not defensive coding — it is how the handler decides whether
 * anything was found.
 */
export const verifyCertificate = async (req, res) => {
  try {
    const { certificateId, recipientName, recipientId } = req.query;

    const certificate = await verifyCertificateService({
      certificateId,
      recipientName,
      recipientId,
    });
    const found = Array.isArray(certificate)
      ? certificate.length > 0
      : Boolean(certificate);

    // EVERY verification writes a `CertificateVerificationLog`, on BOTH the
    // success and the not-found path. That is the point: the log is an audit
    // trail of verification ATTEMPTS, so a series of failed lookups against a
    // real certificate number is exactly the signal an administrator wants, and
    // a log that only recorded successes would hide it.
    //
    // The `certificateId || recipientId || recipientName || 'unknown'` chain is
    // the recorded identifier for a FAILED search, and the ordering means the
    // most specific input available wins. A successful search records
    // `'search'` instead — the certificate was found, so there is no single
    // input that identified it, and logging the search term would be misleading.
    if (!found) {
      await CertificateVerificationLog.create({
        certificateId:
          certificateId || recipientId || recipientName || 'unknown',
        success: false,
        ip: req.ip,
        userAgent: req.get('user-agent') || '',
      });
      return res.status(404).json({
        success: false,
        message: 'Certificate not found',
      });
    }
    await CertificateVerificationLog.create({
      certificateId: certificateId || recipientId || recipientName || 'search',
      success: true,
      ip: req.ip,
      userAgent: req.get('user-agent') || '',
    });

    return res.status(200).json({
      success: true,
      data: certificate,
    });
  } catch (error) {
    throw error;
  }
};

/**
 * Certificate verification by PATH SEGMENT (`/verify/:certificateId`), used by
 * the link a recipient follows from their email.
 *
 * Narrower than `verifyCertificate` above: it takes exactly one input, so
 * `verifyCertificateService` always returns a single document and `data` is
 * never an array. The 404 message is also different ('not found or invalid'
 * rather than 'not found'), which is correct here — a path segment is
 * client-visible and a wrong one is as likely as a missing one.
 */
export const verifyCertificatePublic = async (req, res) => {
  try {
    const { certificateId } = req.params;

    const certificate = await verifyCertificateService({
      certificateId,
    });

    if (!certificate) {
      await CertificateVerificationLog.create({
        certificateId,
        success: false,
        ip: req.ip,
        userAgent: req.get('user-agent') || '',
      });
      return res.status(404).json({
        success: false,
        message: 'Certificate not found or invalid',
      });
    }
    await CertificateVerificationLog.create({
      certificateId,
      success: true,
      ip: req.ip,
      userAgent: req.get('user-agent') || '',
    });

    return res.status(200).json({
      success: true,
      data: certificate,
    });
  } catch (error) {
    throw error;
  }
};
