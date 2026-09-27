// =============================================================================
// COOKIE OUTPUT — the first test in this suite that asserts on what actually
// reaches the browser in a `Set-Cookie` header.
//
// =============================================================================
// WHY THIS FILE EXISTS
// =============================================================================
// Every other test in this suite asserts on DECISIONS — authorisation matrices,
// error envelopes, CSRF verdicts, status codes, parsed bodies. Not one of them
// looked at a header. Cookie behaviour was therefore entirely unguarded, and
// that is how this bug survived a migration in which the cookie layer was
// rewritten twice (Express `res.cookie` -> the shim's queue -> `next/headers`).
//
// THE BUG, IN THE ORDER IT HAPPENED ON A REAL REQUEST TO `POST /auth/logout`:
//
//   1. `verifyToken` runs. The presented `accessToken` cookie is EXPIRED, so
//      `jwt.verify` throws `TokenExpiredError` and the transparent-refresh branch
//      returns a FRESH `accessToken` as an instruction the auth layer applies
//      later. This is deliberate and load-bearing: without it, `ACCESS_TOKEN_EXPIRE
//      =15m` hard-logs-everyone-out every 15 minutes.
//   2. `logoutHandler` revokes this device's refresh token and queues
//      `clearCookie('accessToken')`.
//   3. `collect.result()` flushes that queued deletion.
//   4. `apiRoute` then calls `finalizeResponse` -> `applyAuthCookie`, which writes
//      the fresh token under the SAME name. `ResponseCookies.set()` REPLACES a
//      same-name entry rather than appending, so the deletion is not outranked —
//      it is ERASED.
//
// The response said "logged out". The browser kept a live, correctly-signed
// 15-minute `accessToken`, and `GET /users/user` answered 200 with the departed
// user's `email`, `phone`, `uniID` and `roles` for the rest of its lifetime. The
// refresh token WAS revoked, so the session could not be extended — but on a
// shared machine, after a logout, the API still answered as the logged-out user.
//
// The fix is in `http.js` (`suppressClearedRefreshCookie`): a `refreshCookie`
// whose NAME the controller deleted is not applied. The shim reports the deleted
// names, `runController` carries them, `apiRoute` acts on them.
//
// =============================================================================
// WHAT IS AND IS NOT STUBBED
// =============================================================================
// The ROUTE, the auth layer, `apiRoute`, the shim and the cookie serialisation
// are all REAL. Two boundaries are substituted, and only two:
//
//   - `next/headers`'s `cookies()`. The real one throws
//     "`cookies` was called outside a request scope" outside a Next request, so
//     it is replaced in `require.cache` with a recorder that owns a real
//     `Headers` and serialises every `set()` through Next's OWN
//     `ResponseCookies`. The `Set-Cookie` text under assertion is therefore
//     produced by the same code the platform runs — not by a hand-rolled
//     serialiser that could agree with a broken implementation.
//   - The Mongoose `User` model statics, and the `globalThis.__mongoose` memo
//     that `connectDB` short-circuits on. There is no database in a unit test
//     and `test/loader.mjs` states that this suite gates PURE logic, "never over
//     database access". `User.findById` is the outermost I/O boundary, exactly
//     as `response-envelopes.test.js` treats `Certificate` and `Visitor`.
//
// The JWTs are REAL, signed with the real test secrets, and the access token is
// REAL EXPIRED (`expiresIn: '-1m'`) so `jwt.verify` really does raise
// `TokenExpiredError` and the real transparent-refresh branch really does run.
// That is the whole point: a test that mocked the refresh would have passed
// before the fix and after it, which is no test at all.
//
// THE SECOND HALF OF THIS FILE IS THE PART THAT MAKES IT A CLASS FIX AND NOT A
// POINT FIX. It asserts that a route whose controller does NOT touch cookies
// still receives its refreshed `accessToken` — i.e. that suppressing the refresh
// where it must be suppressed did not break the far more common case where the
// refresh is the entire point of the mechanism. A guard that only proves "the
// cookie is gone" would be equally satisfied by deleting every auth cookie
// unconditionally, which would log the whole user base out every 15 minutes.
//
// LOADING. `@/` aliases and `server-only` are handled by `test/loader.mjs`,
// which `npm test` loads via `--import`.
// =============================================================================

