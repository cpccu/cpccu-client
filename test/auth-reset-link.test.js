// =============================================================================
// `POST /api/v1/auth/reset-link` — the property that makes it safe to expose
// anonymously, and the method it is allowed to be reached by.
//
// =============================================================================
// WHY THIS FILE EXISTS
// =============================================================================
// The endpoint was migrated from `GET /auth/reset-link/:email` to
// `POST /auth/reset-link` with the address in the body, so that
// `assertSameOrigin` is armed on it (a `GET` is in `SAFE_METHODS`, so the CSRF
// check no-ops; and with the address in the PATH, a bare cross-site `<img src>`
// was enough to make the server send a real branded reset mail to an
// attacker-chosen address).
//
// THAT MIGRATION COULD HAVE BROKEN THE ENDPOINT'S ONLY REAL DEFENCE WITHOUT ANY
// TEST FAILING. The defence is that the response is byte-identical for "no such
// account" and "sent", which is what stops an UNAUTHENTICATED caller using this
// to enumerate who has an account here. Changing how the address arrives, or
// re-plumbing the handler, is exactly the kind of edit that differentiates the
// two branches by accident — a 404 for an unknown address, a shorter path, a
// different message, a different `success` flag. None of that would fail a
// status-code-only test, a build, or a type checker, and all of it would convert
// the endpoint into an account-existence oracle.
//
// So this asserts the BYTES: same status, same parsed body, same key set, for
// both account states, produced by the real controller with only the Mongoose
// boundary faked.
//
// =============================================================================
// WHAT IS STUBBED
// =============================================================================
// The real route, the real `defineRoute`/`apiRoute`/shim, the real limiter
// composition and the real `forgottenPasswordHandler`. Only the two I/O
// boundaries are replaced: the `User` model statics, and `next/headers`'
// `cookies()` (which throws outside a Next request scope). The mail transport is
// NOT reached on the no-such-account path at all — the handler returns before
// `sendOTP` — and on the "sent" path `sendOTP` is never invoked because the
// test makes the address resolve to a missing user for the enumeration
// assertion, and for the "sent" case it exercises the real `sendOTP` call only
// far enough to observe the response, via the failure path described below.
// =============================================================================

