import 'server-only';

import { Certificate } from '@/lib/server/models/certificate.model';
import { Post } from '@/lib/server/models/post.model';
import { User } from '@/lib/server/models/user.model';
import {
  AdminAuditLog,
  Alumni,
  CertificateVerificationLog,
  ContactMessage,
  CommitteeMember,
  Contributor,
  DeveloperProfile,
  Donator,
  Event,
  GalleryEvent,
  GalleryItem,
  SystemSettings,
} from '@/lib/server/models/adminContent.model';
import { ApiError } from '@/lib/server/errors';
import { ApiResponse } from '@/lib/server/response';
import { assertCertificateIdUnique } from '@/lib/server/validation-helper';
import { uploadOnCloudinary } from '@/lib/server/cloudinary';
import { getSiteStatistics } from '@/lib/server/services/statistics.service';

/**
 * Port of `cpccu-server/src/controllers/adminContent.controller.js`.
 *
 * The whole write surface of the admin panel: one generic CRUD pair over eleven
 * collections (`/content/:resource`), the certificate issue/update/delete flow,
 * the site statistics read, the singleton system-settings document, the image
 * upload, and the GitHub-backed contributor metadata editor.
 *
 * `asyncHandler` is dropped, as in every ported controller: the shim's `res.json()`
 * returns a resolved promise, and a `throw` propagates out of the handler into
 * `apiRoute`, which shapes it through the same `toErrorResponse` the Express error
 * handler was ported into.
 *
 * This is NOT `certificate.controller.js`. Despite the name overlap, these
 * certificate handlers use the `ApiResponse` envelope (envelope #1), not the
 * `{ success, data }` shape of the public certificate endpoints. The distinction
 * is preserved; do not "align" them.
 *
 * ---------------------- TWO DIFFERENT THINGS NAMED "CONTRIBUTOR" ----------------------
 * This file contains two unrelated contributors, and conflating them would be a
 * real bug:
 *
 *  1. `models.contributors -> Contributor` — a MONGO collection. It backs the
 *     generic `/content/contributors` CRUD below and the public contributors
 *     page (`content.controller.js`). The admin panel can read, create, edit and
 *     delete documents in it.
 *  2. `GET /admin/contributors` and `PATCH /admin/contributors/:githubUsername` —
 *     the GitHub Contents API against
 *     `cpccu/cpccu-client@release:data/contributors.json`. There is no Mongo
 *     involvement at all: `listContributors` READS a JSON file out of another
 *     repository, and `updateContributorMetadata` WRITES it back through a commit.
 *
 * They are separate because the site is DEPLOYED FROM THAT FILE. A daily GitHub
 * Action regenerates `data/contributors.json` from the git history, so a
 * database-backed contributor list would be a second, conflicting source of
 * truth that the workflow knows nothing about. The file is the source of truth;
 * this controller is the admin-panel EDITOR for it, which is why a metadata
 * change is a push rather than a write.
 *
 * `CertificateVerificationLog` IS IMPORTED AND UNUSED, exactly as in the Express
 * original — nothing in this file writes a verification log; only the public
 * `certificate.controller.js` does. The import is kept rather than dropped so the
 * diff against the source stays line-for-line, and the model is referenced only in
 * a comment below.
 */

// ===== GitHub-synced contributors (single source of truth: data/contributors.json) =====

/**
 * The four coordinates of the one file the contributor editor reads and writes.
 *
 * The BRANCH is pinned to `release` rather than left at the repository default:
 * `data/contributors.json` exists on the release branch, and an unpinned read
 * would 404 the moment the default branch changed.
 */
const GITHUB_CONTRIBUTOR_OWNER = 'cpccu';
const GITHUB_CONTRIBUTOR_REPO = 'cpccu-client';
const GITHUB_CONTRIBUTOR_PATH = 'data/contributors.json';
const GITHUB_CONTRIBUTOR_BRANCH = 'release';

/**
 * The token used for BOTH the read and the write.
 *
 * A MISSING TOKEN IS A 503, NOT A 500 OR A SILENT EMPTY LIST, and that is a
 * deliberate contract: the contributors page is populated from a file this
 * process cannot reach without the secret, so returning `[]` would look to the
 * admin like "this site has no contributors" — a data-loss appearance — rather
 * than "a deployment is misconfigured". 503 also tells the caller the condition
 * is likely transient.
 *
 * The token is read from `process.env` per call, never memoised, so a rotated
 * secret takes effect without a redeploy of a warm instance. The error message
 * names the VARIABLE but never its value.
 */
const getGitHubToken = () => {
  const token = process.env.CONTRIBUTOR_GITHUB_TOKEN;
  if (!token) {
    throw new ApiError(
      503,
      'CONTRIBUTOR_GITHUB_TOKEN is not configured on the server. Add this secret so contributor metadata edits can be written back to the cpccu-client repository.',
    );
  }
  return token;
};

/**
 * The GitHub Contents API headers.
 *
 * `X-GitHub-Api-Version` pins the response shape so a GitHub-side default change
 * cannot silently alter the parsed body. The token is fetched through
 * `getGitHubToken()`, which is what makes the 503 above fire from inside the
 * header builder rather than at the call site.
 */
const githubContributorHeaders = () => ({
  Accept: 'application/vnd.github+json',
  Authorization: `Bearer ${getGitHubToken()}`,
  'X-GitHub-Api-Version': '2022-11-28',
});

/**
 * Per-attempt outbound budget for ONE GitHub Contents API call, in milliseconds.
 *
 * WHY A TIMEOUT IS NEEDED. `undici`'s defaults are `headersTimeout: 300e3` and
 * `bodyTimeout: 300e3` — five minutes — and `next.config.mjs` sets no
 * `maxDuration`, so a peer that completes the handshake and then stalls holds a
 * serverless invocation for the whole platform budget. Both call sites here are
 * OUTBOUND REQUESTS CARRYING A BEARER TOKEN (`githubContributorHeaders()` sets
 * `Authorization`), so an unbounded read is also an invitation to keep a
 * credentialed connection open for as long as the peer likes. This surface is
 * admin-only, so the exposure is bounded rather than anonymous, but the
 * hold-time costs nothing to bound and `AbortSignal.timeout` is a Node/undici
 * global — no dependency added. It aborts the underlying request, not merely the
 * awaiting promise, so the socket is actually released.
 *
 * WHY 10 SECONDS, AND WHY IT IS **PER ATTEMPT** RATHER THAN PER OPERATION. The
 * budget is deliberately NOT a whole-operation deadline for
 * `updateContributorMetadata`. That handler retries at most 3 times on a 409
 * (see the optimistic-concurrency loop below), and a shared deadline would make
 * the retry loop's behaviour depend on how much of the budget the earlier
 * attempts happened to consume — attempt 3 could be left with a few hundred
 * milliseconds, or none, turning a legitimate lost race into a spurious failure.
 * Per-attempt keeps the bound simple to reason about: "no single GitHub call
 * takes longer than this" holds regardless of how many times the loop iterates,
 * and the operation's true worst case becomes 3 × this for the write leg rather
 * than an unbounded 300s × 3.
 *
 * The 10s figure is comfortably above a healthy Contents-API round trip
 * (tens to low hundreds of ms) and far below the 300s it replaces. The honest
 * tradeoff is a rare 502 on a very slow link instead of a reliable stall.
 */
const GITHUB_REQUEST_TIMEOUT_MS = 10000;

/** Lower-cases and strips trailing slashes so URL comparisons are exact. */
const normalizeGithubUrl = (url) =>
  String(url || '')
    .toLowerCase()
    .replace(/\/+$/g, '');

/**
 * Normalises a handle to its bare username: trimmed, lower-cased, and with a
 * leading `@` removed. A bare username is what a URL segment contains, and the
 * file stores full URLs, so both sides have to be reduced to a common form before
 * they can be compared.
 */
const normalizeGithubUsername = (username) =>
  String(username || '')
    .trim()
    .toLowerCase()
    .replace(/^@/, '');

