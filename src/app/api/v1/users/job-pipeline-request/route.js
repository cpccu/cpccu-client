import {
  removeJobPipelineProfile,
  requestJobPipelineProfile,
} from '@/lib/server/controllers/user.controller';
import { defineRoute } from '@/lib/server/handler';

/**
 * `/api/v1/users/job-pipeline-request` — submit or withdraw a job-pipeline
 * profile. Two methods, one file.
 *
 * App Router supports MULTIPLE METHOD EXPORTS PER FILE, and this mirrors the
 * Express original, where a single `router.route(...)` chained both verbs:
 *
 *     router.route('/job-pipeline-request')
 *          .post(verifyToken, requestJobPipelineProfile)
 *          .delete(verifyToken, removeJobPipelineProfile)
 *
 * One router file per mount became one App Router file per PATH with one export
 * per METHOD. URLs, verbs, auth requirement and handlers are unchanged.
 *
 * BOTH ARE AUTHENTICATED (`public` absent). The `POST` is the workflow entry
 * point: every submission is written with `status: 'pending'` and a fresh
 * `submittedAt`, INCLUDING a resubmission, because the admin queue sorts on that
 * field and a member who re-submits after a rejection must return to the top of
 * it. `DELETE` withdraws the caller's own profile only.
 */

// `nodejs` because these routes reach `mongoose` and `jsonwebtoken`, neither of
// which is Edge-compatible. `force-dynamic` because `DELETE` reads the auth
// cookie and both verbs must never be prerendered or cached.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const POST = defineRoute('POST', {
  controller: requestJobPipelineProfile,
});

export const DELETE = defineRoute('DELETE', {
  controller: removeJobPipelineProfile,
});