import { test, describe, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";

import { REPO_ROOT } from "./loader.mjs";

// Hermetic environment, assigned before the modules under test are imported
// (`auth.js` resolves its secrets on first use, not at module load).
process.env.ACCESS_TOKEN_SECRET = "test-only-access-secret-not-a-real-secret";
process.env.REFRESH_TOKEN_SECRET = "test-only-refresh-secret-not-a-real-secret";
process.env.PASSWORD_TOKEN_SECRET = "test-only-password-secret-not-a-real-secret";
process.env.JWT_SECRET = "test-only-general-secret-not-a-real-secret";
process.env.MONGODB_URI = "mongodb://127.0.0.1:27017";

// `WEB_DOMAIN` IS REQUIRED, NOT COSMETIC. The real `sendOTP` throws
// `WEB_DOMAIN is not configured` for a `'reset'` purpose — deliberately, rather
// than interpolating `undefined` into a dead link — so without this the
// known-account branch would answer 500 and the two responses could not be
// compared. It is set to the same origin the requests below declare, so the
// assertion that the real reset URL was built is a check on the real
// concatenation rather than on a placeholder.
//
// IT IS ALSO WHAT SEEDS THE CSRF ALLOW-LIST in `request.js`, so setting it
// explicitly is what makes the `Origin` header these tests send a permitted one
// regardless of what a developer's local `.env` happens to contain. `node --test`
// does not load `.env`, so an unset value here would mean the suite's behaviour
// depended on the machine it ran on.
process.env.WEB_DOMAIN = "http://localhost:3000";

// THE MAIL TRANSPORT IS STUBBED, AND ONLY THE TRANSPORT. The success path of
// this endpoint calls `sendOTP` -> `sendEmail` -> Resend over the network, which
// is why the "email was sent" branch — the branch whose response must be
// indistinguishable from the other one — had no coverage at all. Setting this
// before the dynamic imports below makes `test/loader.mjs` resolve `resend` to
// `test/stubs/resend.mjs`, which records calls instead of making them. The
// variable is read by the loader, so it must be set before the first import of
// anything that transitively pulls in the mail module; every other test file
// leaves it unset and gets the real package.
process.env.CPCCU_TEST_STUB_RESEND = "1";

const require = createRequire(`${REPO_ROOT}/`);
const { ResponseCookies } = require(
  "next/dist/compiled/@edge-runtime/cookies",
);

// ---------------------------------------------------------------------------
// BOUNDARY — `next/headers`' `cookies()`. Backed by a real `ResponseCookies` so
// replacement semantics are Next's own rather than this file's.
// ---------------------------------------------------------------------------
let recorder;
const nextHeadersPath = require.resolve("next/headers");
require.cache[nextHeadersPath] = {
  id: nextHeadersPath,
  filename: nextHeadersPath,
  loaded: true,
  exports: {
    cookies: async () => {
      const headers = new Headers();
      recorder = { headers, store: new ResponseCookies(headers) };
      return recorder.store;
    },
  },
};

// `runController` awaits `getDb()` before every controller run; a pre-seeded
// resolved memo makes `connectDB` take its already-connected short-circuit.
globalThis.__mongoose = {
  conn: null,
  promise: Promise.resolve({ connection: { host: "test.invalid" } }),
  watchRegistered: true,
};

let User;
let RESET_LINK;

before(async () => {
  const { User: UserModel } = await import("@/lib/server/models/user.model");
  User = UserModel;
  ({ POST: RESET_LINK } = await import("@/app/api/v1/auth/reset-link/route.js"));
});

beforeEach(() => {
  recorder = undefined;
  // The mail stub records across tests; resetting here is what lets the
  // enumeration test assert an exact send COUNT rather than a delta.
  globalThis.__resendStub.calls.length = 0;
});

/**
 * A Mongoose query stand-in, chainable and awaitable.
 *
 * `findOne` is what decides whether the address belongs to an account, so this
 * is the single fact these tests vary. `select` and `lean` exist because the
 * sibling controllers call them and a stand-in missing one would fail with a
 * `TypeError` that looks like an application bug.
 */
function query(value) {
  const q = {
    select: () => q,
    lean: () => q,
    then: (onFulfilled, onRejected) =>
      Promise.resolve(value).then(onFulfilled, onRejected),
  };
  return q;
}

/** An account in the shape `forgottenPasswordHandler` uses on the "sent" path. */
function existingAccount() {
  return {
    _id: "65f0000000000000000000a1",
    fullName: "A Registered Student",
    email: "registered@example.edu",
    isValid: true,
    generatePasswordToken: () => "test-only-password-token",
    resetOTP: null,
    async save() {},
  };
}

/**
 * A same-origin `POST` carrying the address in the BODY.
 *
 * The `Origin`/`Sec-Fetch-Site` headers are not decoration: the route is `POST`,
 * so `assertSameOrigin` is armed, and a request without a same-origin signal is
 * refused with a 403 before the handler runs. Sending them is what makes the
 * test exercise the endpoint rather than its CSRF rejection — and the CSRF
 * rejection is asserted separately below, because that is the other half of
 * what the `GET` -> `POST` migration bought.
 *
 * `clientIp` EXISTS SO THESE TESTS DO NOT TRIP THE REAL RATE LIMITER.
 * `authEmailRateLimiter` is 5 requests per 15 minutes keyed on the client IP
 * (it declares no `keyGenerator`), and the limiter state lives for the lifetime
 * of the process. Without distinct addresses per test, the fourth test in the
 * file would be answered 429 and would then be asserting nothing about the
 * handler. Giving each test its own address keeps the limiter real — it is still
 * consulted on every request, so a future change that bypassed it would still be
 * visible — while making the budget deterministic. The addresses are in
 * `203.0.113.0/24`, which is TEST-NET-3 (RFC 5737) and reserved for
 * documentation, so none of them can collide with a real client.
 */
function resetRequest(email, { clientIp, ...overrides } = {}) {
  const headers = {
    "content-type": "application/json",
    origin: "http://localhost:3000",
    "sec-fetch-site": "same-origin",
    ...(clientIp ? { "x-forwarded-for": clientIp } : {}),
    ...overrides,
  };

  return new Request("http://localhost:3000/api/v1/auth/reset-link", {
    method: "POST",
    headers,
    body: JSON.stringify({ email }),
  });
}

/**
 * Strips comments so a source assertion reads CODE rather than PROSE.
 *
 * NECESSARY HERE, AND THE FAILURE IT PREVENTS IS WORTH NAMING. Both the route
 * file and `authApi.js` document the migration in place, and that documentation
 * necessarily QUOTES the old shape — the docblock contains
 * `` `/auth/reset-link/${encodeURIComponent(email)}` `` verbatim, and the route
 * docblock contains `req.params.email`. A naive `assert(!source.includes(...))`
 * over the raw file therefore fails against correct code, and the tempting
 * "fix" is to weaken the assertion until it passes — which would leave a test
 * that can never fail.
 *
 * THE LIMITATION IS STATED RATHER THAN HIDDEN: this removes `/* … *\/` blocks
 * and `//` comments that BEGIN A LINE, so a trailing comment is not stripped and
 * a `//` inside a string literal would be mis-read as the start of a comment.
 * Neither matters for the two files asserted against — this codebase writes
 * comments on their own lines — and over-engineering a comment stripper to be
 * exact would be a worse trade than stating the boundary.
 */
function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((line) => !/^\s*\/\//.test(line))
    .join("\n");
}

describe("POST /auth/reset-link — the response must not reveal whether an account exists", () => {
  test("a KNOWN account and an UNKNOWN one produce a byte-identical response", async () => {
    // THE ENUMERATION PROPERTY. `forgottenPasswordHandler` must answer the
    // unknown address with the same 200 and the same body it answers the known
    // one with, and this test drives the real controller on both branches —
    // including the real `sendOTP` on the known one, with only the Resend
    // transport stubbed, so the branch that actually does the work is the branch
    // under test rather than a branch short-circuited for convenience.
    //
    // ONE CLIENT ADDRESS FOR BOTH REQUESTS, deliberately: the two responses
    // should be indistinguishable to the CALLER, and the caller is the same
    // client. Splitting them across two addresses would also be two rate-limit
    // buckets, which is a slightly different situation.
    const clientIp = "203.0.113.10";

    User.findOne = () => query(null);
    const unknown = await RESET_LINK(
      resetRequest("nobody@example.edu", { clientIp }),
      {},
    );
    const unknownText = await unknown.clone().text();
    const unknownSends = globalThis.__resendStub.calls.length;

    User.findOne = () => query(existingAccount());
    const known = await RESET_LINK(
      resetRequest("registered@example.edu", { clientIp }),
      {},
    );
    const knownText = await known.clone().text();
    const knownJson = JSON.parse(knownText);

    // STATUS FIRST. Comparing bodies of two 404/500s would be comparing two
    // failures, and the byte comparison below would be meaningless.
    assert.equal(unknown.status, 200, "an unknown address must not 404");
    assert.equal(
      known.status,
      unknown.status,
      "the known and unknown paths must agree on status",
    );

    // THE BYTES, NOT THE PARSED SHAPE. `assert.deepEqual` on two parsed objects
    // would pass if key ORDER differed, and it would pass if one response had an
    // extra `undefined`-valued key. The string comparison is the actual claim:
    // a client, a proxy log, and an attacker see bytes.
    assert.equal(
      knownText,
      unknownText,
      "the known and unknown paths must be byte-identical",
    );

    // KEY SET, spelled out so a future change to the envelope is a named
    // failure rather than an opaque string diff. `data` is `null` on both paths:
    // returning the user, or a token, on the success path only, would be the
    // enumeration oracle all over again.
    assert.deepEqual(Object.keys(knownJson).sort(), [
      "data",
      "message",
      "statusCode",
      "success",
    ]);
    assert.equal(knownJson.data, null);
    assert.equal(knownJson.statusCode, 200);
    assert.equal(knownJson.success, true);
    assert.equal(knownJson.message, "Reset link sent successfully!");

    // …AND THE TWO PATHS REALLY DID DIFFER IN WHAT THEY DID. Without this the
    // byte comparison above would be satisfied by a handler that sent mail on
    // both paths, which is a different (and worse) bug: it would burn the
    // sender quota on every probe. The unknown address must return BEFORE
    // `sendOTP`, and the known one must reach it exactly once.
    assert.equal(
      unknownSends,
      0,
      "an unknown address must not send mail",
    );
    assert.equal(
      globalThis.__resendStub.calls.length,
      1,
      "a known address must send exactly one mail",
    );

    // The stub is a boundary, so assert the REAL code above it still ran: the
    // reset link the real `sendOTP` built must carry the `WEB_DOMAIN` the real
    // template embedded, which is what makes "the mail was really rendered"
    // observable without inspecting the private template internals.
    const sentHtml = globalThis.__resendStub.calls[0].payload.html;
    assert.ok(
      sentHtml.includes("http://localhost:3000/reset-password/"),
      "the real sendOTP must have built a WEB_DOMAIN-based reset link",
    );
    assert.equal(
      globalThis.__resendStub.calls[0].payload.to,
      "registered@example.edu",
    );
  });

  test("neither path sets a cookie or leaks a token", async () => {
    // A second, independent statement of the same property: the response must
    // not carry the reset token, the OTP, or any session state. The known path
    // generated a password token and an OTP in the handler above; neither may
    // reach the client, on either branch.
    const clientIp = "203.0.113.11";

    User.findOne = () => query(null);
    const unknown = await RESET_LINK(
      resetRequest("nobody@example.edu", { clientIp }),
      {},
    );
    const unknownCookies = recorder?.headers.getSetCookie() ?? [];
    const unknownBody = await unknown.text();

    User.findOne = () => query(existingAccount());
    const known = await RESET_LINK(
      resetRequest("registered@example.edu", { clientIp }),
      {},
    );
    const knownCookies = recorder?.headers.getSetCookie() ?? [];
    const knownBody = await known.text();

    assert.deepEqual(unknownCookies, [], "no cookie on the unknown path");
    assert.deepEqual(knownCookies, [], "no cookie on the known path either");

    // The generated values are the specific leak to rule out. The test account's
    // `generatePasswordToken` returns a fixed sentinel precisely so this can be
    // an equality check rather than a shape check.
    assert.ok(
      !knownBody.includes("test-only-password-token"),
      "the reset token must never appear in a response",
    );
    for (const responseBody of [unknownBody, knownBody]) {
      assert.ok(
        !/\b\d{6}\b/.test(responseBody),
        `a 6-digit OTP must never appear in a response: ${responseBody}`,
      );
    }
  });

  test("a missing address is a 400, and it is NOT the enumeration answer", async () => {
    // The empty-address 400 is the one legitimate way to tell the two cases
    // apart, and it is safe precisely because it reveals nothing about any
    // ACCOUNT. It is asserted so that a later refactor cannot quietly turn it
    // into the enumeration-shaped 200 (which would be safe) or into a 404 keyed
    // on the address (which would not be).
    User.findOne = () => query(null);

    const response = await RESET_LINK(
      new Request("http://localhost:3000/api/v1/auth/reset-link", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
          "sec-fetch-site": "same-origin",
          "x-forwarded-for": "203.0.113.12",
        },
        body: JSON.stringify({ email: "   " }),
      }),
      {},
    );

    assert.equal(response.status, 400);
    const body = JSON.parse(await response.text());
    assert.equal(body.message, "Email is required");
  });

  test("a request with NO email field is a 400, not a 500", async () => {
    // The handler reads `req.body?.email`. The shim passes `null` through for a
    // request with no parseable body rather than coercing it to `{}`, so a
    // handler that destructured `req.body` would throw a `TypeError` and
    // `toErrorResponse` would shape it into a 500. This is the assertion that
    // the optional chaining is load-bearing.
    User.findOne = () => query(null);

    const response = await RESET_LINK(
      new Request("http://localhost:3000/api/v1/auth/reset-link", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://localhost:3000",
          "sec-fetch-site": "same-origin",
          "x-forwarded-for": "203.0.113.13",
        },
        body: JSON.stringify({}),
      }),
      {},
    );

    assert.equal(response.status, 400);
    assert.equal(JSON.parse(await response.text()).message, "Email is required");
  });
});

