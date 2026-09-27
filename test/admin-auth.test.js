// =============================================================================
// `adminAuth.js` — the admin role matrix.
//
// WHY THIS IS THE HIGHEST-VALUE TEST IN THE REPOSITORY.
//
//   - The Express original (`cpccu-server/src/middlewares/admin.middleware.js:14-44`)
//     had ZERO test coverage, so the matrix was re-derived from scratch four
//     separate times during the Next 16 migration.
//   - A WRONG VERDICT IN EITHER DIRECTION IS SILENT. `authorizeAdminAction`
//     returns `true` or throws; it never logs, never 403s-with-a-different-body,
//     and never fails a build. A moderator who is wrongly DENIED just sees "you
//     do not have permission" and files a bug; a member or mentor who is wrongly
//     ALLOWED gets a working admin write and nobody ever finds out. Neither
//     direction produces a signal that a test would otherwise catch.
//
// LOADING. This file imports the module under test through the `@/` alias and
// the module's own `import 'server-only'`, neither of which plain `node` can
// resolve. Both are handled once, in `test/loader.mjs`, which `npm test` loads
// via `--import`. Nothing in this file knows or cares about that.
// =============================================================================

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  ADMIN_UPLOAD_PATH,
  adminRoles,
  authorizeAdminAction,
  authorizeAdminPath,
  describeAdminRoute,
  mentorReadPaths,
  moderatorResources,
  requireAdmin,
  requireAdminAction,
} from "@/lib/server/adminAuth";
import { ApiError } from "@/lib/server/errors";

