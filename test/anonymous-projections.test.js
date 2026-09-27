// =============================================================================
// THE ANONYMOUS PROJECTIONS + the pending-account filter + the outbound timeouts.
//
// WHY THIS FILE EXISTS. `GET /api/v1/users/member` and
// `GET /api/v1/users/user/:id` are the only two `public: true` reads of the user
// collection, and their Mongo projection IS their entire security boundary — not
// a serializer, not a DTO layer. A field that is not in the projection string is
// not in the response, so these constants are load-bearing security config and
// are asserted here as such.
//
// THREE INVARIANTS ARE PINNED:
//
//   1. THE TWO ANONYMOUS SURFACES DIFFER, DELIBERATELY. `/users/member` is the
//      HARVEST surface (one call, every member) and stays minimal;
//      `/users/user/:id` is the per-member DISPLAY surface the public profile
//      page renders and therefore admits `coverImage` and `skills`. These were
//      once the same string, which silently blanked the profile page's cover
//      banner and Skills section while the directory kept working — the kind of
//      regression that only surfaces after cutover.
//   2. NEITHER PROJECTION CARRIES THE AUTHORISATION INPUT. `adminAuth.js:38`
//      authorises the admin panel on `user.roles.role`. `PUBLIC_ITEM` and the
//      admin panel still need it; the anonymous reads must never have it. That
//      includes the `roles.positionName` field, which LOOKS like a harmless
//      display label and is not: `admin.controller.js:225` writes
//      `positionName: positionName?.trim() || role`, `:409` writes
//      `{ role, position: 0, positionName: role }`, and `user.model.js:196`
//      defaults to `{ role: 'member', position: 0, positionName: 'member' }` — so
//      in every construction path this repository has, `positionName` IS a copy
//      of the role enum.
//   3. PENDING (UNVERIFIED) ACCOUNTS ARE EXCLUDED AT THE QUERY, NOT AT THE
//      PROJECTION. `POST /auth/register` accepts an attacker-chosen `fullName`
//      with no verification, so unverified rows are the cheapest spam to create
//      and must never reach the public directory. The old client-side filter
//      (`Member.jsx:59`, `user?.isValid !== false`) became a silent NO-OP the
//      moment `isValid` left the projection, because `undefined !== false`.
//
// A FOURTH, smaller invariant: the two outbound `fetch()` calls in the bootcamp
// controller and the two in the admin-content controller must each carry an
// `AbortSignal`. `undici` defaults `headersTimeout`/`bodyTimeout` to 300s and
// `next.config.mjs` sets no `maxDuration`, so an unbounded outbound call on an
// unauthenticated route is an invocation-pinning primitive.
//
// LOADING. Imported through the `@/` alias with `server-only` stubbed, as in
// `pure-helpers.test.js` — `test/loader.mjs` is loaded by `npm test` via
// `--import`.
//
// WHY SOME ASSERTIONS READ THE SOURCE FILE RATHER THAN CALLING THE HANDLER. The
// projection STRINGS are directly assertable, but "does `memberHandler` pass
// `{ isValid: true }` to `find`" and "does this `fetch` carry a signal" are
// properties of the call, and reaching them would mean standing up Mongoose and a
// live socket. Reading the source and asserting on it keeps the test hermetic
// AND makes the failure message point at the exact thing that changed.
// =============================================================================

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

import {
  PUBLIC_ITEM,
  PUBLIC_MEMBER_ITEM,
  PUBLIC_PROFILE_ITEM,
} from '@/lib/server/constants';
import { REPO_ROOT } from './loader.mjs';

/** Splits a Mongo projection string into its field tokens. */
const projectedFields = (projection) => projection.trim().split(/\s+/);

/**
 * Strips comment lines so an assertion cannot be satisfied by a DOCBLOCK that
 * merely names the thing being asserted. `memberHandler`'s own comment mentions
 * `.select(PUBLIC_MEMBER_ITEM)` and `User.find({ isValid: true }, …)`, so without
 * this the very tests below would pass against prose alone.
 */
