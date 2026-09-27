// =============================================================================
// THE REDACTION GATE — one resolution, shared by every place internal error
// detail is withheld from the client.
//
// =============================================================================
// WHY THIS FILE EXISTS
// =============================================================================
// Two call sites redact internal detail, and they are two halves of ONE policy:
// `toErrorResponse` in `errors.js` (the 500 branch) and `verifyToken` in
// `auth.js` (the non-expiry JWT branch). `auth.js` gated itself on
// `process.env.NODE_ENV === 'production'` and nothing else.
//
// THAT IS A FORGERY ORACLE, REACHABLE BY MISCONFIGURATION ALONE. The
// non-expiry JWT branch returns raw `jsonwebtoken` text — "jwt malformed",
// "invalid signature" — and the difference between those two tells an attacker
// probing token forgery whether the forged token they submitted was
// structurally well-formed. The surrounding comment in `auth.js` exists
// specifically to prevent that, and the `NODE_ENV` gate defeated it.
//
// `NODE_ENV` IS NOT UNDER THE APPLICATION'S CONTROL. It is set by the build
// (`next build` bakes in `production`) and by the platform. A real host
// configured to build with it unset, to `development`, or to a staging value
// serves a PRODUCTION database while taking the non-redacting branch. The
// failure is invisible: the only symptom is that some 401 bodies get more
// interesting, so nobody reports it.
//
// `errors.js` already introduced `VERBOSE_ERRORS` for precisely this problem, and
// its own comment says `NODE_ENV` "is not under the application's control" — but
// the fix was never applied to `auth.js`, so the two redactions disagreed about
// when they applied and the JWT one was the unsafe half. Both now call
// `resolveVerboseErrors()`.
//
// WHAT IS ASSERTED, AND WHY EACH DIRECTION MATTERS
// =============================================================================
//   - `VERBOSE_ERRORS=false` on a `NODE_ENV=development` host REDACTS. This is
//     the direction that closes the finding, and it is the one a regression would
//     silently undo.
//   - `VERBOSE_ERRORS=true` on a `NODE_ENV=production` host returns the raw
//     text. This is the documented escape hatch for debugging a live deployment.
//   - `VERBOSE_ERRORS` absent → `NODE_ENV` decides, unchanged, so no existing
//     deployment is affected. Asserted in BOTH `NODE_ENV` directions because
//     "unchanged" is a claim about behaviour, not about the code.
//   - The value is an EXPLICIT string equality, not a truthiness test, so
//     `VERBOSE_ERRORS=0` and `VERBOSE_ERRORS=` (both plausible ways to write
//     "off" in a dashboard) must NOT enable the dangerous branch.
//
// The JWT branch is driven through the REAL `verifyToken` with a real,
// wrongly-signed token, so the assertion is on what a client would actually
// receive rather than on the helper in isolation.
// =============================================================================

import { test, describe, before } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";

process.env.ACCESS_TOKEN_SECRET = "test-only-access-secret-not-a-real-secret";
process.env.REFRESH_TOKEN_SECRET = "test-only-refresh-secret-not-a-real-secret";
process.env.PASSWORD_TOKEN_SECRET = "test-only-password-secret-not-a-real-secret";
process.env.JWT_SECRET = "test-only-general-secret-not-a-real-secret";
process.env.MONGODB_URI = "mongodb://127.0.0.1:27017";

let verifyToken;
let resolveVerboseErrors;
let ApiError;

before(async () => {
  ({ verifyToken } = await import("@/lib/server/auth"));
  ({ resolveVerboseErrors, ApiError } = await import("@/lib/server/errors"));
});

/**
 * Calls the real `verifyToken` with a token signed by the WRONG secret, so
 * `jwt.verify` raises `JsonWebTokenError: invalid signature` — the exact
 * non-expiry failure whose message must never reach a client on a
 * production-shaped host.
 *
 * `verifyToken` throws an `ApiError`; the helper returns the message rather than
 * rethrowing so each test can assert on the text without five identical
 * try/catch blocks.
 */
async function messageForForgedToken() {
  const forged = jwt.sign({ _id: "65f0000000000000000000a1" }, "the-wrong-secret", {
    algorithm: "HS256",
    expiresIn: "15m",
  });

  try {
    await verifyToken(
      new Request("http://localhost:3000/api/v1/users/user", {
        headers: { cookie: `accessToken=${forged}` },
      }),
    );
  } catch (error) {
    assert.ok(
      error instanceof ApiError,
      `verifyToken must reject with an ApiError, got ${error?.name}`,
    );
    assert.equal(error.statusCode, 401, "a forged token is a 401, not a 500");
    return error.message;
  }

  throw new Error("verifyToken accepted a token signed with the wrong secret");
}

/**
 * Runs `body` with `process.env` mutated, restoring the previous values even if
 * the body throws.
 *
 * THE VALUES ARE RESTORED RATHER THAN DELETED because this file mutates process
 * state, and `node --test` runs every test FILE in the same process. Leaving
 * `NODE_ENV` or `VERBOSE_ERRORS` set would silently change the behaviour of
 * whichever file happened to run next, which is precisely the class of bug this
 * file exists to detect.
 */