// -----------------------------------------------------------------------------
// THE MATRIX
// -----------------------------------------------------------------------------
// One row per ADMIN ENDPOINT METHOD EXPORT, which is 24 across the 16 route
// files under `src/app/api/v1/admin/**`. `expected` is the verdict for each of
// the four roles.
//
// A CONCRETE PATH IS USED, NOT THE `:param` TEMPLATE, because the whole point of
// `describeAdminRoute` is that the derived `resource` / `isUpload` / `path` come
// from the literal pathname. A placeholder would test a path the router can
// never produce. `alice` / `42` are ordinary literal segment values; the
// `/contributors/gh-octocat` row uses a real GitHub-style handle because that
// route's parameter is a username.
//
// `expected` is written as the four booleans in the fixed order
//   [ admin, moderator, mentor, member ]
// and `member` is `false` in every row — see the dedicated test below for why
// that is a business rule rather than an accident of the table.
const MATRIX = [
  // ---- /certificates -------------------------------------------------------
  // `requireAdmin` passes for a mentor on a PATCH, then `authorizeAdminAction`
  // requires `method === 'GET'`, so a mentor is refused every write here.
  {
    label: "PATCH /api/v1/admin/certificates/:id",
    method: "PATCH",
    pathname: "/api/v1/admin/certificates/65f0000000000000000000a1",
    expected: { admin: true, moderator: false, mentor: false, member: false },
  },
  {
    label: "DELETE /api/v1/admin/certificates/:id",
    method: "DELETE",
    pathname: "/api/v1/admin/certificates/65f0000000000000000000a1",
    expected: { admin: true, moderator: false, mentor: false, member: false },
  },
  // `/certificates` IS a mentor prefix, and the method is GET, so a mentor is
  // allowed to LIST certificates.
  {
    label: "GET /api/v1/admin/certificates",
    method: "GET",
    pathname: "/api/v1/admin/certificates",
    expected: { admin: true, moderator: true, mentor: true, member: false },
  },
  {
    label: "POST /api/v1/admin/certificates",
    method: "POST",
    pathname: "/api/v1/admin/certificates",
    expected: { admin: true, moderator: false, mentor: false, member: false },
  },

  // ---- /content/:resource --------------------------------------------------
  // The one place a moderator WRITE is allowed: `path.startsWith('/content/')`
  // AND `resource` is in `moderatorResources`. `resource` is derived as segment
  // 1 of the mount-relative path, i.e. `events` here.
  {
    label: "PATCH /api/v1/admin/content/:resource/:id",
    method: "PATCH",
    pathname: "/api/v1/admin/content/events/65f0000000000000000000b1",
    expected: { admin: true, moderator: true, mentor: false, member: false },
  },
  {
    label: "DELETE /api/v1/admin/content/:resource/:id",
    method: "DELETE",
    pathname: "/api/v1/admin/content/events/65f0000000000000000000b1",
    expected: { admin: true, moderator: true, mentor: false, member: false },
  },
  {
    label: "GET /api/v1/admin/content/:resource",
    method: "GET",
    pathname: "/api/v1/admin/content/events",
    expected: { admin: true, moderator: true, mentor: false, member: false },
  },
  {
    label: "POST /api/v1/admin/content/:resource",
    method: "POST",
    pathname: "/api/v1/admin/content/events",
    expected: { admin: true, moderator: true, mentor: false, member: false },
  },

  // ---- /contributors -------------------------------------------------------
  // A moderator is refused a contributor PATCH: `/contributors` is not under
  // `/content/`, so neither the upload nor the content rule applies, and the
  // method is not GET. Moderators therefore have READ access to contributors
  // (the next row) but can never write one.
  {
    label: "PATCH /api/v1/admin/contributors/:githubUsername",
    method: "PATCH",
    pathname: "/api/v1/admin/contributors/gh-octocat",
    expected: { admin: true, moderator: false, mentor: false, member: false },
  },
  // ###########################################################################
  // THIS ROW IS THE ONE THAT WILL BE "FIXED" WRONGLY. READ IT.
  //
  // `GET /api/v1/admin/contributors` is DENIED FOR A MENTOR.
  //
  // The comment at `cpccu-server/src/routes/admin.route.js:76` claims that
  // `/contributors` is "readable by any admin-role user" and that mentors can
  // read it. THE CODE SAYS OTHERWISE: `contributors` is not in
  // `mentorReadPaths`, so a mentor's GET falls through to the 403.
  //
  // THE CODE IS THE CONTRACT. This row encodes the code, deliberately, so that
  // the comment and the test can never drift apart silently. If someone later
  // decides mentors SHOULD read contributors, the correct change is to add
  // `'contributors'` to `mentorReadPaths` in `adminAuth.js` AND update
  // `cpccu-server/src/routes/admin.route.js:76` in the same change — and this
  // test is what will point at exactly the row that has to move. Silently
  // "fixing" the test to match the stale comment, or "fixing" the code to match
  // the stale comment without the test, both destroy the only thing keeping the
  // matrix honest.
  // ###########################################################################
  {
    label:
      "GET /api/v1/admin/contributors  (STALE-COMMENT ROW: mentors denied)",
    method: "GET",
    pathname: "/api/v1/admin/contributors",
    expected: { admin: true, moderator: true, mentor: false, member: false },
  },

  // ---- /members ------------------------------------------------------------
  {
    label: "PATCH /api/v1/admin/members/:id",
    method: "PATCH",
    pathname: "/api/v1/admin/members/65f0000000000000000000c1",
    expected: { admin: true, moderator: false, mentor: false, member: false },
  },
  {
    label: "DELETE /api/v1/admin/members/:id",
    method: "DELETE",
    pathname: "/api/v1/admin/members/65f0000000000000000000c1",
    expected: { admin: true, moderator: false, mentor: false, member: false },
  },
  {
    label: "GET /api/v1/admin/members",
    method: "GET",
    pathname: "/api/v1/admin/members",
    expected: { admin: true, moderator: true, mentor: true, member: false },
  },
  {
    label: "POST /api/v1/admin/members",
    method: "POST",
    pathname: "/api/v1/admin/members",
    expected: { admin: true, moderator: false, mentor: false, member: false },
  },

  // ---- /overview -----------------------------------------------------------
  {
    label: "GET /api/v1/admin/overview",
    method: "GET",
    pathname: "/api/v1/admin/overview",
    expected: { admin: true, moderator: true, mentor: true, member: false },
  },

  // ---- /roles --------------------------------------------------------------
  // `/roles` is NOT a mentor prefix. A mentor has no visibility into the role
  // catalogue at all, which is the strongest statement in this matrix about
  // what a mentor is for.
  {
    label: "GET /api/v1/admin/roles/active",
    method: "GET",
    pathname: "/api/v1/admin/roles/active",
    expected: { admin: true, moderator: true, mentor: false, member: false },
  },
  {
    label: "PATCH /api/v1/admin/roles/:id",
    method: "PATCH",
    pathname: "/api/v1/admin/roles/65f0000000000000000000d1",
    expected: { admin: true, moderator: false, mentor: false, member: false },
  },
  {
    label: "PATCH /api/v1/admin/roles/:id/toggle",
    method: "PATCH",
    pathname: "/api/v1/admin/roles/65f0000000000000000000d1/toggle",
    expected: { admin: true, moderator: false, mentor: false, member: false },
  },
  {
    label: "GET /api/v1/admin/roles",
    method: "GET",
    pathname: "/api/v1/admin/roles",
    expected: { admin: true, moderator: true, mentor: false, member: false },
  },
  {
    label: "POST /api/v1/admin/roles",
    method: "POST",
    pathname: "/api/v1/admin/roles",
    expected: { admin: true, moderator: false, mentor: false, member: false },
  },

  // ---- /statistics ---------------------------------------------------------
  // A mentor may read the statistics dashboard in full.
  {
    label: "GET /api/v1/admin/statistics",
    method: "GET",
    pathname: "/api/v1/admin/statistics",
    expected: { admin: true, moderator: true, mentor: true, member: false },
  },

  // ---- /system-settings ----------------------------------------------------
  {
    label: "GET /api/v1/admin/system-settings",
    method: "GET",
    pathname: "/api/v1/admin/system-settings",
    expected: { admin: true, moderator: true, mentor: false, member: false },
  },
  {
    label: "PATCH /api/v1/admin/system-settings",
    method: "PATCH",
    pathname: "/api/v1/admin/system-settings",
    expected: { admin: true, moderator: false, mentor: false, member: false },
  },

  // ---- /uploads/image ------------------------------------------------------
  // The ONLY non-`/content/` moderator write, and it is allowed by an EXACT
  // string match against ADMIN_UPLOAD_PATH — not by a prefix test. The
  // neighbouring rows below prove the exactness.
  {
    label: "POST /api/v1/admin/uploads/image",
    method: "POST",
    pathname: "/api/v1/admin/uploads/image",
    expected: { admin: true, moderator: true, mentor: false, member: false },
  },
];