const codeLines = (relativePath) =>
  readFileSync(path.join(REPO_ROOT, relativePath), 'utf8')
    .split('\n')
    .filter((line) => {
      const trimmed = line.trimStart();
      return !trimmed.startsWith('*') && !trimmed.startsWith('//');
    })
    .join('\n');

const USER_CONTROLLER = 'src/lib/server/controllers/user.controller.js';
const BOOTCAMP_CONTROLLER =
  'src/lib/server/controllers/bootcampLeaderboard.controller.js';
const ADMIN_CONTENT_CONTROLLER =
  'src/lib/server/controllers/adminContent.controller.js';

// -----------------------------------------------------------------------------
// INVARIANT 1 — the two anonymous surfaces differ, and differ on purpose
// -----------------------------------------------------------------------------
describe('the two anonymous projections', () => {
  test('PUBLIC_MEMBER_ITEM is the MINIMAL directory/harvest projection', () => {
    // Exact list, not a superset check. An extra field here is a bulk exposure:
    // one anonymous call returns EVERY member at once.
    assert.deepEqual(projectedFields(PUBLIC_MEMBER_ITEM), [
      '_id',
      'fullName',
      'avatar',
      'bio',
      'department',
      'section',
      'batch',
      'github',
      'linkedin',
      'portfolio',
      'jobPipelineStatus',
    ]);
  });

  test('PUBLIC_MEMBER_ITEM admits neither coverImage nor skills', () => {
    // The CARD (`AboutCard.jsx:19-44`) renders neither, so they would grow the
    // largest anonymous response in the app for no display value. They belong to
    // the profile surface instead.
    const fields = projectedFields(PUBLIC_MEMBER_ITEM);
    assert.equal(fields.includes('coverImage'), false);
    assert.equal(fields.includes('skills'), false);
  });

  test('PUBLIC_PROFILE_ITEM re-admits the display-only fields the profile page renders', () => {
    // `coverImage` -> `ProfileID.jsx:11-12` (the cover banner).
    // `skills`     -> `SkillsSection.jsx:10,26` via `Profile.jsx:782`
    //                 (the ENTIRE section, which otherwise collapses to its
    //                 "No skills listed yet" empty state).
    const fields = projectedFields(PUBLIC_PROFILE_ITEM);
    for (const field of ['coverImage', 'skills', '_id', 'fullName', 'avatar', 'bio']) {
      assert.ok(
        fields.includes(field),
        `PUBLIC_PROFILE_ITEM must admit ${field} — the profile page renders it`,
      );
    }
  });

  test('PUBLIC_PROFILE_ITEM contains NO bare `role` field', () => {
    // Token-exact, and also prefix-checked, because a dotted
    // `roles.positionName` would be the same disclosure.
    const fields = projectedFields(PUBLIC_PROFILE_ITEM);
    assert.equal(
      fields.includes('role'),
      false,
      'the authorising role enum must never reach an anonymous read',
    );
    assert.equal(fields.includes('roles'), false);
    assert.equal(
      fields.some((field) => field.startsWith('roles')),
      false,
      'no sub-field of `roles` may be projected either',
    );
  });

  test('PUBLIC_PROFILE_ITEM leaks NONE of the sensitive set', () => {
    // `email`/`phone` degrade to a hidden row on the profile page, which is an
    // acceptable cost; the two `*PublicId` values are Cloudinary WRITE
    // primitives, and `uniID` is an enumerable institutional identifier.
    //
    // `createdAt` is NOT in this list any more. It is the account-creation
    // timestamp — set by Mongoose on insert, not user-supplied, not editable via
    // any route, and not a credential, contact detail or identifier — and it is
    // the input to the one rendered row that needs it, the "Member since" line
    // (`ProfileHero.jsx:93` via `Profile.jsx:763`). `/users/user/:id` is a
    // per-member DISPLAY surface: the caller already had to supply a specific
    // id, and the field discloses no capability. Its presence there and its
    // ABSENCE from the harvest surface are both pinned explicitly in the test
    // below, rather than being implied by this list.
    const fields = projectedFields(PUBLIC_PROFILE_ITEM);
    for (const field of [
      'email',
      'phone',
      'uniID',
      'isValid',
      'avatarPublicId',
      'coverImagePublicId',
      'socialLinks',
      'jobPipelineTitle',
      'jobPipelineRejectionReason',
      'updatedAt',
      'password',
      'refreshTokens',
    ]) {
      assert.equal(
        fields.includes(field),
        false,
        `${field} must not appear in an anonymous projection`,
      );
    }
  });

  test('`createdAt` is admitted on the profile surface ONLY, never the directory', () => {
    // Pins the per-surface split from BOTH sides. Before this, nothing asserted
    // where `createdAt` belonged: it was absent from both projections, which
    // left the "Member since" row rendering as a broken label with an empty
    // date. It is now re-admitted on the profile surface only, and this test
    // exists so the harvest surface can never quietly pick it up.
    assert.equal(
      projectedFields(PUBLIC_PROFILE_ITEM).includes('createdAt'),
      true,
      'the profile page renders "Member since" from `createdAt`; it must be projected',
    );
    assert.equal(
      projectedFields(PUBLIC_MEMBER_ITEM).includes('createdAt'),
      false,
      'the directory is a bulk harvest surface and the member card renders no date',
    );
  });

  test('PUBLIC_ITEM is untouched — the admin panel authorises on `roles`', () => {
    // Guards the OTHER direction. `adminAuth.js:38` checks
    // `adminRoles.includes(user.roles.role)`, so an admin surface that lost
    // `roles` would lock every moderator out of the panel entirely.
    const fields = projectedFields(PUBLIC_ITEM);
    assert.ok(fields.includes('roles'), 'adminAuth.js needs roles on admin reads');
    assert.ok(fields.includes('isValid'));
    assert.ok(fields.includes('email'));
  });
});