import { test, describe, before, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

import { REPO_ROOT } from "./loader.mjs";

// ---------------------------------------------------------------------------
// ENVIRONMENT, SET BEFORE THE MODULES UNDER TEST ARE IMPORTED.
// ---------------------------------------------------------------------------
// `auth.js` resolves its secrets through `validateEnv()` on FIRST USE rather
// than at module load (deliberately — a top-level throw would fail `next build`
// for every route in the app), so assigning these before the dynamic imports
// below is what makes the file hermetic: it behaves the same on a laptop with a
// populated `.env`, in CI, and in a container. These are throwaway values, not
// secrets, and they are the only reason a real JWT signed here verifies.
process.env.ACCESS_TOKEN_SECRET = "test-only-access-secret-not-a-real-secret";
process.env.REFRESH_TOKEN_SECRET = "test-only-refresh-secret-not-a-real-secret";
process.env.PASSWORD_TOKEN_SECRET = "test-only-password-secret-not-a-real-secret";
process.env.JWT_SECRET = "test-only-general-secret-not-a-real-secret";
process.env.MONGODB_URI = "mongodb://127.0.0.1:27017";

const require = createRequire(`${REPO_ROOT}/`);
const jwt = require("jsonwebtoken");
const { ResponseCookies } = require(
  "next/dist/compiled/@edge-runtime/cookies",
);

// ---------------------------------------------------------------------------
// BOUNDARY 1 — `next/headers`' `cookies()`.
// ---------------------------------------------------------------------------
/**
 * A recording `cookies()` store backed by Next's REAL `ResponseCookies`.
 *
 * THE RECORDER MUST REPRODUCE REPLACEMENT SEMANTICS, AND THIS IS THE WHOLE
 * REASON IT IS BUILT THIS WAY. `ResponseCookies.set()` does not append: it calls
 * `replace(map, this._headers)`, so a second `set()` of the same name DISCARDS
 * the first. That is the mechanism the bug under test lives in — "the deletion
 * is not outranked by the refreshed token, it is ERASED" — so a recorder that
 * appended would not be a looser test, it would be a DIFFERENT AND WRONG ONE: it
 * would report two `Set-Cookie` entries where the platform emits one, and the
 * "exactly one cookie" assertion below would be measuring the harness.
 *
 * A hand-rolled recorder was tried first and caught precisely by the
 * controller-SETS case: it reported 2 cookies where the real store produces 1.
 *
 * READING THE RESULT BACK USES NO PRIVATE STATE. The `Headers` instance is
 * created here and handed to the `ResponseCookies` constructor, so
 * `headers.getSetCookie()` is the standard, public way to read back exactly the
 * `Set-Cookie` lines the platform would emit — one per cookie, no
 * `toString()` separator ambiguity. `ResponseCookies.toString()` joins multiple
 * cookies with `"; "`, which is indistinguishable from an attribute separator and
 * is a debug convenience, not a wire format.
 */
function cookieRecorder() {
  const headers = new Headers();
  const store = new ResponseCookies(headers);

  return {
    headers,
    async cookies() {
      return store;
    },
  };
}

let recorder = cookieRecorder();
const nextHeadersPath = require.resolve("next/headers");
require.cache[nextHeadersPath] = {
  id: nextHeadersPath,
  filename: nextHeadersPath,
  loaded: true,
  exports: { cookies: async () => recorder.cookies() },
};

// ---------------------------------------------------------------------------
// BOUNDARY 2 — the Mongoose connection memo and the `User` model.
// ---------------------------------------------------------------------------
// `runController` awaits `getDb()` on every request before the controller runs.
// `connectDB` short-circuits when `globalThis.__mongoose.promise` is already
// set, so pre-seeding a resolved fake makes the connect a no-op without a
// network dial — the same code path a warm Vercel instance takes, rather than a
// stub that skips the function.
globalThis.__mongoose = {
  conn: null,
  promise: Promise.resolve({ connection: { host: "test.invalid" } }),
  watchRegistered: true,
};

const USER_ID = "65f0000000000000000000a1";

/**
 * A REAL, EXPIRED access token and a REAL, LIVE refresh token.
 *
 * The refresh token is minted BEFORE the fake user so that the value in the
 * request cookie and `user.refreshTokens[0].token` are the SAME STRING. That is
 * not tidiness: `verifyToken` checks the presented refresh token against a live
 * entry on the user document, and a mismatch is a legitimate 401 — a test that
 * let the two drift would be asserting on a rejection path and reporting it as
 * proof of the refresh path.
 */
const REFRESH_TOKEN = jwt.sign({ _id: USER_ID }, process.env.REFRESH_TOKEN_SECRET, {
  algorithm: "HS256",
  expiresIn: "7d",
});

const EXPIRED_ACCESS_TOKEN = jwt.sign(
  { _id: USER_ID, email: "departed@example.edu" },
  process.env.ACCESS_TOKEN_SECRET,
  { algorithm: "HS256", expiresIn: "-1m" },
);

let User;
let LOGOUT;
let QUIET_ROUTE;

before(async () => {
  const { User: UserModel } = await import("@/lib/server/models/user.model");
  User = UserModel;

  // A Mongoose query stand-in: chainable, awaitable, and carrying `.lean()`,
  // because `verifyToken`'s transparent-refresh branch calls all three
  // (`findById().select()` and `findById().select().lean()`).
  const query = (value) => {
    const q = {
      select() {
        return q;
      },
      lean() {
        return q;
      },
      then(onFulfilled, onRejected) {
        return Promise.resolve(value).then(onFulfilled, onRejected);
      },
    };
    return q;
  };

  const sessionUser = () => ({
    _id: USER_ID,
    email: "departed@example.edu",
    isValid: true,
    refreshTokens: [
      { token: REFRESH_TOKEN, expire: Date.now() + 7 * 24 * 60 * 60 * 1000 },
    ],
    async save() {},
    generateAccessToken() {
      return jwt.sign(
        { _id: this._id, email: this.email },
        process.env.ACCESS_TOKEN_SECRET,
        { algorithm: "HS256", expiresIn: "15m" },
      );
    },
  });

  User.findById = () => query(sessionUser());

  // THE REAL LOGOUT ROUTE, driven through the real `apiRoute`/`defineRoute`/
  // shim/auth chain. Nothing about the behaviour under test is reimplemented.
  ({ POST: LOGOUT } = await import("@/app/api/v1/auth/logout/route.js"));

  // The control route: a controller that never touches cookies. Same auth, same
  // expired-token refresh, opposite cookie expectation.
  const { defineRoute } = await import("@/lib/server/handler");
  QUIET_ROUTE = defineRoute("POST", {
    controller: async (req, res) => res.status(200).json({ ok: true }),
  });
});

beforeEach(() => {
  recorder = cookieRecorder();
});

// ---------------------------------------------------------------------------
// Cookie header parsing.
// ---------------------------------------------------------------------------
/**
 * Parses one `Set-Cookie` line into `{ name, value, attributes }`.
 *
 * NOT A REGEX, DELIBERATELY. Attribute ORDER in a `Set-Cookie` header is not
 * guaranteed by RFC 6265 — `Max-Age` may precede or follow `Expires` — so an
 * assertion written as `/accessToken=[^;]*;[^;]*Max-Age=0/` passes or fails
 * based on which serialiser happened to run. Splitting on the real separators
 * and reading attributes by name is order-independent, and it is what lets the
 * test fail for the RIGHT reason if a future change alters the cookie.
 *
 * `expires` is deliberately left as a STRING and compared with `Date.parse` in
 * the assertions: the deletion `Expires=Thu, 01 Jan 1970` contains a comma, and
 * a test that only accepted the epoch's exact rendering would pass on a cookie
 * deleted with any other past date.
 */
function parseSetCookie(line) {
  const [pair, ...rawAttributes] = line.split("; ");
  const separator = pair.indexOf("=");
  const attributes = {};

  for (const attribute of rawAttributes) {
    const index = attribute.indexOf("=");
    if (index === -1) {
      attributes[attribute.toLowerCase()] = true;
    } else {
      attributes[attribute.slice(0, index).toLowerCase()] =
        attribute.slice(index + 1);
    }
  }

  return {
    name: pair.slice(0, separator),
    value: pair.slice(separator + 1),
    attributes,
  };
}

/** Every `Set-Cookie` entry for `name`, parsed. */
function cookiesNamed(headers, name) {
  return headers
    .getSetCookie()
    .map(parseSetCookie)
    .filter((cookie) => cookie.name === name);
}

/**
 * A request carrying the EXPIRED access token and the LIVE refresh token, i.e.
 * the state a tab is in after fifteen minutes of idleness.
 *
 * `Origin` and `Sec-Fetch-Site` are sent because the route is `POST`, and
 * `assertSameOrigin` is therefore armed: without a same-origin signal the
 * request is refused with a 403 before authentication and the whole test would
 * pass vacuously against a route that never ran.
 */
function requestWithExpiredSession(method = "POST") {
  return new Request("http://localhost:3000/api/v1/auth/logout", {
    method,
    headers: {
      cookie: `accessToken=${EXPIRED_ACCESS_TOKEN}; refreshToken=${REFRESH_TOKEN}`,
      origin: "http://localhost:3000",
      "sec-fetch-site": "same-origin",
    },
  });
}

describe("cookie output — a controller's clearCookie is not undone by the auth layer", () => {
  test("logout with an EXPIRED access token emits a DELETION, not a live cookie", async () => {
    const response = await LOGOUT(requestWithExpiredSession(), {});
    const setCookie = recorder.headers.getSetCookie();

    // 200 FIRST, because every assertion below is meaningless on a rejection:
    // a 401 or 403 would also produce no live access token.
    assert.equal(response.status, 200);

    const accessTokens = cookiesNamed(recorder.headers, "accessToken");

    // EXACTLY ONE. This is the assertion that actually pins the bug. Before the
    // fix the deletion and the refreshed token were written under the same name
    // and `ResponseCookies.set()` REPLACED the first, so the browser saw a
    // single live `accessToken`. Asserting only "the value is empty" would have
    // passed on a header carrying two cookies, and asserting only "Max-Age=0"
    // would have passed while a live cookie rode along under the same name.
    assert.equal(
      accessTokens.length,
      1,
      `expected exactly one accessToken Set-Cookie, got ${setCookie.length}: ${JSON.stringify(setCookie)}`,
    );

    // `Max-Age=0` AND a past `Expires`: a browser honours either on its own, so
    // a deletion that carried only one of them would still be correct, and a
    // test demanding both attributes in a specific order would be testing the
    // serialiser rather than the behaviour.
    assert.equal(
      accessTokens[0].attributes["max-age"],
      "0",
      `accessToken must be a deletion: ${JSON.stringify(setCookie)}`,
    );
    const expires = Date.parse(accessTokens[0].attributes.expires ?? "");
    assert.ok(
      !Number.isNaN(expires) && expires < Date.now(),
      `accessToken Expires must be in the past, got ${accessTokens[0].attributes.expires}`,
    );

    // The value must be empty, and — the part a `Max-Age=0` check alone would
    // miss — no JWT may appear anywhere in the accessToken cookie.
    assert.equal(accessTokens[0].value, "");
    assert.ok(
      !accessTokens[0].value.startsWith("eyJ"),
      `accessToken must not carry a live JWT, got ${accessTokens[0].value.slice(0, 24)}…`,
    );

    // The deletion must KEEP the security attributes of the cookie it replaces.
    // A `clearCookie` that dropped `HttpOnly` would, on some clients, replace a
    // protected cookie with an unprotected one of the same name rather than
    // removing it — so this is a real property of a correct deletion, not a
    // restatement of the two above.
    assert.equal(accessTokens[0].attributes.httponly, true);

    // `logoutHandler` clears both cookies, and the refresh token is the
    // credential that is actually revocable. Asserting it keeps this test honest
    // about which credential the fix protects.
    const refreshTokens = cookiesNamed(recorder.headers, "refreshToken");
    assert.equal(refreshTokens.length, 1);
    assert.equal(refreshTokens[0].attributes["max-age"], "0");
  });

  test("a route that does NOT clear cookies still receives its refreshed accessToken", async () => {
    // THE OTHER HALF OF THE CONTRACT. The transparent refresh is not a wart to
    // be removed: `ACCESS_TOKEN_EXPIRE=15m`, so suppressing it globally would
    // hard-log-everyone-out every fifteen minutes, with no visible failure. If
    // this test fails, the suppression has been made too broad.
    const response = await QUIET_ROUTE(requestWithExpiredSession(), {});

    assert.equal(response.status, 200);

    const accessTokens = cookiesNamed(recorder.headers, "accessToken");
    assert.equal(
      accessTokens.length,
      1,
      `expected exactly one accessToken Set-Cookie, got ${JSON.stringify(recorder.headers.getSetCookie())}`,
    );

    // A REAL, LIVE, SIGNED token — three JWT segments — and emphatically not a
    // deletion. Asserting the shape as well as the absence of `Max-Age=0` means
    // a change that emitted, say, an empty cookie with a future expiry would
    // fail here rather than ship a browser with no session and no error.
    assert.match(
      accessTokens[0].value,
      /^eyJ[\w-]+\.[\w-]+\.[\w-]+$/,
      "a non-logout route must be given a live JWT",
    );
    assert.notEqual(accessTokens[0].attributes["max-age"], "0");
    assert.ok(
      Date.parse(accessTokens[0].attributes.expires ?? "") > Date.now(),
      `the refreshed accessToken must expire in the future, got ${accessTokens[0].attributes.expires}`,
    );

    // The attribute set must match what `COOKIE_OPTIONS` asks for, since that
    // object is the single definition of the auth cookie's shape in this app.
    assert.equal(accessTokens[0].attributes.httponly, true);
    assert.equal(accessTokens[0].attributes.samesite, "lax");
    assert.equal(accessTokens[0].attributes.path, "/");
  });

  test("the suppression is keyed on the cookie NAME the controller deleted", async () => {
    // THE REASONING, AS AN EXECUTABLE ASSERTION. The rule in `http.js` is "do not
    // re-issue a cookie whose name this controller deleted", and this test is
    // what stops that rule from quietly hardening into "never refresh a cookie
    // the controller touched" — which would be correct for a DELETE and wrong
    // for a SET, since `logoutHandler` deletes and `loginHandler` sets.
    //
    // A controller that SETS `accessToken` and does not clear it must still have
    // its own value survive. `ResponseCookies.set()` replaces a same-name entry,
    // so the auth layer's freshly-validated token is what the browser receives —
    // which is the precedence the shim's docblock documents as correct and which
    // this change deliberately did not reverse.
    const { defineRoute } = await import("@/lib/server/handler");
    const { COOKIE_OPTIONS } = await import("@/lib/server/constants");
    const ownToken = "eyJcontroller-issued.credential.signature";

    const settingRoute = defineRoute("POST", {
      controller: async (req, res) => {
        res.cookie("accessToken", ownToken, COOKIE_OPTIONS);
        res.status(200).json({ ok: true });
      },
    });

    const response = await settingRoute(requestWithExpiredSession(), {});
    assert.equal(response.status, 200);

    const accessTokens = cookiesNamed(recorder.headers, "accessToken");
    assert.equal(accessTokens.length, 1);
    assert.notEqual(
      accessTokens[0].value,
      ownToken,
      "the auth layer's freshly-validated token must win over a controller-queued one",
    );
    assert.match(accessTokens[0].value, /^eyJ[\w-]+\.[\w-]+\.[\w-]+$/);
  });

  test("the real logoutHandler is the controller that deletes accessToken", async () => {
    // COUPLING, so the three tests above cannot silently stop covering logout.
    // They exercise a controller that DELETES the cookie; this asserts that the
    // shipped `logoutHandler` is such a controller, by reading its source.
    //
    // IT IS A SOURCE READ, NOT AN INVOCATION, and the reason is stated rather
    // than glossed: `logoutHandler` reaches `User.findById` and then `user.save()`,
    // and `test/loader.mjs` is explicit that this suite gates pure logic and
    // "never over database access". Reimplementing the controller here would
    // assert that a COPY clears the cookie, which is the one thing a regression
    // test must not do. Reading the two `clearCookie` calls is the narrowest
    // check that keeps the tests above honest.
    const { readFileSync } = await import("node:fs");
    const path = await import("node:path");

    const source = readFileSync(
      path.join(REPO_ROOT, "src/lib/server/controllers/auth.controller.js"),
      "utf8",
    );
    const logoutBody = source.slice(
      source.indexOf("const logoutHandler"),
      source.indexOf("// ========================= FORGOT PASSWORD"),
    );

    assert.ok(
      logoutBody.includes(".clearCookie('accessToken'"),
      "logoutHandler must delete the accessToken cookie, or the suppression above is untested against the real endpoint",
    );
    assert.ok(
      logoutBody.includes(".clearCookie('refreshToken'"),
      "logoutHandler must delete the refreshToken cookie as well",
    );
  });
});