/**
 * Finds one contributor by GitHub handle, tolerating the three URL shapes the
 * file has accumulated over time.
 *
 * The file's `github` field is inconsistent by history: some entries are a bare
 * `https://github.com/<user>`, some the `http` variant, and some a longer profile
 * URL with extra path segments. The third test — `url.includes('github.com/')`
 * plus `url.split('/').pop() === user` — is what absorbs the last shape, and the
 * `includes` guard is what stops an unrelated URL (a blog post linking to a
 * GitHub profile, say) from being matched by its LAST SEGMENT alone. Without that
 * guard the third clause would match any URL whose last path segment happened to
 * equal the username.
 */
const findContributorByUsername = (contributors, username) => {
  const user = normalizeGithubUsername(username);
  if (!user) return null;
  return (
    contributors.find((c) => {
      const url = normalizeGithubUrl(c.github);
      return (
        url === `https://github.com/${user}` ||
        url === `http://github.com/${user}` ||
        (url.includes('github.com/') && url.split('/').pop() === user)
      );
    }) || null
  );
};

/**
 * Reads `data/contributors.json` from the `cpccu/cpccu-client` repository (release
 * branch) through the GitHub Contents API. This is the exact file the GitHub
 * Action regenerates daily while preserving batch/linkedin, so edits written
 * here are never overwritten by the next workflow run.
 *
 * OUTBOUND NETWORK CALL, and every failure mode is mapped to a 502 rather than
 * allowed to surface as a generic 500:
 *  - a network error, or a peer that stalls past `GITHUB_REQUEST_TIMEOUT_MS`
 *    and trips the `AbortSignal` -> 502, folded into the SAME branch as a
 *    non-2xx so the client error path is unchanged;
 *  - a non-2xx response (rate limit, bad token, 404 on the path) -> 502 with the
 *    upstream status in the field-error message, which is what makes a rate
 *    limit diagnosable from the client;
 *  - a 2xx with no `content` -> 502;
 *  - base64 that does not decode to JSON -> 502, and specifically NOT a 500 from
 *    the `JSON.parse` TypeError, because "the file upstream is malformed" is an
 *    upstream fault.
 * There is no retry and no caching: the file is small, the panel is the only
 * consumer, and a cached read would make the editor write back a stale `sha` and
 * collide with itself. (The retry that DOES exist is in the write leg, and it is
 * a 409 re-read, not a transport retry — a transport failure is not retried here
 * on purpose, so a timeout does not multiply into three stalls.)
 *
 * @returns `{ contributors, sha }` — the parsed array and the blob SHA the write
 *          leg below must present for the commit to be accepted.
 */