// -----------------------------------------------------------------------------
// INVARIANT 2 — `roles.positionName` is NOT a safe display label
// -----------------------------------------------------------------------------
describe('roles.positionName is a copy of the authorising enum', () => {
  // These are not style assertions. Each one is a place in the CODEBASE that
  // writes `positionName` as the role string, and if any of them is true then
  // projecting `positionName` publishes `admin` / `moderator` / `mentor` for
  // exactly the accounts that hold panel access. The constant's docblock records
  // the finding; this keeps the finding true as the code moves.
  const cases = [
    {
      file: 'src/lib/server/controllers/admin.controller.js',
      pattern: /positionName:\s*positionName\?\.trim\(\)\s*\|\|\s*role/,
      why: 'a role grant with no display name falls back to the ROLE itself',
    },
    {
      file: 'src/lib/server/controllers/admin.controller.js',
      pattern: /roles:\s*\{\s*role,\s*position:\s*0,\s*positionName:\s*role\s*\}/,
      why: 'createAdminMember constructs positionName AS the role',
    },
    {
      file: 'src/lib/server/models/user.model.js',
      pattern: /positionName:\s*'member'/,
      why: 'the schema default is the role string too',
    },
  ];

  for (const { file, pattern, why } of cases) {
    test(`${file}: ${why}`, () => {
      assert.match(
        codeLines(file),
        pattern,
        'if this writer ever stops copying the role into positionName, the ' +
          'exclusion rationale in PUBLIC_PROFILE_ITEM must be re-assessed',
      );
    });
  }

  test('the public profile position line therefore falls back to its own literal', () => {
    // Not asserting a render — asserting the CONSEQUENCE of the exclusion, so a
    // future reader who wonders why `ProfileID.jsx:29` shows "CPCCU Member"
    // instead of a club office finds the answer here rather than in a ticket.
    const fields = projectedFields(PUBLIC_PROFILE_ITEM);
    assert.equal(
      fields.some((f) => f.startsWith('roles')),
      false,
      'the club office is not worth publishing a credential-stuffing target list for',
    );
  });
});