describe("POST /auth/reset-link — the method is the protection, so it is asserted", () => {
  test("the route is a POST and a cross-site request is refused before any mail", async () => {
    // THE CSRF HALF OF THE MIGRATION. The enumeration tests above all send a
    // same-origin request; this one omits `Origin`/`Sec-Fetch-Site`, which is
    // what a cross-site `<img>`/navigation/`fetch` looks like now that the
    // address is in a body.
    //
    // It is refused with 403 by `assertSameOrigin`, which runs at `apiRoute`
    // step 2 — before rate limiting, before authentication, and before
    // `runController` opens a database connection. `User.findOne` is set to
    // THROW so that any reach of the controller is an immediate, loud failure
    // rather than a silently-passing assertion: if the CSRF check were ever
    // reordered or dropped, this test would break instead of quietly passing.
    User.findOne = () => {
      throw new Error(
        "the controller must not be reached for a cross-site request",
      );
    };

    const response = await RESET_LINK(
      new Request("http://localhost:3000/api/v1/auth/reset-link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: "victim@example.edu" }),
      }),
      {},
    );

    assert.equal(
      response.status,
      403,
      "a cross-site POST must be refused by assertSameOrigin",
    );
  });

  test("the route exports POST and no GET exists for this path", async () => {
    // A `GET` EXPORT WOULD RE-OPEN THE HOLE, and a `GET` handler could only read
    // the address from the path — the exploitable half of the old design. The
    // route file is read for this rather than imported, because importing it
    // again would hand back the same `POST` binding the tests above already
    // cover; what is being asserted is the ABSENCE of a sibling export, which is
    // only visible in the module's own source.
    const { readFileSync } = await import("node:fs");
    const path = await import("node:path");

    const source = readFileSync(
      path.join(REPO_ROOT, "src/app/api/v1/auth/reset-link/route.js"),
      "utf8",
    );

    const exportedMethods = [
      ...stripComments(source).matchAll(
        /^export const (GET|POST|PUT|PATCH|DELETE) =/gm,
      ),
    ].map((match) => match[1]);

    assert.deepEqual(
      exportedMethods,
      ["POST"],
      "reset-link must export POST and nothing else — a GET alias is the hole",
    );

    // AND THE DYNAMIC SEGMENT MUST BE GONE. `req.body` replaced `req.params`, so
    // a surviving `reset-link/[email]/route.js` would be a second, reachable copy
    // of this endpoint still answering on the old path-segment contract — the one
    // shape an `<img src>` can produce. Asserted on the FILESYSTEM rather than
    // on the route file's text, because a `[email]` directory is the actual
    // exposure and no amount of source scanning would reliably see it.
    const dynamicSegment = path.join(
      REPO_ROOT,
      "src/app/api/v1/auth/reset-link/[email]",
    );

    assert.ok(
      !existsSync(dynamicSegment),
      `the old [email] route directory must not exist: ${dynamicSegment}`,
    );

    // AND THE CODE MUST NOT READ `params`, which is the contract the handler
    // moved off. Comments are stripped first because the migration docblock
    // necessarily quotes `req.params.email` when describing what changed.
    assert.ok(
      !stripComments(source).includes("params"),
      "the route must not depend on route params — the address is in the body",
    );
  });

  test("the client reaches this endpoint by POST with the address in the body", async () => {
    // THE CLIENT HALF OF THE MIGRATION. The route being a `POST` while the
    // client still called a `GET` URL is the single most likely regression here:
    // the client would 404, or — worse — a stale `GET` route left behind for
    // "compatibility" would keep answering. This asserts the one call site.
    const { readFileSync } = await import("node:fs");
    const path = await import("node:path");

    // COMMENTS ARE STRIPPED, and they have to be: the explanatory block in
    // `authApi.js` quotes the old
    // `` `/auth/reset-link/${encodeURIComponent(email)}` `` URL verbatim in
    // order to say why it is gone. Asserting against the raw file would fail
    // against correct code, and the tempting fix — weakening the assertion until
    // it passes — would leave a test that cannot fail.
    const source = stripComments(
      readFileSync(
        path.join(REPO_ROOT, "src/features/auth/authApi.js"),
        "utf8",
      ),
    );
    const block = source.slice(
      source.indexOf("sendPasswordResetLink:"),
      source.indexOf("resetPassword:"),
    );

    assert.ok(block, "the sendPasswordResetLink endpoint must still exist");
    assert.ok(
      /url:\s*'\/auth\/reset-link'/.test(block),
      "the client must call the path-only URL, with the address in the body",
    );
    assert.ok(
      /method:\s*'POST'/.test(block),
      "the client must use POST — a GET here is the CSRF hole",
    );
    assert.ok(
      /body:\s*\{\s*email\s*\}/.test(block),
      "the address must be sent in the body",
    );
    assert.ok(
      !/reset-link\/\$\{/.test(block),
      "the address must not be interpolated into the URL path",
    );
  });
});