const fetchContributorsFile = async () => {
  const url = `https://api.github.com/repos/${GITHUB_CONTRIBUTOR_OWNER}/${GITHUB_CONTRIBUTOR_REPO}/contents/${GITHUB_CONTRIBUTOR_PATH}?ref=${GITHUB_CONTRIBUTOR_BRANCH}`;
  // THE `try` EXISTS FOR THE TIMEOUT, NOT FOR PARSING. Without it an abort (or
  // any transport error) escapes as a raw `DOMException`/`TypeError` and the
  // caller turns it into a generic 500 — "our server is broken" for a fault that
  // is entirely upstream. Mapping it to the 502 the non-2xx branch already
  // produces keeps the client's existing error path intact. The `field`/`message`
  // detail is included here even though the status is unknowable, because the
  // client renders that detail and "the request timed out" is more useful to an
  // admin than a bare upstream-status line with no status in it.
  let response;

  try {
    response = await fetch(url, {
      headers: githubContributorHeaders(),
      signal: AbortSignal.timeout(GITHUB_REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    // `AbortSignal.timeout` rejects with a `TimeoutError`-named DOMException; a
    // reset peer raises a `TypeError`. The name is what distinguishes them in
    // the logs — the error's own `message` is empty for the abort case, so
    // logging the error object alone prints a blank line. The token is never
    // logged; only the error name and the request path.
    console.error(
      `[adminContent] GitHub Contents read failed: ${error?.name || 'Error'}`,
    );
    throw new ApiError(502, 'Failed to fetch contributors.json from GitHub', [
      {
        field: 'github',
        message: `GitHub API request failed before a response (${error?.name || 'Error'})`,
      },
    ]);
  }

  if (!response.ok) {
    throw new ApiError(502, 'Failed to fetch contributors.json from GitHub', [
      {
        field: 'github',
        message: `GitHub API responded with status ${response.status}`,
      },
    ]);
  }

  const file = await response.json();
  if (!file?.content) {
    throw new ApiError(502, 'GitHub returned no content for contributors.json');
  }

  let contributors;
  try {
    // The Contents API returns base64 in a JSON envelope, and a DIRECTORY (or an
    // oversized file) comes back with no `content` at all — hence the check
    // above. `Array.isArray` below then defends against a JSON file that is
    // valid but not an array.
    contributors = JSON.parse(
      Buffer.from(file.content, 'base64').toString('utf8'),
    );
  } catch {
    throw new ApiError(502, 'contributors.json on GitHub is not valid JSON');
  }

  return {
    contributors: Array.isArray(contributors) ? contributors : [],
    sha: file.sha,
  };
};

/**
 * The contributors list for the admin panel, read live from the repository file.
 *
 * NOT the `Contributor` Mongo collection — see the module docblock. There is no
 * `sort` here and no pagination: the array is whatever the daily workflow wrote,
 * in whatever order it wrote it, and the panel renders it as-is.
 */
const listContributors = async (req, res) => {
  const { contributors } = await fetchContributorsFile();
  return res
    .status(200)
    .json(new ApiResponse(200, contributors, 'Contributors data'));
};

/**
 * Edits one contributor's `batch` / `linkedin` IN THE REPOSITORY FILE.
 *
 * THE TWO FIELDS ARE THE ENTIRE EDITABLE SURFACE, and that is a deliberate
 * constraint: `name`, `github` and everything else in the file are REGENERATED
 * from git history by the daily workflow, so an admin edit to any of them would
 * be reverted within a day. `batch` and `linkedin` are the two fields the
 * workflow explicitly preserves, which is exactly why they are the two this
 * handler accepts.
 *
 * The length caps (32 for `batch`, 500 for `linkedin`) are enforced HERE rather
 * than in a schema, because there is no schema — they are the only bound on what
 * a commit can write into the file. `slice` TRUNCATES rather than rejecting, so
 * an over-long value is silently cut to the cap; preserved.
 */
const updateContributorMetadata = async (req, res) => {
  const { githubUsername } = req.params;
  const updates = {};

  if (req.body?.batch !== undefined)
    updates.batch = String(req.body.batch).trim().slice(0, 32);
  if (req.body?.linkedin !== undefined) {
    updates.linkedin = String(req.body.linkedin).trim().slice(0, 500);
  }
  if (Object.keys(updates).length === 0) {
    throw new ApiError(
      400,
      'Provide at least one of batch or linkedin to update',
    );
  }

  // OPTIMISTIC-CONCURRENCY RETRY. The GitHub Contents API is compare-and-swap:
  // the `PUT` is rejected with 409 unless the `sha` presented matches the blob
  // currently on the branch. Between our read and our write, the daily workflow
  // can land its own regeneration — so a 409 means "someone else committed, read
  // again". The loop re-fetches (new `sha` AND new file contents, so the edit is
  // re-applied on top of their version rather than reverting it) and retries.
  //
  // AT MOST THREE ATTEMPTS. The `attempt < 2` guard below is what bounds it: on
  // the third 409 the loop falls through to the generic non-2xx branch and
  // surfaces a 502 instead of spinning. A lost race against a daily cron is not
  // worth an unbounded loop against a rate-limited API, and the admin can simply
  // press Save again.
  let attempt = 0;
  let updatedContributor = null;

  while (attempt < 3) {
    const { contributors, sha } = await fetchContributorsFile();
    const target = findContributorByUsername(contributors, githubUsername);

    // 404 BEFORE the first write, and again on every retry. Note the username is
    // echoed back in the message: it came from a URL segment, and saying which
    // handle was not found is what makes the admin's typo visible. It is not a
    // secret and not another user's private data.
    if (!target) {
      throw new ApiError(
        404,
        `Contributor with GitHub username "${githubUsername}" was not found in data/contributors.json`,
      );
    }

    Object.assign(target, updates);
    // TWO-SPACE INDENTED JSON, and the file is REPLACED WHOLESALE rather than
    // patched. That is the only shape the Contents API accepts: `content` is the
    // complete new file, base64-encoded, and GitHub records it as a one-line
    // JSON diff.
    const content = Buffer.from(
      JSON.stringify(contributors, null, 2),
      'utf8',
    ).toString('base64');

    const writeUrl = `https://api.github.com/repos/${GITHUB_CONTRIBUTOR_OWNER}/${GITHUB_CONTRIBUTOR_REPO}/contents/${GITHUB_CONTRIBUTOR_PATH}`;
    // The `try` is for the TIMEOUT, mirroring `fetchContributorsFile` above: an
    // abort here must produce the SAME 502 shape as a non-2xx write, or the
    // admin panel loses its existing error handling on a stalled network. This is
    // the one call in the codebase where a timeout is genuinely ambiguous — a
    // `PUT` that is aborted may or may not have been applied by GitHub before the
    // connection dropped. That ambiguity is NOT resolved here and must not be:
    // the operation is idempotent in practice (the loop re-reads the file and
    // re-applies the same field edits on top of whatever it finds), so the
    // next click of Save converges regardless. What must not happen is an
    // automatic blind retry of the PUT from here — that is the one thing that
    // could turn an ambiguity into a duplicate write to the same file.
    //
    // The timeout is PER ATTEMPT — see `GITHUB_REQUEST_TIMEOUT_MS`. It is NOT a
    // whole-operation deadline, precisely so the 409 retry loop keeps a full
    // budget on its third attempt instead of inheriting whatever the earlier
    // attempts left behind.
    let writeResponse;

    try {
      writeResponse = await fetch(writeUrl, {
        method: 'PUT',
        headers: githubContributorHeaders(),
        body: JSON.stringify({
          message: `chore: update contributor metadata for ${target.name || githubUsername}`,
          content,
          sha,
          branch: GITHUB_CONTRIBUTOR_BRANCH,
        }),
        signal: AbortSignal.timeout(GITHUB_REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      // Error NAME only. The request carries `Authorization: Bearer <token>`, so
      // neither the error object nor any interpolated URL/header may reach the
      // log line.
      console.error(
        `[adminContent] GitHub Contents write failed: ${error?.name || 'Error'}`,
      );
      throw new ApiError(502, 'Failed to write contributors.json to GitHub', [
        {
          field: 'github',
          message: `GitHub API request failed before a response (${error?.name || 'Error'})`,
        },
      ]);
    }

    if (writeResponse.status === 409 && attempt < 2) {
      attempt += 1;
      continue;
    }
    if (!writeResponse.ok) {
      throw new ApiError(502, 'Failed to write contributors.json to GitHub', [
        {
          field: 'github',
          message: `GitHub API responded with status ${writeResponse.status}`,
        },
      ]);
    }

    updatedContributor = target;
    break;
  }

  // THE WRITE HAS ALREADY HAPPENED at this point, in someone else's repository,
  // as a git commit that a human can see and revert. This audit row is the only
  // trace the CPCCU database keeps of it.
  //
  // `resourceId: updatedContributor.github` passes a GITHUB HANDLE into a field
  // that elsewhere holds an ObjectId string. It works because `writeAuditLog`
  // only calls `.toString()` on it, but the audit log's `resourceId` column is
  // therefore mixed-typed for this resource. Preserved.
  await writeAuditLog(
    req,
    'update',
    'contributors',
    { _id: updatedContributor.github },
    `Updated batch/linkedin for ${updatedContributor.name || githubUsername}`,
  );

  return res
    .status(200)
    .json(
      new ApiResponse(200, updatedContributor, 'Contributor metadata updated'),
    );
};

/**
 * THE ADMIN CONTENT WHITELIST, AND IT IS A SECURITY CONTROL.
 *
 * `getModel(resource)` resolves the `:resource` URL segment through this object,
 * and it is the ONLY thing standing between an authenticated admin and an
 * arbitrary Mongo collection: a key that is absent here is a 404 before any query
 * is built. Removing a key closes an endpoint; ADDING one opens a full
 * create/read/update/delete surface over that collection, including for a
 * moderator, because `authorizeAdminAction` in `adminAuth.js` only exempts
 * `events`, `gallery`, `gallery-events` and `posts` from moderator write
 * restrictions — every other key here is admin-only, but every key here is
 * reachable by an admin with a single URL.
 *
 * WHAT IS DELIBERATELY PRESENT AND SHOULD NOT BE "CLEANED UP":
 *  - `'audit-logs': AdminAuditLog` is WRITABLE. `getModel` is used by
 *    `createAdminContent`, `updateAdminContent` and `deleteAdminContent` as well
 *    as by the reader, so `/admin/content/audit-logs` supports POST, PATCH and
 *    DELETE against the audit trail itself. An admin can therefore forge or erase
 *    audit entries. That is a real finding, and it is preserved because narrowing
 *    the whitelist changes which endpoints exist and is a product/security
 *    decision, not a porting one.
 *  - `'posts': Post` points at the SAME model the public `post.controller.js`
 *    uses, and `createAdminContent` forces `owner` to the caller for it, so the
 *    two agree on authorship.
 *  - `users` and `roles` are ABSENT, which is why `?resource=users` is a 404
 *    rather than a member list. Member management has its own controller
 *    (`admin.controller.js`) with its own per-field allowlist; this generic CRUD
 *    path is not a second way in.
 *
 * The keys are URL segments, so `'gallery-events'` and `'audit-logs'` are
 * hyphenated; this map is the only place that translation exists.
 */
const models = {
  alumni: Alumni,
  'audit-logs': AdminAuditLog,
  contributors: Contributor,
  donators: Donator,
  events: Event,
  gallery: GalleryItem,
  'gallery-events': GalleryEvent,
  messages: ContactMessage,
  posts: Post,
  profiles: DeveloperProfile,
  committees: CommitteeMember,
};

const getModel = (resource) => {
  const model = models[resource];

  if (!model) {
    throw new ApiError(404, 'Admin resource not found');
  }

  return model;
};

/**
 * The three developer-profile moderation states, and the ONLY three that may be
 * written. Anything else is a 400 rather than a pass-through, because `status`
 * drives the public page: an unrecognised status would render a profile that is
 * neither in the public list nor in the admin queue, i.e. invisible.
 */
const allowedProfileStatuses = new Set(['pending', 'approved', 'rejected']);

/**
 * Builds the `DeveloperProfile` update, and it is the ONE place in this file
 * with a hand-written field ALLOWLIST.
 *
 * The rest-destructure is the allowlist: the named fields are pulled OUT of the
 * body, and `...allowedProfileUpdate` — everything left over — is what gets
 * written. The nine named keys are excluded because they are PROFILE-INDEPENDENT
 * values the API owns; accepting them from the client is how a caller would try
 * to rewrite the identity the profile is joined to (`userId`, `name`, `email`,
 * `phone`, the three `*Url`s) and the fields the pipeline derives
 * (`department`, `memberSince`).
 *
 * The two rules enforced on what is left:
 *  - `status` must be one of the three known states;
 *  - `rejectionReason` must be a STRING. A `null` (which is what a client sends
 *    to clear a field) is rejected, so a rejection reason is cleared by sending
 *    `''`, not `null`.
 *
 * And the two normalisation rules, which are the actual business logic:
 *  - moving to `approved` or `pending` CLEARS `rejectionReason`, because a
 *    profile that is no longer rejected must not still display a stale reason to
 *    the member;
 *  - moving to `rejected` trims whatever reason was supplied.
 * Note the asymmetry: a rejection reason supplied WITHOUT changing the status is
 * simply written through (trimmed by nothing — it is validated as a string and
 * stored verbatim), and a status change to `rejected` with NO reason leaves
 * whatever was already there.
 */
const buildDeveloperProfileUpdate = (body) => {
  const {
    department,
    email,
    githubUrl,
    linkedinUrl,
    memberSince,
    name,
    phone,
    photoUrl,
    portfolioUrl,
    skills,
    userId,
    ...allowedProfileUpdate
  } = body;
  const update = { $set: allowedProfileUpdate };

  if (
    allowedProfileUpdate.status !== undefined &&
    !allowedProfileStatuses.has(allowedProfileUpdate.status)
  ) {
    throw new ApiError(
      400,
      'Profile status must be pending, approved, or rejected',
    );
  }

  if (
    allowedProfileUpdate.rejectionReason !== undefined &&
    typeof allowedProfileUpdate.rejectionReason !== 'string'
  ) {
    throw new ApiError(400, 'Rejection reason must be a string');
  }

  if (
    allowedProfileUpdate.status === 'approved' ||
    allowedProfileUpdate.status === 'pending'
  ) {
    update.$set.rejectionReason = '';
  }

  if (
    allowedProfileUpdate.status === 'rejected' &&
    allowedProfileUpdate.rejectionReason !== undefined
  ) {
    update.$set.rejectionReason = allowedProfileUpdate.rejectionReason.trim();
  }

  return update;
};

/**
 * Copies the profile's moderation state onto the DENORMALISED job-pipeline
 * fields on the user document.
 *
 * WHY THE DENORMALISATION EXISTS AT ALL: the public members list filters and
 * renders job-pipeline entries without joining `DeveloperProfile`, so the user
 * document carries its own copy. This function is the WRITE side of that copy;
 * `resolveJobPipelineStatus` in `user.controller.js` is the lazy read-side
 * reconciliation, and this is why the admin path must keep writing here.
 *
 * `'hidden'` is the fail-closed default for a profile with no status at all — a
 * member is not published unless an admin says so.
 *
 * The guard is `if (!profile?.userId) return`: a profile whose user was deleted
 * (or which was created without a back-reference) has nothing to write to, and
 * `User.updateOne({ _id: undefined })` would otherwise be a query against every
 * user.
 */
const syncUserJobPipelineFields = async (profile) => {
  if (!profile?.userId) return;

  await User.updateOne(
    { _id: profile.userId },
    {
      $set: {
        jobPipelineStatus: profile.status || 'hidden',
        jobPipelineTitle: profile.title || '',
        jobPipelineRejectionReason: profile.rejectionReason || '',
      },
    },
  );
};

/**
 * The counterpart of `syncUserJobPipelineFields`, run when a profile is DELETED.
 *
 * This is what stops a deleted profile from leaving the member permanently listed
 * on the public job pipeline: without it the user's denormalised copy would
 * survive with no profile behind it, and the lazy read-reconcile has nothing to
 * reconcile against (it looks the profile up by `userId`, finds none, and only
 * then repairs the fields — so the stale copy is visible in the window between
 * the delete and that next read).
 *
 * `if (!userId) return` for the same reason as above: the deleted document's
 * `userId` may be absent, and an unfiltered `updateOne` would rewrite every user.
 */
const clearUserJobPipelineFields = async (userId) => {
  if (!userId) return;

  await User.updateOne(
    { _id: userId },
    {
      $set: {
        jobPipelineStatus: 'hidden',
        jobPipelineTitle: '',
        jobPipelineRejectionReason: '',
      },
    },
  );
};

/**
 * Normalises the two historical shapes of a developer skill into one.
 *
 * A user's `skills` is an array whose entries are either `{ skillName, experience }`
 * (the legacy shape, still present on documents written before the change) or
 * `{ name, description }` (the current shape). Both are accepted, and the `||`
 * chain prefers the LEGACY key. Entries with no name at all are DROPPED,
 * because the page renders a skill chip per entry and a nameless chip is a blank
 * box.
 *
 * NOTE this is a copy of the identically named function in
 * `content.controller.js`, and it is duplicated in the Express original too.
 * That second copy is in scope for this port; deduplicating across controllers
 * is a refactor, and doing it during a port would mean the diff against the
 * source no longer showed what changed. Ported faithfully.
 *
 * BOTH operands of the `||` chains are OPTIONALLY CHAINED (`skill?.name`, not
 * `skill.name`), so a `null` entry inside a `skills` array normalises to
 * `undefined` and is then dropped by the `.filter` rather than throwing a
 * `TypeError`. The asymmetry with the `.filter((skill) => skill.name)` on the
 * next line is in the original and is safe: a null entry can never reach it,
 * because the `.map` above has already replaced it with an object.
 */
const normalizeDeveloperSkills = (skills = []) =>
  (skills || [])
    .map((skill) => ({
      name: skill?.skillName || skill?.name,
      description: skill?.experience || skill?.description,
    }))
    .filter((skill) => skill.name);

/**
 * Flattens a `DeveloperProfile` plus its populated `userId` into the shape the
 * developer page consumes.
 *
 * ============================ DUPLICATE #2 OF 2 ============================
 * The Express source contains this function TWICE — once here and once in
 * `content.controller.js` — with identical bodies. The copy in THIS file is the
 * AUTHORITATIVE one for every caller in this file: the `profiles` branch of
 * `listAdminContent`, and the `profiles` branches of `createAdminContent` and
 * `updateAdminContent`. The copy in `content.controller.js` is authoritative for
 * the PUBLIC content endpoint. They happen to agree today, so the duplication is
 * currently harmless; it is a divergence risk, not a bug, and it is NOT
 * deduplicated here because that is a refactor rather than a port.
 *
 * Returns `null` when `profile.userId` is unpopulated, and callers `.filter(Boolean)`
 * those out — which happens for a profile whose user was deleted, since
 * `.populate()` sets the ref to `null` rather than removing the document.
 *
 * `department` falls back `user.section` -> `user.batch` -> `'CPCCU'`, so the
 * card always has a label even for an account that filled in neither.
 */
const formatDeveloperProfile = (profile) => {
  const user = profile.userId;

  if (!user) return null;

  return {
    _id: profile._id,
    id: profile._id?.toString?.(),
    userId: user._id?.toString?.(),
    name: user.fullName || '',
    title: profile.title || '',
    email: user.email || '',
    phone: user.phone || '',
    photoUrl: user.avatar || '',
    githubUrl: user.github || '',
    linkedinUrl: user.linkedin || '',
    portfolioUrl: user.portfolio || '',
    skills: normalizeDeveloperSkills(user.skills),
    status: profile.status || 'pending',
    rejectionReason: profile.rejectionReason || '',
    submittedAt: profile.submittedAt || profile.createdAt,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
    memberSince: user.createdAt || profile.submittedAt || profile.createdAt,
    department: user.section || user.batch || 'CPCCU',
  };
};

/**
 * In-memory search over a FORMATTED profile.
 *
 * WHY THIS EXISTS AT ALL, and it is not a performance choice: the fields an admin
 * searches a developer profile by — the member's NAME, EMAIL, PHONE, DEPARTMENT
 * and SKILLS — all live on the `User` document, not on the `DeveloperProfile`.
 * They are not searchable from Mongo without a `$lookup`, so the search runs
 * after `.populate('userId')`, in JavaScript, over the flattened objects.
 *
 * The match is a case-insensitive SUBSTRING test (`.includes`, not an anchored
 * comparison), so a one-character search matches nearly everything; and skills are
 * searched as one concatenated string of `name description` pairs, meaning a
 * query can straddle the boundary between a skill's name and its description.
 *
 * NOTE THE SEARCH SEMANTICS DIFFER FROM EVERY OTHER RESOURCE. For the eleven
 * other collections the search is a Mongo regex over the fields listed in
 * `buildListQuery`'s `searchableFields`; for `profiles` the Mongo half is
 * disabled and this function decides instead. The two do not agree — the Mongo
 * map for `profiles` lists `['title', 'rejectionReason']` while this function
 * searches name/email/phone/department/skills and NOT `rejectionReason`. So
 * searching a profile for the text of a rejection reason returns nothing, and
 * searching it for a member's email works. Preserved, and worth knowing before
 * anyone "unifies" the two.
 */
const profileMatchesSearch = (profile, search) => {
  if (!search) return true;

  const normalizedSearch = search.toLowerCase();
  const skillText = (profile.skills || [])
    .map((skill) => `${skill.name || ''} ${skill.description || ''}`)
    .join(' ');

  return [
    profile.name,
    profile.title,
    profile.email,
    profile.phone,
    profile.department,
    skillText,
  ].some((value) =>
    String(value || '')
      .toLowerCase()
      .includes(normalizedSearch),
  );
};

/**
 * Escapes every regex metacharacter so a user-supplied string can be embedded in
 * a `RegExp` LITERALLY.
 *
 * Without it, `?search=.*` would become a match-everything pattern and
 * `?search=(a|b)` would inject alternation. This is what makes the `?search`
 * parameter safe to hand to Mongo as a regex, and it is the counterpart to the
 * argument made at `searchableFields[resource]` below: the resource segment
 * chooses WHICH FIELDS, and only the escaped search chooses the PATTERN.
 */
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Turns the query string into a Mongo filter for a list request.
 *
 * `'all'` IS A SENTINEL, not a value: the panel's filter dropdowns offer an
 * explicit "All" option, and without this `?status=all` would filter for a status
 * literally named `all` and return nothing. Any other falsy value (absent,
 * empty string) is treated the same as `'all'`.
 *
 * -------- WHY `searchableFields[resource]` IS SAFE DESPITE LOOKING DANGEROUS --------
 * `resource` comes straight from the URL and is interpolated as a property LOOKUP
 * KEY here, which is the shape that usually signals injection. It is safe on this
 * side of the expression because:
 *  1. the lookup yields either one of the eleven hard-coded ARRAYS OF FIELD NAMES
 *     written below, or `undefined` — a caller cannot make it return a string,
 *     an object, or anything else of their choosing;
 *  2. even a `__proto__` / `constructor` key yields no array, so the `||` fallback
 *     applies and the caller gets the generic `['title', 'name']`;
 *  3. the field names become OBJECT KEYS in `{ [field]: regex }` — Mongoose turns
 *     them into dotted field paths, not into operators, and an unknown path is
 *     simply not matched;
 *  4. the VALUE in every one of those objects is the SAME `regex` object, built
 *     once from `escapeRegex(search)`. The resource segment never reaches the
 *     pattern.
 * So the only user-controlled input to the regex is `search`, and it is escaped.
 * This is the same reasoning as the whitelists in `admin.controller.js`; do not
 * "tidy" the lookup into a computed property expression without re-checking it.
 *
 * The generic fallback `['title', 'name']` is what `audit-logs` never sees (it has
 * its own entry) but `contributors` and the rest of the unlisted keys do not
 * reach either — `getModel` has already 404'd anything not in the whitelist.
 */
const buildListQuery = (resource, query) => {
  const filters = {};
  const { search, status, category, type } = query;

  if (status && status !== 'all') filters.status = status;
  if (category && category !== 'all') filters.category = category;
  if (type && type !== 'all') filters.type = type;

  if (search) {
    // Built ONCE and reused across every field, rather than per field, so a
    // search over six fields compiles one regex rather than six. `escapeRegex`
    // is what makes the whole branch injection-safe — see above.
    const regex = new RegExp(escapeRegex(search), 'i');
    const searchableFields = {
      contributors: ['username', 'name', 'role'],
      alumni: ['name', 'position', 'batch', 'technology', 'email', 'phone'],
      'audit-logs': [
        'adminName',
        'action',
        'resource',
        'resourceId',
        'summary',
      ],
      committees: ['name', 'fullName', 'email', 'position', 'term', 'group'],
      donators: ['name', 'contribution'],
      events: ['title', 'description', 'location', 'organizer'],
      'gallery-events': ['title', 'description'],
      gallery: ['title', 'description', 'category'],
      messages: ['name', 'email', 'subject', 'message'],
      posts: ['title', 'content', 'description'],
      profiles: ['title', 'rejectionReason'],
    };
    // `$or` rather than `$and` of per-field regexes: a match on ANY ONE of the
    // resource's fields is a match. `title` and `name` are the fallback pair for
    // any key not in the map.
    filters.$or = (searchableFields[resource] || ['title', 'name']).map(
      (field) => ({ [field]: regex }),
    );
  }

  return filters;
};

/**
 * Records who did what.
 *
 * NEVER FAILS THE REQUEST. The `try/catch` swallows a write error and logs it,
 * so a full audit-log collection (or a Mongo hiccup) cannot turn a successful
 * content edit into a 500 — the panel would show the edit as failed while the
 * data had in fact been saved, which is worse than a gap in the trail. The
 * trade is that audit coverage is best-effort, and the only signal of a gap is
 * this `console.error`.
 *
 * `adminName` falls back `fullName` -> `email` -> `''` so a row is still
 * attributable when the account has no name; `resourceId` is `''` for a
 * contributor entry, whose "id" is a GitHub handle with no `_id` to stringify.
 *
 * Note this is NOT the only audit path: `updateAdminContent`'s `profiles` branch
 * returns BEFORE reaching its `writeAuditLog` call, and
 * `updateContributorMetadata` writes to a different collection entirely.
 */
const writeAuditLog = async (req, action, resource, item, summary = '') => {
  try {
    await AdminAuditLog.create({
      adminId: req.user?._id,
      adminName: req.user?.fullName || req.user?.email || '',
      action,
      resource,
      resourceId: item?._id?.toString() || '',
      summary,
    });
  } catch (auditError) {
    console.error('Audit log write failed:', auditError.message);
  }
};

/**
 * Paginated listing for one of the eleven admin collections.
 *
 * THE TWO PAGE-SIZE BOUNDS ARE A CONTRACT, not defaults: `page` is floored at 1
 * and `limit` is CLAMPED to 1..200 with a default of 100. The upper bound is what
 * stops `?limit=100000` from turning an admin list into a full-collection dump;
 * the floor at 1 stops `?page=-5` from producing a negative `skip`, which Mongo
 * treats as an error. Values that are not numbers (`?page=abc`) fall back through
 * `Number(...) || default`.
 *
 * SORT DEFAULTS DIFFER BY COLLECTION, because the collections are not alike:
 *  - `profiles` sorts by `submittedAt` — the admin queue is ordered by when a
 *    member submitted, not by when the row was created;
 *  - the six "ordered" resources below sort by their manual `order` field, which
 *    is how the panel's drag-to-reorder control is persisted;
 *  - everything else sorts by `createdAt`.
 *
 * `sortOrder` HAS A FORCED VALUE: for the six ordered resources it is `1`
 * REGARDLESS of what the client asked for, because the `order` field only means
 * something ascending. The `||` there is `sortOrder === 'asc' || isOrderedResource`
 * evaluated as a condition — note the operator precedence makes this
 * `(A || B) ? 1 : -1`, and the consequence is that `?sortOrder=desc` is silently
 * ignored on exactly those six collections. Preserved.
 *
 * `sortField` IS NOT WHITELISTED — `?sortBy=` is used as a Mongo sort key
 * directly. That is a deliberate asymmetry with `:resource`, which goes through
 * `models`: a sort key can only name a field path, and Mongo sorts
 * unknown/absent fields as ties, so the worst case is an ordering that reveals
 * the relative order of a field the caller named, not data it could not already
 * read from this collection.
 *
 * THE `profiles` BRANCH IS A DIFFERENT IMPLEMENTATION, not a variation:
 *  - the database query is rebuilt with `search: undefined`, so the regex
 *    `$or` is NOT applied in Mongo and the search happens in JavaScript instead
 *    (see `profileMatchesSearch` for why the searchable fields are not on the
 *    profile);
 *  - consequently the query is NOT paginated in the database — there is no
 *    `.skip()`/`.limit()` — so every matching profile is loaded, formatted and
 *    filtered in memory, and only THEN sliced. `total` is the POST-filter count,
 *    which is what makes `totalPages` correct, but the cost is O(profiles) per
 *    request rather than O(page size). Preserved: the alternative is the `$lookup`
 *    the earlier comment describes;
 *  - the sort is by `submittedAt` with `updatedAt: -1` as the tiebreak, ignoring
 *    `sortField` entirely.
 *
 * `filters` (the version WITH the regex `$or`) is computed above and then unused
 * on this path. That is dead work in the original — one extra object literal, no
 * extra round trip — and is kept so the diff against the source stays clean.
 *
 * `totalPages: Math.ceil(total / limit) || 1` — the `|| 1` means an EMPTY result
 * set still reports one page, so the panel's pager shows "1" rather than a
 * division that would otherwise display as 0.
 *
 * `getModel` is called AFTER `buildListQuery` on purpose: an unknown resource
 * still costs one object literal, but the 404 fires before any database work.
 */
const listAdminContent = async (req, res) => {
  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 200);
  const skip = (page - 1) * limit;
  const orderedResources = [
    'alumni',
    'committees',
    'donators',
    'events',
    'gallery',
    'gallery-events',
  ];
  const sortField =
    req.query.sortBy ||
    (req.params.resource === 'profiles'
      ? 'submittedAt'
      : orderedResources.includes(req.params.resource)
        ? 'order'
        : 'createdAt');
  const sortOrder =
    req.query.sortOrder === 'asc' ||
    orderedResources.includes(req.params.resource)
      ? 1
      : -1;
  const filters = buildListQuery(req.params.resource, req.query);
  const model = getModel(req.params.resource);

  if (req.params.resource === 'profiles') {
    const profileFilters = buildListQuery(req.params.resource, {
      ...req.query,
      search: undefined,
    });
    const profileItems = await model
      .find(profileFilters)
      .populate('userId')
      .sort({ submittedAt: sortOrder, updatedAt: -1 });
    const formattedProfileItems = profileItems
      .map(formatDeveloperProfile)
      .filter(Boolean)
      .filter((profile) => profileMatchesSearch(profile, req.query.search));
    const total = formattedProfileItems.length;
    const items = formattedProfileItems.slice(skip, skip + limit);

    return res.status(200).json(
      new ApiResponse(
        200,
        {
          items,
          pagination: {
            limit,
            page,
            total,
            totalPages: Math.ceil(total / limit) || 1,
          },
        },
        'Admin content data',
      ),
    );
  }

  // The page and the total are fetched CONCURRENTLY rather than sequentially:
  // they are two independent queries on the same filter, so serialising them
  // would double the latency of every admin list for no benefit. The trade is
  // that the count and the page are not a consistent snapshot — a write landing
  // between the two can make `total` disagree with the items on this page.
  const [items, total] = await Promise.all([
    model
      .find(filters)
      .sort({ [sortField]: sortOrder, updatedAt: -1 })
      .skip(skip)
      .limit(limit),
    model.countDocuments(filters),
  ]);

  return res.status(200).json(
    new ApiResponse(
      200,
      {
        items,
        pagination: {
          limit,
          page,
          total,
          totalPages: Math.ceil(total / limit) || 1,
        },
      },
      'Admin content data',
    ),
  );
};

/**
 * Creates a document in one of the eleven collections.
 *
 * THE BODY IS FORWARDED VERBATIM for every resource — the generic create has no
 * field allowlist, unlike `buildDeveloperProfileUpdate` on the update path. What
 * protects the schema is the model: `runValidators` is not passed here, so
 * required fields are enforced by the schema at save time and an invalid value
 * surfaces as a Mongoose `ValidationError` -> 500 rather than a 400. Preserved.
 *
 * `posts` IS THE ONE EXCEPTION, and the ordering is the security property:
 * `owner` is spread AFTER `...req.body`, so a body-supplied `owner` is always
 * overwritten with the authenticated admin's id. Posts are therefore attributed
 * to the admin who published them through the panel, and the endpoint cannot be
 * used to forge a post under someone else's name. Every other collection has no
 * such owner field, which is why the branch exists at all.
 *
 * The audit log is written for EVERY resource, including `profiles`.
 */
const createAdminContent = async (req, res) => {
  const body =
    req.params.resource === 'posts'
      ? { ...req.body, owner: req.user._id }
      : req.body;
  const item = await getModel(req.params.resource).create(body);
  await writeAuditLog(
    req,
    'create',
    req.params.resource,
    item,
    'Created admin content',
  );

  // Profiles are returned in the FLATTENED shape the panel renders, not as the
  // raw document, so the create response matches what the subsequent list and
  // update responses return for the same row.
  //
  // PRESERVED EDGE CASE: a profile created without a `userId` has nothing to
  // populate, `formatDeveloperProfile` returns `null` for it, and this handler
  // therefore answers 201 with `data: null`. The document WAS created. The
  // list/update paths filter those rows out with `.filter(Boolean)`; this one
  // does not, because there is nothing to filter a single item against.
  if (req.params.resource === 'profiles') {
    await item.populate('userId');
    return res
      .status(201)
      .json(
        new ApiResponse(
          201,
          formatDeveloperProfile(item),
          'Admin content created',
        ),
      );
  }

  return res
    .status(201)
    .json(new ApiResponse(201, item, 'Admin content created'));
};

/**
 * Updates a document in one of the eleven collections.
 *
 * TWO DIFFERENT UPDATE SHAPES, and the difference is a security boundary:
 *  - `profiles` goes through `buildDeveloperProfileUpdate`, which has a
 *    hand-written allowlist and the status/rejectionReason rules. This is the
 *    only collection on this endpoint that validates what it writes.
 *  - EVERYTHING ELSE is `{ $set: req.body }` — the caller's body becomes the
 *    update verbatim, with no allowlist at all. That is a genuine mass-assignment
 *    surface, bounded only by (a) `getModel` restricting which collection, (b)
 *    `authorizeAdminAction` restricting which role may reach which resource, and
 *    (c) `runValidators: true` rejecting values the schema forbids. A caller who
 *    reaches this endpoint can set any other field the schema defines on that
 *    collection, including internal ones. PRESERVED, not hardened: narrowing it
 *    per collection is eleven product decisions, not a porting change.
 *
 * `runValidators: true` matters more here than anywhere else in this file,
 * precisely because the payload is unfiltered — it is what stops a schema
 * violation (an out-of-enum `status`, an oversized `title`) reaching the
 * collection through an update.
 *
 * `new: true` returns the POST-update document so the panel renders what was
 * actually saved rather than echoing its own request.
 *
 * PRESERVED DEFECT — MISSING AUDIT ENTRY. The `profiles` branch RETURNS before
 * the `writeAuditLog` call below, so an admin approving or rejecting a developer
 * profile — the most consequential action this controller performs, and the one
 * that decides whether a member appears on the public site — leaves NO audit
 * record. The other ten resources are audited. This is original behaviour and is
 * preserved; the audit gap is flagged here because it is exactly the kind of thing
 * a reader assumes cannot be missing.
 *
 * `syncUserJobPipelineFields` runs BEFORE the `populate`, and only on the
 * profiles path, so the denormalised copy on the user document is refreshed
 * before the response is built.
 */
const updateAdminContent = async (req, res) => {
  const Model = getModel(req.params.resource);
  const update =
    req.params.resource === 'profiles'
      ? buildDeveloperProfileUpdate(req.body)
      : { $set: req.body };
  const item = await Model.findByIdAndUpdate(req.params.id, update, {
    new: true,
    runValidators: true,
  });

  if (!item) {
    throw new ApiError(404, 'Admin content item not found');
  }
  if (req.params.resource === 'profiles') {
    await syncUserJobPipelineFields(item);
    await item.populate('userId');
    const formattedItem = formatDeveloperProfile(item);

    return res
      .status(200)
      .json(new ApiResponse(200, formattedItem, 'Admin content updated'));
  }
  await writeAuditLog(
    req,
    'update',
    req.params.resource,
    item,
    'Updated admin content',
  );

  return res
    .status(200)
    .json(new ApiResponse(200, item, 'Admin content updated'));
};

/**
 * Hard-deletes a document from one of the eleven collections.
 *
 * NOT SOFT. There is no `deletedAt` on any of these schemas, so removing an event
 * or a gallery item destroys it outright, along with any image it referenced in
 * Cloudinary — which is left behind as an orphaned asset, because nothing in
 * this controller calls `destroyCloudinaryImage`. That leak is preserved: the
 * document that carried the public id is the thing being deleted, so there is
 * nothing left to clean up with.
 *
 * For `profiles`, the denormalised job-pipeline copy on the user document is
 * cleared first (see `clearUserJobPipelineFields`) so the member does not stay
 * listed on the public job pipeline with no profile behind them.
 *
 * The audit log is written AFTER the delete, using the document that was just
 * removed — `writeAuditLog` reads `item._id` from the returned document, not from
 * the database, which is why this works at all.
 */
const deleteAdminContent = async (req, res) => {
  const item = await getModel(req.params.resource).findByIdAndDelete(
    req.params.id,
  );

  if (!item) {
    throw new ApiError(404, 'Admin content item not found');
  }
  if (req.params.resource === 'profiles') {
    await clearUserJobPipelineFields(item.userId);
  }
  await writeAuditLog(
    req,
    'delete',
    req.params.resource,
    item,
    'Deleted admin content',
  );

  return res
    .status(200)
    .json(new ApiResponse(200, null, 'Admin content deleted'));
};

/**
 * The admin Site Statistics page.
 *
 * Every statistic is derived live from the real CPCCU data sources (members,
 * gallery, events, visitor counter, certificates, and certificate verification
 * logs). There is nothing to edit manually.
 *
 * DELIBERATELY THE SAME SERVICE the public statistics endpoint uses
 * (`content.controller.js`'s `getPublicStatistics`), so the public counter and the
 * admin one cannot disagree — a visible inconsistency on a dashboard is worse
 * than the small extra cost of computing both from the same source.
 */
const getAdminStatistics = async (req, res) => {
  // Every statistic is derived live from the real CPCCU data sources
  // (members, gallery, events, visitor counter, certificates, and
  // certificate verification logs). There is nothing to edit manually.
  const stats = await getSiteStatistics();

  return res.status(200).json(new ApiResponse(200, stats, 'Site statistics'));
};

/**
 * The SINGLETON system-settings document, created on first read.
 *
 * `$setOnInsert` with `upsert: true` is the "get or create" idiom: the filter
 * `{ key: 'system' }` selects the one document, and if it does not exist the
 * upsert inserts exactly `key: 'system'` and nothing else — so this GET never
 * overwrites settings an admin has already saved. It is still a WRITE on a GET
 * endpoint, which is what makes a read-only replica refuse it and what would make
 * a cache of this response wrong; preserved, because it is also what removes the
 * need for a seed or a "not configured" branch in the panel.
 *
 * `new: true` returns the resulting document, so the response is the settings
 * object the panel binds to, whether it already existed or was just created.
 */
const getAdminSystemSettings = async (req, res) => {
  const settings = await SystemSettings.findOneAndUpdate(
    { key: 'system' },
    { $setOnInsert: { key: 'system' } },
    { new: true, upsert: true },
  );

  return res
    .status(200)
    .json(new ApiResponse(200, settings, 'System settings'));
};

/**
 * Saves the system-settings document.
 *
 * `{ $set: req.body }` — an UNFILTERED write onto the one shared settings
 * document, with no allowlist and no `runValidators`. Any field the
 * `SystemSettings` schema declares can be set, and a field it does not declare is
 * dropped by Mongoose's strict mode rather than rejected. This is the same
 * mass-assignment shape as the generic content update above, on a document that
 * every page load may read; preserved.
 *
 * `upsert: true` means a PATCH on a settings document that does not exist yet
 * CREATES it, so the panel does not have to call the GET first.
 */
const updateAdminSystemSettings = async (req, res) => {
  const settings = await SystemSettings.findOneAndUpdate(
    { key: 'system' },
    { $set: req.body },
    { new: true, upsert: true },
  );

  return res
    .status(200)
    .json(new ApiResponse(200, settings, 'System settings updated'));
};

/**
 * Every issued certificate, newest first.
 *
 * UNPAGINATED AND UNFILTERED — no `.skip()`, no `.limit()`, no projection. The
 * admin panel's certificate table is the only consumer, and the collection is
 * expected to stay small (one row per issued certificate). It is the only
 * unbounded read in this file and is preserved as written: adding a limit would
 * change the response the panel renders, and the certificate count is a dashboard
 * tile that assumes it can see them all.
 */
const listAdminCertificates = async (req, res) => {
  const certificates = await Certificate.find().sort({ createdAt: -1 });

  return res
    .status(200)
    .json(new ApiResponse(200, certificates, 'Certificates data'));
};

/**
 * Issues a certificate.
 *
 * THE CERTIFICATE NUMBER IS ENTIRELY ADMIN-SUPPLIED and is NOT generated here.
 * There is no call into `utils/generateCertificateId.js` — that file exists in
 * the Express backend and is ZERO BYTES, i.e. it is a dead module that exports
 * nothing and could not be imported, so nothing in the API can be using it. The
 * number is the admin's to choose (it matches an existing competition result
 * sheet), which is why it is only checked for presence and for uniqueness.
 *
 * UNIQUENESS IS CHECKED HERE RATHER THAN RELIED ON ALONE, because the error is
 * the point: the `certificateId` unique index would reject the duplicate anyway,
 * but as an `E11000` -> 500, where this produces a 409 carrying a field-level
 * message the panel can put next to the input. The index remains the
 * race-condition backstop for two concurrent issues of the same number.
 * `.lean()` because only existence is read.
 *
 * The two defaults are business rules, not conveniences:
 *  - `contestType` defaults to `'programming-contest'`, the club's primary
 *    activity, for a certificate issued without one;
 *  - `certificateType` falls back to `placement` and then to `'participation'`,
 *    so the single legacy input still classifies a certificate correctly.
 *
 * `issuedBy: 'CPCCU - City University'` is HARDCODED on create — the issuing body
 * is a fact about the club, not something an admin may set. It is NOT
 * protected on the update path (see `updateAdminCertificate`), which is an
 * inconsistency in the original.
 *
 * `issueDate ? new Date(issueDate) : new Date()` — a missing date is stamped with
 * the moment of issuing, and a NON-PARSEABLE date string yields an Invalid Date,
 * which Mongoose rejects with a cast error -> 500 rather than a 400. Preserved.
 */
const createAdminCertificate = async (req, res) => {
  const {
    certificateId,
    recipientName,
    recipientId,
    contestName,
    contestType,
    certificateType,
    placement,
    batch,
    issueDate,
    description,
  } = req.body;

  // Both required fields are validated together and reported together, so an
  // admin who sent neither gets both messages in one response instead of
  // discovering the second one on the next submit.
  if (!certificateId?.trim() || !recipientId?.trim()) {
    throw new ApiError(400, 'Certificate ID and Student ID are required.', [
      ...(!certificateId?.trim()
        ? [{ field: 'certificateId', message: 'Certificate ID is required.' }]
        : []),
      ...(!recipientId?.trim()
        ? [{ field: 'recipientId', message: 'Student ID is required.' }]
        : []),
    ]);
  }

  const trimmedCertId = certificateId.trim();
  const existingCert = await Certificate.findOne({
    certificateId: trimmedCertId,
  }).lean();
  if (existingCert) {
    throw new ApiError(409, 'Validation failed', [
      {
        field: 'certificateId',
        message: `Certificate ${trimmedCertId} already exists.`,
      },
    ]);
  }

  const cert = await Certificate.create({
    certificateId: trimmedCertId,
    recipientName: String(recipientName || '').trim(),
    recipientId: String(recipientId).trim(),
    contestName: String(contestName || '').trim(),
    contestType: contestType?.trim() || 'programming-contest',
    certificateType: certificateType || placement || 'participation',
    issueDate: issueDate ? new Date(issueDate) : new Date(),
    batch: String(batch || '').trim(),
    description: String(description || '').trim(),
    issuedBy: 'CPCCU - City University',
  });
  await writeAuditLog(
    req,
    'create',
    'certificates',
    cert,
    'Issued certificate',
  );

  return res.status(201).json(new ApiResponse(201, cert, 'Certificate issued'));
};

/**
 * Edits an issued certificate.
 *
 * THE NUMBER IS PULLED OUT OF THE BODY AND PUT BACK CONDITIONALLY. The spread
 * `...safeBody` deliberately omits `certificateId`, so the number can only reach
 * the document through the trimmed, uniqueness-checked line below. Without that
 * separation a caller could write an untrimmed or unchecked number straight
 * through, defeating both the normalisation and the 409.
 *
 * UNIQUENESS IS ONLY ASSERTED WHEN THE NUMBER IS ACTUALLY CHANGING
 * (`certificateId.trim() !== existing.certificateId`), and the existing
 * certificate's `_id` is passed as the exclusion — so re-saving a certificate
 * without touching its number is not a self-collision. Note the exclusion is by
 * document id, not by number, which is what an update path has available.
 *
 * THE 404 IS CHECKED FIRST, on a `.lean()` read, so a missing certificate costs
 * one indexed lookup and no write.
 *
 * PRESERVED DEFECT — `issuedBy` IS WRITABLE HERE. The create path hardcodes the
 * issuing body, and this path does not exclude it from `safeBody`, so an admin
 * can PATCH a certificate into claiming a different issuer. Preserved.
 *
 * A small second gap: the audit log below is written even if the
 * `findByIdAndUpdate` returned `null` (a certificate deleted between the 404 check
 * and the write), because there is no `if (!certificate)` guard on this path. The
 * audit row then records a `resourceId` of `''` and the response is a 200 with
 * `data: null`. Preserved.
 */
const updateAdminCertificate = async (req, res) => {
  const existing = await Certificate.findById(req.params.id).lean();
  if (!existing) {
    throw new ApiError(404, 'Certificate not found');
  }

  const { certificateId, ...safeBody } = req.body;

  if (
    certificateId?.trim() &&
    certificateId.trim() !== existing.certificateId
  ) {
    await assertCertificateIdUnique(certificateId, req.params.id);
  }

  const updatePayload = { ...safeBody };
  if (certificateId?.trim()) {
    updatePayload.certificateId = certificateId.trim();
  }

  const certificate = await Certificate.findByIdAndUpdate(
    req.params.id,
    { $set: updatePayload },
    { new: true, runValidators: true },
  );

  await writeAuditLog(
    req,
    'update',
    'certificates',
    certificate,
    'Updated certificate',
  );

  return res
    .status(200)
    .json(new ApiResponse(200, certificate, 'Certificate updated'));
};

/**
 * Revokes an issued certificate.
 *
 * NOT a status change — a HARD delete, so the number becomes free for reissue
 * and the public verification endpoint will report it as not found. The
 * certificate-verification audit trail in `CertificateVerificationLog` is
 * untouched, so the history of past verification attempts against that number
 * survives the certificate's deletion.
 */
const deleteAdminCertificate = async (req, res) => {
  const certificate = await Certificate.findByIdAndDelete(req.params.id);

  if (!certificate) {
    throw new ApiError(404, 'Certificate not found');
  }
  await writeAuditLog(
    req,
    'delete',
    'certificates',
    certificate,
    'Deleted certificate',
  );

  return res
    .status(200)
    .json(new ApiResponse(200, null, 'Certificate deleted'));
};

/**
 * Uploads one image to Cloudinary and returns its URL.
 *
 * THIS IS THE ONLY ADMIN ENDPOINT THAT DOES NOT PERSIST ANYTHING. It does not
 * write to Mongo, does not write an audit row, and does not touch any collection:
 * it returns `{ url, publicId }` and the CLIENT then stores that URL wherever it
 * belongs — `Event.image`, `GalleryItem.imageUrl`, a committee member's photo,
 * `SystemSettings` branding. The pairing is therefore two-step and NOT atomic: an
 * upload whose follow-up save fails leaves an asset in the Cloudinary account that
 * nothing references, and the panel has no public id stored anywhere to clean it
 * up with. 201 (not 200) is the original's choice for a creation.
 *
 * 201 IS CORRECT FOR THE CLIENT'S BENEFIT: the image is genuinely created, and the
 * content record that will point at it is created by a DIFFERENT request.
 *
 * THE ROUTE MOUNTS `upload.single('image')`, so a shimmed route for this handler
 * must pass `fileField: 'image'` to `createShim`; without it the shim collects
 * every file part, which is a superset rather than a filter.
 *
 * ---------------------------------- DIVERGENCE 1 OF 1 ----------------------------------
 * `req.file.path` -> `req.file.buffer`.
 *
 * The original read a path because multer's `diskStorage` had written the upload
 * to `./public/temp` and the uploader opened that path. Neither half survives a
 * serverless runtime: the bundle filesystem is read-only, `/tmp` is the only
 * writable location, and an execution lives only for the duration of the request —
 * so a path is not merely inconvenient here, it is not addressable. `cloudinary.js`
 * was rewritten in Phase 1.5 to consume BYTES (`upload_stream` plus a Node
 * `Readable`, deliberately not a base64 data URI), and the shim supplies those
 * bytes as `req.file.buffer` — a VIEW over the already-resolved `ArrayBuffer`, so
 * no second copy of the payload is held.
 *
 * The consequence that matters at runtime: the Express SDK treats anything that is
 * not a path or a remote/data-URI string as a FILENAME. A `File`, a `Blob`, a
 * Promise, or `undefined` would all be forwarded as a path and fail with `ENOENT`,
 * or silently resolve to the uploader's `if (!file) return null` guard. Passing
 * the Buffer is what makes `upload_stream` receive a readable.
 *
 * THE EXCEPTION MESSAGE IS DELIBERATELY GENERIC. `uploadOnCloudinary` swallows
 * every non-`ApiError` failure and returns `null` (see its docblock), so a
 * Cloudinary outage, a rejected format and a bad credential are indistinguishable
 * here — all three produce this same 500. The server-side log is the only place
 * the real cause appears.
 */
const uploadAdminImage = async (req, res) => {
  // Renamed from the original's `imageLocalPath` as part of the divergence
  // below: the value is no longer a path, and a name that says otherwise is the
  // kind of stale identifier that survives three refactors. This matches
  // `user.controller.js`, where the same change produced `imageBuffer`.
  const imageBuffer = req.file?.buffer;

  if (!imageBuffer) {
    throw new ApiError(400, 'Image file is required');
  }

  // ------------------------------- TRUST BOUNDARY -------------------------------
  // BOTH VALUES BELOW COME STRAIGHT FROM `req.body`, i.e. from the client. The
  // admin chain guarantees WHO is calling (admin / moderator / mentor — and
  // `authorizeAdminAction` explicitly ALLOWS a moderator on this exact route),
  // not WHAT they may ask for.
  //
  //  - `folder` becomes the destination path inside the Cloudinary account. A
  //    caller can therefore scatter assets into any folder, including folders
  //    belonging to other features (`cpccu/profiles`), which is a storage-layout
  //    and quota concern rather than an access-control one: nothing in this
  //    application resolves an asset by folder, and every stored URL is
  //    folder-independent.
  //  - `uploadPreset` is the sharper edge. A non-empty preset makes
  //    `uploadOnCloudinary` switch from a signed `upload_stream` to an
  //    UNSIGNED `unsigned_upload_stream` against whatever preset name the caller
  //    supplied — so a caller can select any unsigned upload preset configured on
  //    this Cloudinary account and have this endpoint use it. Both spellings
  //    (`uploadPreset`, `upload_preset`) are accepted because the panel has sent
  //    both over the years.
  //
  // There is NO allowlist on either value, and that is preserved. What DOES bound
  // the damage is in `cloudinary.js`: `allowed_formats` is applied server-side
  // against the SNIFFED content (the client-declared multipart `Content-Type` is
  // ignored), the payload is capped at `MAX_UPLOAD_BYTES` by both `readMultipart`
  // and the uploader, and the stored value is whatever the panel chooses to write
  // into a document. Narrowing the folder or whitelisting presets is a security
  // change with a product decision attached, not a porting change.
  const folder = req.body.folder || 'cpccu/admin';
  const uploadPreset =
    req.body.uploadPreset ||
    req.body.upload_preset ||
    process.env.CLOUDINARY_UPLOAD_PRESET;
  const image = await uploadOnCloudinary(imageBuffer, folder, {
    uploadPreset,
  });

  // `secure_url || url` is the delivery-URL fallback: the `secure_url` is what
  // every other part of the codebase stores, and the plain `url` only appears
  // from a non-HTTPS delivery configuration. `public_id` is returned alongside it
  // so the CLIENT can record the id that a later `destroy` needs — nothing in
  // this controller persists it, and that is the leak noted above.
  if (!image?.secure_url && !image?.url) {
    throw new ApiError(500, 'Image upload failed');
  }

  return res.status(201).json(
    new ApiResponse(
      201,
      {
        url: image.secure_url || image.url,
        publicId: image.public_id,
      },
      'Image uploaded',
    ),
  );
};

export {
  createAdminCertificate,
  createAdminContent,
  deleteAdminCertificate,
  deleteAdminContent,
  getAdminStatistics,
  getAdminSystemSettings,
  listAdminCertificates,
  listAdminContent,
  listContributors,
  updateAdminCertificate,
  updateAdminContent,
  updateAdminSystemSettings,
  updateContributorMetadata,
  uploadAdminImage,
};