// -----------------------------------------------------------------------------
// INVARIANT 3 — pending accounts excluded at the QUERY
// -----------------------------------------------------------------------------
describe('memberHandler excludes unverified accounts at the query', () => {
  test('`find` is called with `{ isValid: true }`, not an empty filter', () => {
    const code = codeLines(USER_CONTROLLER);
    assert.match(
      code,
      /User\.find\(\{\s*isValid:\s*true\s*\}, PUBLIC_MEMBER_ITEM\)/,
      'the public directory must filter on isValid server-side',
    );
    // The unfiltered form must be gone: it is what published every pending
    // account once the client-side filter turned into a no-op.
    assert.equal(
      /User\.find\(\{\}, PUBLIC_MEMBER_ITEM\)/.test(code),
      false,
      'the unfiltered directory query must not come back',
    );
  });

  test('`getUserInfoById` uses PUBLIC_PROFILE_ITEM on BOTH lookup branches', () => {
    // Two branches: the ObjectId path and the `uniID` path. A projection applied
    // to only one of them would leave the other on whatever it used before, and
    // that asymmetry is invisible in the response.
    const code = codeLines(USER_CONTROLLER);
    const projections = code.match(/\.select\(PUBLIC_(?:MEMBER|PROFILE)_ITEM\)/g) ?? [];
    assert.equal(
      projections.length,
      2,
      'expected exactly two anonymous .select() projections — the ObjectId ' +
        'branch and the uniID branch',
    );
    assert.equal(
      projections.filter((p) => p.includes('PROFILE')).length,
      2,
      'both branches of getUserInfoById must use the profile projection',
    );
  });

  test('the projection still contains no `isValid`, even though it is now a filter', () => {
    // The flag is a QUERY predicate, not a response field. Re-projecting it would
    // hand an anonymous caller a way to probe pending accounts by id, which the
    // query filter just removed.
    assert.equal(projectedFields(PUBLIC_MEMBER_ITEM).includes('isValid'), false);
    assert.equal(projectedFields(PUBLIC_PROFILE_ITEM).includes('isValid'), false);
  });

  test('the handler still answers 200 with the ApiResponse envelope', () => {
    // The filter narrows WHICH documents come back; it must not change the
    // envelope or the status, or every consumer of the member list breaks.
    const code = codeLines(USER_CONTROLLER);
    assert.match(
      code,
      /return res\.status\(200\)\.json\(new ApiResponse\(200, member, 'Members data'\)\);/,
    );
  });
});