// The four roles the matrix is evaluated over, in the order the table's
// `expected` object is written. Explicit rather than derived from
// `Object.keys` so a reordering of the table cannot silently change meaning.
const ROLES = ["admin", "moderator", "mentor", "member"];

// THE MATRIX IS COMPLETE OR THE TEST IS WRONG. `authorizeAdminPath` is
// path-based, so a new admin route is not automatically covered by the rows
// above; pinning the count means adding a 25th endpoint without a 25th row
// fails this file loudly instead of leaving the new row untested.
test("the matrix covers all 24 admin endpoint method exports", () => {
  assert.equal(
    MATRIX.length,
    24,
    "the admin role matrix must have one row per admin endpoint method export",
  );
  assert.equal(
    new Set(MATRIX.map((row) => row.label)).size,
    24,
    "matrix rows must be unique",
  );
});

describe("authorizeAdminPath — the full 24 × 4 admin role matrix", () => {
  for (const row of MATRIX) {
    for (const role of ROLES) {
      const allowed = row.expected[role];
      const outcome = allowed ? "ALLOWED" : "DENIED (403)";

      test(`${allowed ? "allows" : "denies"} ${role.padEnd(9)} ${outcome.padEnd(11)} — ${row.label}`, () => {
        if (allowed) {
          // `authorizeAdminPath` returns `undefined` on success (it delegates to
          // `authorizeAdminAction`, which returns `true`, and does not forward
          // it). The success signal is "did not throw", so that is what is
          // asserted — asserting on the return value would pin an accident.
          assert.doesNotThrow(() =>
            authorizeAdminPath({
              role,
              method: row.method,
              pathname: row.pathname,
            }),
          );
          return;
        }

        // Every denial must be the SAME 403 with the same message. A different
        // status or message would mean the request fell through some other path
        // (e.g. a 404 from the router, or a 500 from a bug) and the matrix cell
        // would be right for the wrong reason.
        assert.throws(
          () =>
            authorizeAdminPath({
              role,
              method: row.method,
              pathname: row.pathname,
            }),
          (error) => {
            assert.ok(
              error instanceof ApiError,
              `expected an ApiError, got ${error}`,
            );
            assert.equal(error.statusCode, 403);
            assert.equal(
              error.message,
              "You do not have permission for this admin action",
            );
            return true;
          },
        );
      });
    }
  }
});

