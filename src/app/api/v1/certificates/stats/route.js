import { getCertificateStats } from '@/lib/server/controllers/certificate.controller';
import { defineRoute } from '@/lib/server/handler';

/**
 * `GET /api/v1/certificates/stats` — public certificate counters.
 *
 * `public: true` because the counters are rendered on public pages with no
 * session, and the projection is aggregate counts only — no member data.
 *
 * ENVELOPE: `{ success, data }`, NOT `ApiResponse`. Not normalised; see
 * `response.js` on why the four envelopes must coexist.
 *
 * `stats` is a STATIC segment and is matched literally, ahead of the sibling
 * `verify/[certificateId]`. App Router resolves static segments before dynamic
 * ones, so nothing is shadowed — and a request for
 * `/api/v1/certificates/stats` never reaches the `[certificateId]` handler with
 * `certificateId === 'stats'`, which is the same ordering property the Express
 * router relied on by registering `/verify` and `/stats` before
 * `/verify/:certificateId`.
 */

// `nodejs` because this route reaches `mongoose`, which is not Edge-compatible.
// `force-dynamic` because it reads the database on every request and must never
// be prerendered into static counters at build time.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = defineRoute('GET', {
  public: true,
  controller: getCertificateStats,
});