// -----------------------------------------------------------------------------
// The outbound timeouts
// -----------------------------------------------------------------------------
describe('outbound fetch() calls are bounded', () => {
  test('the bootcamp controller budgets each Sheets call at 8s', () => {
    const code = codeLines(BOOTCAMP_CONTROLLER);
    // Named constant rather than an inlined literal, so the value is greppable
    // and there is exactly one place to change it.
    assert.match(code, /SHEETS_REQUEST_TIMEOUT_MS\s*=\s*8000;/);
    // Exactly ONE bare `fetch(` survives: the shared helper's own. Both call
    // sites must route through it, so a new call site added later cannot
    // silently ship unbounded.
    assert.equal(
      (code.match(/await fetch\(/g) ?? []).length,
      1,
      'both Sheets call sites must go through the timeout helper',
    );
    assert.match(code, /signal:\s*AbortSignal\.timeout\(SHEETS_REQUEST_TIMEOUT_MS\)/);
  });

  test('an abort on the bootcamp path becomes the EXISTING 502, not a new status', () => {
    const code = codeLines(BOOTCAMP_CONTROLLER);
    // Both messages are the ones the 502 branches already used. Introducing a
    // distinct timeout status would change the API contract the frontend is
    // written against, for a condition it cannot act on differently.
    assert.match(code, /new ApiError\(502, message\)/);
    assert.match(code, /'Failed to read bootcamp sheet metadata'/);
    assert.match(code, /'Failed to read bootcamp leaderboard data'/);

    // The abort must be caught, not left to escape. An escaping
    // `DOMException`/`TypeError` becomes a generic 500 — "our server is broken"
    // for a fault that is entirely upstream — and an ESCAPING rejection on a
    // public route is worse still. The helper's `catch` is the whole point.
    assert.match(
      code,
      /catch \(error\)\s*\{[\s\S]{0,400}?throw new ApiError\(502, message\)/,
      'the abort must be caught and rethrown as the 502',
    );

    // No retry. A transport retry here would multiply the very hold-time the
    // bound exists to cap: one stalled caller would occupy up to N x the budget.
    // The controller makes exactly two calls, in sequence, with no loop.
    assert.equal(
      /\b(while|for)\s*\(/.test(code),
      false,
      'the bootcamp handler must not loop — one stall, one bounded failure',
    );
  });

  test('both GitHub Contents calls carry a 10s per-attempt signal', () => {
    const code = codeLines(ADMIN_CONTENT_CONTROLLER);
    assert.match(code, /GITHUB_REQUEST_TIMEOUT_MS\s*=\s*10000;/);
    const signals = code.match(/signal:\s*AbortSignal\.timeout\(/g) ?? [];
    assert.equal(
      signals.length,
      2,
      'the Contents READ and the Contents PUT must each be bounded',
    );
    // A transport failure must reach the same 502 the non-2xx branch produces,
    // in both places, so the admin panel keeps its existing error handling.
    assert.match(code, /'Failed to fetch contributors\.json from GitHub'/);
    assert.match(code, /'Failed to write contributors\.json to GitHub'/);
  });

  test('a GitHub failure log line cannot carry the bearer token', () => {
    // Both calls send `Authorization: Bearer <token>`. If someone ever widens a
    // `console.error` to interpolate the error or the request, this is the
    // assertion that fails. Only the error NAME is ever logged.
    const code = codeLines(ADMIN_CONTENT_CONTROLLER);
    const logLines = code
      .split('\n')
      .filter((line) => line.includes('console.error') || line.includes('`[adminContent]'));
    for (const line of logLines) {
      assert.equal(
        /Authorization|Bearer|CONTRIBUTOR_GITHUB_TOKEN|getGitHubToken/.test(line),
        false,
        `a GitHub log line must not interpolate a credential: ${line.trim()}`,
      );
    }
  });
});

// -----------------------------------------------------------------------------
// The two projections must stay in sync with the routes that use them
// -----------------------------------------------------------------------------
describe('the projections are actually wired to the handlers that claim them', () => {
  test('the constant module exports all three', () => {
    // A rename that dropped one would make a projection silently undefined and
    // every `.select(undefined)` a full-document read.
    for (const name of ['PUBLIC_ITEM', 'PUBLIC_MEMBER_ITEM', 'PUBLIC_PROFILE_ITEM']) {
      assert.equal(
        typeof { PUBLIC_ITEM, PUBLIC_MEMBER_ITEM, PUBLIC_PROFILE_ITEM }[name],
        'string',
        `${name} must be a non-empty projection string`,
      );
    }
  });

  test('the route files still mark both user reads `public: true`', () => {
    // The projection is only a security boundary while the route is
    // UNAUTHENTICATED. If either route gained a session requirement the
    // reasoning changes; if it LOST one by accident, the projection is
    // over-restrictive but still safe. This asserts the state, so the next
    // reader knows which branch they are in.
    const memberRoute = readFileSync(
      path.join(REPO_ROOT, 'src/app/api/v1/users/member/route.js'),
      'utf8',
    );
    const userRoute = readFileSync(
      path.join(REPO_ROOT, 'src/app/api/v1/users/user/[id]/route.js'),
      'utf8',
    );
    assert.match(memberRoute, /public:\s*true/);
    assert.match(userRoute, /public:\s*true/);
  });
});