// -----------------------------------------------------------------------------
// THE SUBTLE ROWS, CALLED OUT EXPLICITLY
// -----------------------------------------------------------------------------
// They are already covered by the matrix above. They are restated here one by
// one because each is a place where a plausible-looking "simplification" of
// `adminAuth.js` would silently flip a verdict, and a named test is what stops
// someone from flipping it and not noticing.

describe("the subtle cases, named", () => {
  test("`member` is rejected by requireAdmin for EVERY endpoint", () => {
    // BUSINESS RULE, and the asymmetry is deliberate. `adminRoles` is
    // `['admin', 'moderator', 'mentor']` — a `member` is REJECTED even though
    // `controllers/admin.controller.js` allows `member` as a value an admin may
    // ASSIGN during role management. Being a role an admin may GRANT is not the
    // same as being a role that GRANTS panel access. Adding `member` to
    // `adminRoles` would hand every ordinary member read access to the entire
    // admin panel.
    for (const role of ["admin", "moderator", "mentor"]) {
      assert.equal(
        adminRoles.includes(role),
        true,
        `${role} must be an admin-panel role`,
      );
    }
    assert.equal(
      adminRoles.includes("member"),
      false,
      "member must NOT be an admin-panel role",
    );

    // `requireAdmin` is the role gate and knows nothing about paths.
    assert.throws(
      () => requireAdmin({ roles: { role: "member" } }),
      /Admin access is required/,
    );
    assert.doesNotThrow(() => requireAdmin({ roles: { role: "mentor" } }));
    // A missing / malformed user document is rejected too, not treated as
    // "no opinion" — this is the fail-closed direction.
    assert.throws(() => requireAdmin(undefined), /Admin access is required/);
    assert.throws(() => requireAdmin({}), /Admin access is required/);
    assert.throws(
      () => requireAdmin({ roles: {} }),
      /Admin access is required/,
    );

    // And across the whole matrix, `member` is denied in all 24 rows.
    for (const row of MATRIX) {
      assert.equal(row.expected.member, false, `${row.label} must deny member`);
    }
  });

  test('HEAD is DENIED for moderator and mentor — the read test is `=== "GET"`', () => {
    // `authorizeAdminAction` computes `const isReadOnly = method === 'GET'`.
    // That is an EQUALITY test, not an idempotent-method test, so `HEAD` does not
    // count as a read for the moderator branch. It matters because "improve"
    // this to `['GET', 'HEAD'].includes(method)` is exactly the kind of change
    // that looks harmless and is not: it would hand a moderator or a mentor a
    // second verb on every endpoint.
    assert.throws(() =>
      authorizeAdminPath({
        role: "moderator",
        method: "HEAD",
        pathname: "/api/v1/admin/certificates",
      }),
    );
    assert.throws(() =>
      authorizeAdminPath({
        role: "mentor",
        method: "HEAD",
        pathname: "/api/v1/admin/members",
      }),
    );

    // ...while the same paths on GET are allowed for both roles, so the
    // assertions above are about the METHOD and not about the path.
    assert.doesNotThrow(() =>
      authorizeAdminPath({
        role: "moderator",
        method: "GET",
        pathname: "/api/v1/admin/certificates",
      }),
    );
    assert.doesNotThrow(() =>
      authorizeAdminPath({
        role: "mentor",
        method: "GET",
        pathname: "/api/v1/admin/members",
      }),
    );

    // And a moderator is still allowed a HEAD on the one endpoint that is
    // allowed outright by an exact-path match rather than by a read/write test:
    // `isUpload` is checked before `isReadOnly` in the same `if`.
    assert.doesNotThrow(() =>
      authorizeAdminPath({
        role: "moderator",
        method: "HEAD",
        pathname: "/api/v1/admin/uploads/image",
      }),
    );
  });

  test("POST /uploads/image is allowed for a moderator by an EXACT match", () => {
    // `ADMIN_UPLOAD_PATH` is compared with `===`, NOT with `startsWith`. The
    // asymmetry with the mentor prefix test is load-bearing: `/uploads/image-2`
    // and `/uploads/image/:id` are DIFFERENT routes and neither is the upload
    // route, so neither may be reached by a moderator on the strength of the
    // upload rule.
    assert.equal(ADMIN_UPLOAD_PATH, "/uploads/image");

    assert.doesNotThrow(() =>
      authorizeAdminPath({
        role: "moderator",
        method: "POST",
        pathname: "/api/v1/admin/uploads/image",
      }),
    );

    // Prefix look-alikes. Each is denied BECAUSE the upload rule does not fire;
    // they are not under `/content/`, and the method is not GET.
    for (const pathname of [
      "/api/v1/admin/uploads/image-2",
      "/api/v1/admin/uploads/image/65f0000000000000000000e1",
      "/api/v1/admin/uploads/image-preview",
    ]) {
      assert.throws(
        () =>
          authorizeAdminPath({ role: "moderator", method: "POST", pathname }),
        /You do not have permission/,
        `${pathname} must not satisfy the moderator upload rule`,
      );
    }

    // The same look-alikes are also denied for a mentor (wrong method AND wrong
    // prefix), and the derived `isUpload` flag is what decides — asserted
    // directly on `describeAdminRoute` so the derivation itself is pinned, not
    // just its effect.
    assert.equal(
      describeAdminRoute("/api/v1/admin/uploads/image").isUpload,
      true,
    );
    assert.equal(
      describeAdminRoute("/api/v1/admin/uploads/image-2").isUpload,
      false,
    );
    assert.equal(
      describeAdminRoute("/api/v1/admin/uploads/image/42").isUpload,
      false,
    );
  });

  test("mentor prefixes are genuine `startsWith`, so sub-paths and near-misses are ALLOWED", () => {
    // `mentorReadPaths` is tested with `path.startsWith(prefix)`, so anything
    // beginning with an allowed segment matches — including a deeper path and a
    // longer word that merely starts with the same characters. This is a REAL
    // property of the ported code, not an accident: the Express original did
    // exactly the same `mentorReadPaths.some((p) => req.path.startsWith(p))`.
    // The two obvious-looking "tightenings" are both behaviour changes:
    //   - `'/statistics/2024'` is allowed  → a per-year statistics sub-route is
    //     covered by the `/statistics` prefix on purpose;
    //   - `'/overviewx'` is allowed        → there is no such route, and no such
    //     route can be added without also updating `mentorReadPaths`, so the
    //     loose prefix grants nothing today. It is pinned here so that anyone
    //     who later "fixes" the prefix to a segment-boundary test knows this
    //     test exists and is a deliberate behaviour change, not a no-op cleanup.
    assert.deepEqual(mentorReadPaths, [
      "/overview",
      "/members",
      "/certificates",
      "/statistics",
    ]);

    for (const pathname of [
      "/api/v1/admin/statistics/2024",
      "/api/v1/admin/overviewx",
      "/api/v1/admin/members/65f0000000000000000000c1",
      "/api/v1/admin/certificates/abc",
    ]) {
      assert.doesNotThrow(
        () => authorizeAdminPath({ role: "mentor", method: "GET", pathname }),
        `${pathname} must be readable by a mentor`,
      );
    }

    // A path that does NOT begin with any allowed segment is denied, on GET as
    // well as on every other method.
    for (const pathname of [
      "/api/v1/admin/contributors",
      "/api/v1/admin/roles",
      "/api/v1/admin/system-settings",
      "/api/v1/admin/uploads/image",
    ]) {
      assert.throws(
        () => authorizeAdminPath({ role: "mentor", method: "GET", pathname }),
        /You do not have permission/,
        `${pathname} must NOT be readable by a mentor`,
      );
    }
  });

  test("GET /api/v1/admin/contributors is DENIED for a mentor (the stale comment at admin.route.js:76 is wrong)", () => {
    // See the long block comment on the matrix row above. Short version: the
    // comment at `cpccu-server/src/routes/admin.route.js:76` says mentors can
    // read `/contributors`; the code says they cannot; the code is the contract
    // and this test encodes the code.
    assert.throws(
      () =>
        authorizeAdminPath({
          role: "mentor",
          method: "GET",
          pathname: "/api/v1/admin/contributors",
        }),
      /You do not have permission/,
    );

    // The denial is specifically because `contributors` is absent from
    // `mentorReadPaths` — not because of the method, and not because the prefix
    // machinery is broken. An admin and a moderator are allowed on the very same
    // request.
    assert.equal(mentorReadPaths.includes("/contributors"), false);
    assert.doesNotThrow(() =>
      authorizeAdminPath({
        role: "admin",
        method: "GET",
        pathname: "/api/v1/admin/contributors",
      }),
    );
    assert.doesNotThrow(() =>
      authorizeAdminPath({
        role: "moderator",
        method: "GET",
        pathname: "/api/v1/admin/contributors",
      }),
    );
  });

  test("moderators can write to exactly events, gallery, posts and gallery-events", () => {
    // THE EXACT FOUR. Both directions matter: a resource that is missing from
    // `moderatorResources` must be denied on a write, and a resource that is on
    // the list must be allowed — including `gallery-events`, which is a
    // two-segment-looking name and would be caught by any "split on `-`" or
    // "first segment only" shortcut.
    assert.deepEqual(moderatorResources, [
      "events",
      "gallery",
      "posts",
      "gallery-events",
    ]);

    const resources = [
      // the four allowed
      "events",
      "gallery",
      "posts",
      "gallery-events",
      // resources that exist as admin content but are moderator-controlled: NO
      "alumni",
      "contributors",
      "audit-logs",
      "certificates",
      // obvious injection attempts through the segment
      "__proto__",
      "constructor",
      "toString",
      // case variants: the comparison is exact and case-SENSITIVE
      "Events",
      "GALLERY",
    ];

    for (const resource of resources) {
      const allowed = moderatorResources.includes(resource);

      if (allowed) {
        assert.doesNotThrow(
          () =>
            authorizeAdminPath({
              role: "moderator",
              method: "POST",
              pathname: `/api/v1/admin/content/${resource}`,
            }),
          `moderator must be able to write ${resource}`,
        );
      } else {
        assert.throws(
          () =>
            authorizeAdminPath({
              role: "moderator",
              method: "POST",
              pathname: `/api/v1/admin/content/${resource}`,
            }),
          /You do not have permission/,
          `moderator must NOT be able to write ${resource}`,
        );
      }
    }

    // A `/content/` path with NO resource segment derives `resource: null`, and
    // `moderatorResources.includes(null)` is false — so a bare `/content/` write
    // is denied rather than defaulting to allowed.
    assert.equal(describeAdminRoute("/api/v1/admin/content").resource, null);
    assert.throws(
      () =>
        authorizeAdminPath({
          role: "moderator",
          method: "POST",
          pathname: "/api/v1/admin/content",
        }),
      /You do not have permission/,
    );

    // A `/content/<allowed>/<deeper>/<deeper>` path still derives the SAME
    // resource, because only segment 1 of the mount-relative path is consulted.
    assert.equal(
      describeAdminRoute("/api/v1/admin/content/posts/a/b/c").resource,
      "posts",
    );
  });
});