async function withEnv(values, body) {
  const previous = Object.fromEntries(
    Object.keys(values).map((key) => [key, process.env[key]]),
  );

  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }

  try {
    return await body();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

describe("resolveVerboseErrors — VERBOSE_ERRORS overrides NODE_ENV in both directions", () => {
  test("with VERBOSE_ERRORS absent, NODE_ENV decides", async () => {
    // THE NO-CHANGE BASELINE. Whatever this gate does, a deployment that has
    // never heard of `VERBOSE_ERRORS` must behave exactly as it did before the
    // extraction.
    assert.equal(
      await withEnv({ NODE_ENV: "production", VERBOSE_ERRORS: undefined }, () =>
        resolveVerboseErrors(),
      ),
      false,
      "a production host redacts when the override is absent",
    );
    assert.equal(
      await withEnv({ NODE_ENV: "development", VERBOSE_ERRORS: undefined }, () =>
        resolveVerboseErrors(),
      ),
      true,
      "a development host is verbose when the override is absent",
    );
  });

  test("VERBOSE_ERRORS=false redacts even on a development host", async () => {
    // THE DIRECTION THAT CLOSES THE FINDING. A host that reports itself as
    // `development` while serving production data must still redact, and this is
    // the assertion a regression would silently undo.
    assert.equal(
      await withEnv({ NODE_ENV: "development", VERBOSE_ERRORS: "false" }, () =>
        resolveVerboseErrors(),
      ),
      false,
    );
    assert.equal(
      await withEnv({ NODE_ENV: "production", VERBOSE_ERRORS: "false" }, () =>
        resolveVerboseErrors(),
      ),
      false,
    );
  });

  test("VERBOSE_ERRORS=true is verbose even on a production host", async () => {
    // THE DOCUMENTED ESCAPE HATCH, and deliberately the more dangerous setting:
    // it must be an explicit, greppable, removable act, never a default.
    assert.equal(
      await withEnv({ NODE_ENV: "production", VERBOSE_ERRORS: "true" }, () =>
        resolveVerboseErrors(),
      ),
      true,
    );
  });

  test("only the exact strings 'true' and 'false' are honoured", async () => {
    // AN EXPLICIT STRING EQUALITY, NOT A TRUTHINESS TEST, and the reason is
    // concrete: `0`, an empty string and `no` are all plausible ways to write
    // "off" in a deployment dashboard, and a truthiness test would read
    // `VERBOSE_ERRORS=0` as ENABLED — turning an operator's attempt to turn
    // verbosity off into turning it on, on a production host.
    for (const value of ["0", "", "no", "TRUE", "True", "1", "yes"]) {
      assert.equal(
        await withEnv({ NODE_ENV: "production", VERBOSE_ERRORS: value }, () =>
          resolveVerboseErrors(),
        ),
        false,
        `VERBOSE_ERRORS=${JSON.stringify(value)} must not enable the verbose branch`,
      );
    }
  });
});

describe("verifyToken — the JWT redaction uses the shared gate, not NODE_ENV", () => {
  test("a forged token on a PRODUCTION host never leaks the jsonwebtoken message", async () => {
    const message = await withEnv(
      { NODE_ENV: "production", VERBOSE_ERRORS: undefined },
      messageForForgedToken,
    );

    assert.equal(message, "Invalid access token");
    // NOT ONLY THE MESSAGE. The raw library strings are named explicitly so the
    // assertion fails if `jsonwebtoken` ever words one of them differently, and
    // so the test states which texts constitute the oracle.
    for (const leak of ["invalid signature", "jwt malformed", "jwt expired"]) {
      assert.ok(
        !message.includes(leak),
        `the 401 must not contain ${JSON.stringify(leak)}: ${message}`,
      );
    }
  });

  test("a forged token on a NON-production host is still redacted when VERBOSE_ERRORS=false", async () => {
    // THE ACTUAL FINDING, ASSERTED END TO END. A host reporting
    // `NODE_ENV=development` while serving a production database used to return
    // "invalid signature" here. It no longer does, and this is the test that says
    // so at the level a client observes rather than at the level of a helper.
    const message = await withEnv(
      { NODE_ENV: "development", VERBOSE_ERRORS: "false" },
      messageForForgedToken,
    );

    assert.equal(message, "Invalid access token");
    assert.ok(
      !message.includes("invalid signature"),
      `a non-production host must not leak the forgery oracle: ${message}`,
    );
  });

  test("VERBOSE_ERRORS=true on a production host DOES surface the diagnostic", async () => {
    // THE OTHER DIRECTION, and the reason the gate is a gate rather than a
    // blanket redaction: a developer debugging a live deployment needs to know
    // WHICH `jsonwebtoken` failure occurred, and the redacted path logs it
    // server-side where they cannot see it.
    const message = await withEnv(
      { NODE_ENV: "production", VERBOSE_ERRORS: "true" },
      messageForForgedToken,
    );

    assert.ok(
      message.includes("invalid signature"),
      `VERBOSE_ERRORS=true must surface the real reason, got ${message}`,
    );
  });

  test("a non-production host with no override still gets the diagnostic", async () => {
    // The developer-experience half of the ORIGINAL intent, preserved. The
    // previous version redacted unconditionally at one point, which discarded
    // the single most useful diagnostic in exactly the environment where
    // somebody is trying to use it.
    const message = await withEnv(
      { NODE_ENV: "development", VERBOSE_ERRORS: undefined },
      messageForForgedToken,
    );

    assert.ok(
      message.includes("invalid signature"),
      `a development host must surface the real reason, got ${message}`,
    );
  });
});
