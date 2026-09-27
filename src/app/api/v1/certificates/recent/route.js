import { getRecentCertificates } from '@/lib/server/controllers/certificate.controller';
import { defineRoute } from '@/lib/server/handler';

/**
 * `GET /api/v1/certificates/recent` — the most recently issued certificates.
 *
 * `public: true` because the list is rendered on the public certificates page
 * with no session.
 *
 * ENVELOPE: `{ success, data }`, NOT `ApiResponse`. Not normalised.
 *
 * `recent` is a STATIC segment. It does not collide with
 * `verify/[certificateId]` because those are siblings under
 * `certificates/`, not nested — and even against a dynamic sibling, App Router
 * resolves static segments first, which is the same ordering the Express router
 * relied on.
 */

// `nodejs` because this route reaches `mongoose`, which is not Edge-compatible.
// `force-dynamic` because it reads the database on every request and must never
// be prerendered into a static list at build time.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = defineRoute('GET', {
  public: true,
  controller: getRecentCertificates,
});