// -----------------------------------------------------------------------------
// `describeAdminRoute` — the mount-prefix strip
// -----------------------------------------------------------------------------
describe("describeAdminRoute strips the mount prefix on a SEGMENT BOUNDARY", () => {
  test("a genuinely mounted path is stripped, and the admin root survives", () => {
    assert.equal(
      describeAdminRoute("/api/v1/admin/overview").path,
      "/overview",
    );
    assert.equal(describeAdminRoute("/api/v1/admin/overview").resource, null);
    assert.equal(describeAdminRoute("/api/v1/admin/overview").isUpload, false);

    // `pathname === mountPrefix` exactly: the strip yields `''`, which is
    // normalised to `'/'` rather than left as an empty string, because every
    // consumer compares `path` with `startsWith` against a `'/…'` prefix and an
    // empty string would match nothing at all.
    const root = describeAdminRoute("/api/v1/admin");
    assert.equal(root.path, "/");
    assert.equal(root.resource, null);
    assert.equal(root.isUpload, false);
  });

  test("/api/v1/administrator/… is NOT stripped — the prefix is matched on a segment boundary", () => {
    // THIS IS THE ROW THAT MATTERS. `/api/v1/administrator/overview` starts with
    // the string `/api/v1/admin`, so a bare `startsWith` would strip it to
    // `istrator/overview` and hand THAT to the allowlists. Today the outcome
    // would be identical — `'istrator/overview'` matches no mentor prefix and no
    // moderator rule, so the request is still denied, i.e. it FAILS CLOSED —
    // which is exactly why the bug is easy to miss. But the two tests are
    // deliberately asymmetric (`isUpload` is an exact `===` while the mentor
    // paths are prefixes), and a loose strip here makes the prefix handling look
    // equally sloppy, inviting a future "cleanup" that reintroduces the
    // fail-OPEN variant. So the boundary is asserted explicitly.
    const sibling = describeAdminRoute("/api/v1/administrator/overview");
    assert.equal(
      sibling.path,
      "/api/v1/administrator/overview",
      "the path must be returned UNSTRIPPED",
    );
    assert.notEqual(sibling.path, "/istrator/overview");

    // And the consequence: not stripped, so not a mentor read.
    assert.throws(
      () =>
        authorizeAdminPath({
          role: "mentor",
          method: "GET",
          pathname: "/api/v1/administrator/overview",
        }),
      /You do not have permission/,
    );

    // The same holds for every longer sibling name that shares the prefix.
    for (const pathname of [
      "/api/v1/administrator/overview",
      "/api/v1/admins/overview",
      "/api/v1/admin-panel/overview",
      "/api/v1/adminx/uploads/image",
    ]) {
      assert.equal(
        describeAdminRoute(pathname).path,
        pathname,
        `${pathname} shares the mount prefix as a string but not as a segment`,
      );
    }
  });

  test("the mount prefix is an argument, so a different mount still lines up", () => {
    // `mountPrefix` is a parameter rather than a hard-coded constant so that if
    // the admin routes are ever mounted elsewhere the derivation still produces
    // mount-relative paths comparable with the allowlists. Pinned here because a
    // change from "argument" to "hard-coded" would compile and pass every other
    // test in this file.
    assert.equal(
      describeAdminRoute("/api/v2/admin/overview", "/api/v2/admin").path,
      "/overview",
    );
    assert.equal(
      describeAdminRoute("/api/v1/admin/overview", "/api/v2/admin").path,
      "/api/v1/admin/overview",
    );
  });

  test("the derived resource comes from segment 1 of the MOUNT-RELATIVE path", () => {
    // The single most consequential line in the file. Inside a MOUNTED Express
    // router `req.path` is relative to the mount, so `'/content/events'` splits
    // to `['', 'content', 'events']` and the RESOURCE is index 2. In the App
    // Router `request.nextUrl.pathname` is ABSOLUTE, so
    // `'/api/v1/admin/content/events'` splits to
    // `['', 'api', 'v1', 'admin', 'content', 'events']` whose index 2 is `'v1'`.
    // Copying the Express index across therefore yields `resource === 'v1'`,
    // which is in no allowlist, and every moderator write to posts / events /
    // gallery is DENIED with a bare 403 and no server-side error. "Correcting"
    // it by index-from-the-end or by inverting it SILENTLY GRANTS the same
    // writes. Neither variant throws, which is why the derivation happens once,
    // here, and why no caller supplies `resource`.
    assert.deepEqual(
      "/api/v1/admin/content/events".split("/").filter(Boolean),
      ["api", "v1", "admin", "content", "events"],
    );
    assert.equal(
      describeAdminRoute("/api/v1/admin/content/events").resource,
      "events",
    );
    // The naive port's own output, asserted so the failure mode is visible:
    assert.equal("/api/v1/admin/content/events".split("/")[2], "v1");

    // `resource` is only derived for `/content/…`; every other admin route has
    // no collection segment at all.
    for (const pathname of [
      "/api/v1/admin/certificates",
      "/api/v1/admin/members/42",
      "/api/v1/admin/roles/active",
      "/api/v1/admin/overview",
      "/api/v1/admin/contributors/gh-octocat",
      "/api/v1/admin/uploads/image",
    ]) {
      assert.equal(
        describeAdminRoute(pathname).resource,
        null,
        `${pathname} must have no resource`,
      );
    }
  });
});

// -----------------------------------------------------------------------------
// THE FAIL-OPEN FOOTGUN: A CALLER CANNOT OVERRIDE THE DERIVED CONTEXT
// -----------------------------------------------------------------------------
describe("a caller cannot override the derived resource / isUpload / path", () => {
  test("authorizeAdminPath takes no such arguments, and extra ones are ignored", () => {
    // `authorizeAdminAction` is a faithful 1:1 port of the Express middleware
    // and still accepts a caller-supplied `resource`, `isUpload` and `path`. It
    // is `@deprecated` for external use for exactly one reason: every one of
    // those arguments is DERIVABLE from the path, and a derivable argument a
    // caller may also override is an argument that will eventually be overridden
    // wrongly. A route author who computes `pathname` correctly but hardcodes
    // `resource: 'events'` on a `/content/gallery` route GRANTS a moderator a
    // write they should not have, and nothing in the signature flags it.
    //
    // `authorizeAdminPath` is the shape that makes that impossible: it derives
    // the context itself and calls `authorizeAdminAction` with `role` spread
    // LAST, so a future edit cannot reintroduce a caller-supplied `resource`
    // without visibly reordering that object.
    assert.doesNotThrow(() =>
      authorizeAdminPath({
        role: "moderator",
        method: "GET",
        pathname: "/api/v1/admin/overview",
        // A caller that tries to smuggle the old arguments in. The pathname
        // says "overview" — nothing is writable — and the extra keys must not
        // change the verdict.
        resource: "events",
        isUpload: true,
        path: "/content/posts",
      }),
    );

    // The same smuggling attempt against a path that DOES grant a moderator a
    // write, to show the override is inert in the permissive direction too.
    assert.doesNotThrow(() =>
      authorizeAdminPath({
        role: "moderator",
        method: "POST",
        pathname: "/api/v1/admin/content/events",
        resource: "alumni",
        isUpload: false,
        path: "/overview",
      }),
    );

    // The decisive case: extra keys cannot turn a DENIAL into an ALLOWANCE.
    assert.throws(
      () =>
        authorizeAdminPath({
          role: "moderator",
          method: "POST",
          pathname: "/api/v1/admin/content/alumni",
          resource: "events",
          isUpload: true,
          path: "/content/events",
        }),
      /You do not have permission/,
      "caller-supplied resource/isUpload/path must not grant a write",
    );

    // Same for a mentor, and same for a member — nothing about a role can be
    // smuggled in either.
    assert.throws(
      () =>
        authorizeAdminPath({
          role: "mentor",
          method: "POST",
          pathname: "/api/v1/admin/contributors",
          path: "/overview",
        }),
      /You do not have permission/,
    );
    assert.throws(
      () =>
        authorizeAdminPath({
          role: "member",
          method: "GET",
          pathname: "/api/v1/admin/overview",
        }),
      /You do not have permission/,
    );

    // `authorizeAdminAction` remains callable directly, and remains a
    // faithful port — including the fail-open footgun, which is why it is
    // marked `@deprecated` and why the assertions above pin that
    // `authorizeAdminPath` does not expose it.
    assert.equal(
      authorizeAdminAction({
        role: "moderator",
        method: "POST",
        resource: "events",
        path: "/content/events",
      }),
      true,
    );
  });

  test("requireAdminAction derives the context and returns the user", () => {
    // `requireAdminAction` is the guard a ROUTE calls. It runs BOTH halves —
    // `requireAdmin` then `authorizeAdminPath` — so a route cannot be wired up
    // with only one. That matters because in the Express version the two were
    // separate middlewares applied per route, and a route that registered only
    // `requireAdmin` granted every admin-role principal full access to that
    // endpoint.
    const user = { roles: { role: "admin" } };
    assert.equal(
      requireAdminAction(user, {
        method: "DELETE",
        pathname: "/api/v1/admin/roles/42",
      }),
      user,
    );

    // A mentor on a mentor-readable path passes both halves.
    assert.doesNotThrow(() =>
      requireAdminAction(
        { roles: { role: "mentor" } },
        { method: "GET", pathname: "/api/v1/admin/overview" },
      ),
    );

    // A member fails the FIRST half, with the role message rather than the
    // action message — the two are distinguishable, and that is worth pinning.
    assert.throws(
      () =>
        requireAdminAction(
          { roles: { role: "member" } },
          { method: "GET", pathname: "/api/v1/admin/overview" },
        ),
      (error) => {
        assert.equal(error.statusCode, 403);
        assert.equal(error.message, "Admin access is required");
        return true;
      },
    );

    // A mentor on a non-mentor path passes the first half and fails the second.
    assert.throws(
      () =>
        requireAdminAction(
          { roles: { role: "mentor" } },
          { method: "GET", pathname: "/api/v1/admin/roles" },
        ),
      (error) => {
        assert.equal(error.statusCode, 403);
        assert.equal(
          error.message,
          "You do not have permission for this admin action",
        );
        return true;
      },
    );

    // `requireAdminAction` takes ONLY `{ method, pathname }`. It cannot be
    // handed a `resource`, so the fail-open shape is not even expressible here.
    assert.doesNotThrow(() =>
      requireAdminAction(
        { roles: { role: "moderator" } },
        {
          method: "POST",
          pathname: "/api/v1/admin/content/posts",
          resource: "alumni",
        },
      ),
    );
  });
});
