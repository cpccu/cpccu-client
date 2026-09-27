// =============================================================================
// THE RESPONSE-ENVELOPE CONTRACT — one handler per shape.
//
// WHY THIS FILE EXISTS. FOUR distinct response envelopes coexist in this
// codebase and `response.js` states that they are NOT interchangeable and must
// NOT be normalised:
//
//   1. `ApiResponse`         -> { statusCode, data, message, success }
//   2. errors (`ApiError`)  -> { status,      message, errors? }
//   3. certificate handlers -> { success, data }   on success
//                            -> { success: false, message }  on failure (404)
//   4. visitor handlers      -> { count }          on success AND failure
//                            -> { success, count } on increment
//
// Note that (1) and (2) use DIFFERENT STATUS KEYS — `statusCode` vs `status` —
// and (2) is the only one with `errors`; (3) has no status key at all, so a
// client that reads `body.status` there gets `undefined`.
//
// Any unification is an API-BREAKING change that the frontend must be migrated
// against in the same commit. Collapsing them "while porting" silently breaks
// whichever client branch reads the removed key. This file makes that rule
// EXECUTABLE: each envelope is produced by a real handler in this repository and
// its exact key set is asserted, so the first person to wrap a certificate or
// visitor response in an `ApiResponse` gets a failing test rather than a
// production incident.
//
// DATABASE STUBS. The certificate and visitor handlers reach Mongoose. There is
// no connection in a unit test, and there should not be — these tests are about
// the ENVELOPE, not about Mongo. The model STATICS are therefore replaced with
// fakes for the duration of each test and restored immediately afterwards by
// `mock.restoreAll()`, so nothing leaks into another test file. The handler code
// under test is the real, unmodified production code: only the outermost I/O
// boundary is substituted.
//
// LOADING. Imported through the `@/` alias, with `server-only` stubbed — both
// handled in `test/loader.mjs`, which `npm test` loads via `--import`.
// =============================================================================

import { test, describe, mock } from "node:test";
import assert from "node:assert/strict";

import { ApiResponse } from "@/lib/server/response";
import { ApiError, toErrorResponse } from "@/lib/server/errors";
import {
  getVisitorCount,
  incrementVisitor,
} from "@/lib/server/controllers/visitor.controller";
import {
  getCertificateStats,
  getRecentCertificates,
  verifyCertificate,
  verifyCertificatePublic,
} from "@/lib/server/controllers/certificate.controller";
import { Visitor } from "@/lib/server/models/visitor.model";
import { Certificate } from "@/lib/server/models/certificate.model";
import { CertificateVerificationLog } from "@/lib/server/models/adminContent.model";

/**
 * A recording stand-in for the Express `res` object the ported controllers
 * write to. It records the status and the JSON body, which is the entire
 * observable output of a handler as far as the envelope contract is concerned.
 *
 * `json` RETURNS `this` because the handlers `return res.status(n).json(...)`,
 * and the returned value is what the shim's `collect.result()` reads. Returning
 * `undefined` would make the handlers resolve to `undefined`, which is a
 * different shape from the real one.
 */
function recordingRes() {
  const calls = [];
  return {
    calls,
    get last() {
      return calls[calls.length - 1];
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      calls.push({ status: this.statusCode, body });
      return this;
    },
  };
}

/** Builds a `req` with only the fields the handlers read. */
function fakeReq(extra = {}) {
  return {
    query: {},
    params: {},
    body: {},
    ip: "203.0.113.7",
    get: (name) => (name === "user-agent" ? "test-agent/1.0" : undefined),
    ...extra,
  };
}

// -----------------------------------------------------------------------------
// ENVELOPE 1 — `ApiResponse` -> { statusCode, data, message, success }
// -----------------------------------------------------------------------------
describe("envelope 1 — ApiResponse", () => {
  test("the key set is EXACTLY { statusCode, data, message, success }", () => {
    const response = new ApiResponse(
      200,
      { id: "abc" },
      "Certificate retrieved",
    );

    // `Object.keys` and not a property check: the whole point is that this is a
    // DIFFERENT envelope from the error one, and the difference is visible
    // precisely in the key names.
    assert.deepEqual(Object.keys(response).sort(), [
      "data",
      "message",
      "statusCode",
      "success",
    ]);

    // The status key is `statusCode`, NOT `status`. A handler that swapped in
    // the error envelope's spelling would leave every client reading
    // `body.statusCode` with `undefined`.
    assert.equal(response.statusCode, 200);
    assert.equal(response.status, undefined);
    assert.equal(response.success, true);
    assert.equal(response.message, "Certificate retrieved");
    assert.deepEqual(response.data, { id: "abc" });
    // …and there is no `errors` key. That belongs to envelope 2 only.
    assert.equal("errors" in response, false);
  });

  test("`success` is DERIVED from the status, not passed", () => {
    // Any status below 400 is a success. That means a 3xx redirect produced
    // through this class is flagged `success: true`, which is almost certainly
    // not what a caller intends — the comparison is pinned here so that anyone
    // who "fixes" it knows this exact consequence was deliberate.
    for (const status of [200, 201, 204, 301, 302, 304, 399]) {
      assert.equal(
        new ApiResponse(status).success,
        true,
        `${status} is success: true`,
      );
    }
    for (const status of [400, 401, 403, 404, 409, 419, 500, 503]) {
      assert.equal(
        new ApiResponse(status).success,
        false,
        `${status} is success: false`,
      );
    }
  });

  test('`message` defaults to "Success" and `data` is not defaulted', () => {
    // `data` has NO default, so omitting it leaves the key present with the value
    // `undefined`. That is different from omitting the key, and a client doing
    // `'data' in body` would see a difference.
    const bare = new ApiResponse(200);
    assert.equal(bare.message, "Success");
    assert.equal("data" in bare, true);
    assert.equal(bare.data, undefined);

    // An explicit `null` data is the common way a delete endpoint says "nothing to
    // return", and it must stay `null` rather than becoming `undefined`.
    const deleted = new ApiResponse(200, null, "Account deleted successfully");
    assert.equal(deleted.data, null);
    assert.deepEqual(Object.keys(deleted).sort(), [
      "data",
      "message",
      "statusCode",
      "success",
    ]);
  });

  test("it serialises to exactly the four keys over the wire", () => {
    // The wire form is what the client actually parses, so the JSON is asserted
    // as well as the instance.
    assert.equal(
      JSON.stringify(new ApiResponse(200, [1, 2], "ok")),
      '{"statusCode":200,"data":[1,2],"message":"ok","success":true}',
    );
  });
});

// -----------------------------------------------------------------------------
// ENVELOPE 2 — errors -> { status, message, errors? }
// -----------------------------------------------------------------------------
describe("envelope 2 — the error envelope", () => {
  test("the key set is { status, message, errors } and the status key is `status`", () => {
    const pair = toErrorResponse(
      new ApiError(409, "Validation failed", [
        { field: "email", message: "taken" },
      ]),
    );

    assert.deepEqual(Object.keys(pair.body).sort(), [
      "errors",
      "message",
      "status",
    ]);
    assert.equal(pair.body.status, 409);
    // The counterpart asymmetry: `status`, NOT `statusCode`.
    assert.equal(pair.body.statusCode, undefined);
    // …and `errors` is the ONLY envelope that has it.
    assert.deepEqual(pair.body.errors, [{ field: "email", message: "taken" }]);
  });

  test("the 500 branch has NO `errors` key — the load-bearing asymmetry", () => {
    // Restated here because this file is where someone comparing the four
    // envelopes side by side would "fix" it: the frontend reads `errors`
    // CONDITIONALLY on some endpoints, so an always-present empty array on the
    // 500 branch would be a visible change to what those branches do.
    const logged = [];
    mock.method(console, "error", (...args) => logged.push(args));
    try {
      const pair = toErrorResponse(new Error("boom"));
      assert.deepEqual(Object.keys(pair.body).sort(), ["message", "status"]);
    } finally {
      mock.restoreAll();
    }
  });

  test("an ApiError is a real Error, and the thrown path reaches the error envelope", () => {
    const error = new ApiError(403, "Admin access is required");
    assert.ok(error instanceof Error);
    assert.equal(error.message, "Admin access is required");
    // `data` is always null and is present only because callers spread it.
    assert.equal(error.data, null);
    // `error` is the SINGULAR name holding a PLURAL collection. Pinned because
    // renaming it to `errors` would drop every field-level message.
    assert.deepEqual(error.error, []);
  });
});

// -----------------------------------------------------------------------------
// ENVELOPE 3 — certificate handlers -> { success, data } / { success, message }
// -----------------------------------------------------------------------------
describe("envelope 3 — the certificate handlers", () => {
  test("a successful stats read is EXACTLY { success, data }", async () => {
    mock.method(Certificate, "countDocuments", async () => 12);
    mock.method(Certificate, "distinct", async () => [
      "Contest A",
      "Contest B",
    ]);
    mock.method(Certificate, "aggregate", async () => [{ totalExtra: 3 }]);
    try {
      const res = recordingRes();
      await getCertificateStats(fakeReq(), res);

      assert.equal(res.last.status, 200);
      assert.deepEqual(Object.keys(res.last.body).sort(), ["data", "success"]);
      assert.equal(res.last.body.success, true);
      // NO status key at all: a client that reads `body.status` here gets
      // `undefined`. That is the documented behaviour, not an oversight.
      assert.equal(res.last.body.status, undefined);
      assert.equal(res.last.body.statusCode, undefined);
      assert.equal("errors" in res.last.body, false);
      assert.deepEqual(res.last.body.data, {
        totalCertificates: 12,
        totalContests: 2,
        // 12 certificates + 3 extra participants, summed ONCE PER CONTEST.
        totalParticipants: 15,
        totalWinners: 12,
      });
    } finally {
      mock.restoreAll();
    }
  });

  test("a successful recent-certificates read is EXACTLY { success, data }", async () => {
    // `Certificate.find().sort().limit()` is a chain, so each link is stubbed.
    const chain = { sort: () => chain, limit: () => chain, then: undefined };
    chain.then = (resolve, reject) =>
      Promise.resolve(resolve([{ certificateId: "ABC-1" }])).catch(reject);
    mock.method(Certificate, "find", () => chain);
    try {
      const res = recordingRes();
      await getRecentCertificates(fakeReq(), res);

      assert.equal(res.last.status, 200);
      assert.deepEqual(Object.keys(res.last.body).sort(), ["data", "success"]);
      assert.deepEqual(res.last.body.data, [{ certificateId: "ABC-1" }]);
    } finally {
      mock.restoreAll();
    }
  });

  test("a verification FOUND is { success, data } with a SINGLE document, not an array", async () => {
    // The path-segment variant always resolves to one document, so `data` is
    // never an array here — unlike the query-parameter variant below, which is a
    // genuine API quirk the client has to know about.
    mock.method(Certificate, "findOne", async () => ({
      certificateId: "ABC-1",
    }));
    mock.method(CertificateVerificationLog, "create", async () => ({}));

    try {
      const res = recordingRes();
      await verifyCertificatePublic(
        fakeReq({ params: { certificateId: "ABC-1" } }),
        res,
      );

      assert.equal(res.last.status, 200);
      assert.deepEqual(Object.keys(res.last.body).sort(), ["data", "success"]);
      assert.equal(res.last.body.success, true);
      assert.deepEqual(res.last.body.data, { certificateId: "ABC-1" });
    } finally {
      mock.restoreAll();
    }
  });

  test("a verification NOT FOUND is { success: false, message } — no `data`, no `errors`", async () => {
    // The failure shape is DIFFERENT from the success shape and from the error
    // envelope. It is a 404 with a `message` and no `errors` list, because the
    // Express original's certificate handlers never used `ApiError`.
    mock.method(Certificate, "findOne", async () => null);
    mock.method(CertificateVerificationLog, "create", async () => ({}));

    try {
      const res = recordingRes();
      await verifyCertificatePublic(
        fakeReq({ params: { certificateId: "NOPE" } }),
        res,
      );

      assert.equal(res.last.status, 404);
      assert.deepEqual(Object.keys(res.last.body).sort(), [
        "message",
        "success",
      ]);
      assert.equal(res.last.body.success, false);
      // The path-segment 404 message differs from the query-parameter one,
      // because a path segment is client-visible and a wrong one is as likely
      // as a missing one.
      assert.equal(res.last.body.message, "Certificate not found or invalid");
      assert.equal("errors" in res.last.body, false);
      assert.equal("status" in res.last.body, false);
    } finally {
      mock.restoreAll();
    }
  });

  test("the query-parameter variant: `data` is an ARRAY when searching by name", async () => {
    // A name is not unique, so a name search returns an array while a
    // certificate-id search returns a document. The client must know which query
    // it issued; the handler's `Array.isArray` test is how it decides whether
    // anything was found, not defensive coding.
    const chain = { sort: () => chain };
    chain.then = (resolve, reject) =>
      Promise.resolve(resolve([{ recipientName: "Rahim" }])).catch(reject);
    mock.method(Certificate, "find", () => chain);
    mock.method(CertificateVerificationLog, "create", async () => ({}));

    try {
      const found = recordingRes();
      await verifyCertificate(
        fakeReq({ query: { recipientName: "Rahim" } }),
        found,
      );
      assert.equal(found.last.status, 200);
      assert.deepEqual(Object.keys(found.last.body).sort(), [
        "data",
        "success",
      ]);
      assert.ok(
        Array.isArray(found.last.body.data),
        "a name search must return an array",
      );

      // An empty array from a name search is a NOT-FOUND, not a 200 with no
      // rows — that is what the `Array.isArray` branch decides.
      const emptyChain = { sort: () => emptyChain };
      emptyChain.then = (resolve, reject) =>
        Promise.resolve(resolve([])).catch(reject);
      mock.restoreAll();
      mock.method(Certificate, "find", () => emptyChain);
      mock.method(CertificateVerificationLog, "create", async () => ({}));

      const missing = recordingRes();
      await verifyCertificate(
        fakeReq({ query: { recipientName: "Nobody" } }),
        missing,
      );
      assert.equal(missing.last.status, 404);
      assert.deepEqual(Object.keys(missing.last.body).sort(), [
        "message",
        "success",
      ]);
      assert.equal(missing.last.body.message, "Certificate not found");
    } finally {
      mock.restoreAll();
    }
  });

  test("a failed verification is still AUDIT-LOGGED — success and failure alike", async () => {
    // The log records verification ATTEMPTS, so a series of failed lookups
    // against a real certificate number is exactly the signal an administrator
    // wants. A log that only recorded successes would hide it.
    const created = [];
    mock.method(Certificate, "findOne", async () => null);
    mock.method(CertificateVerificationLog, "create", async (doc) => {
      created.push(doc);
      return doc;
    });

    try {
      await verifyCertificatePublic(
        fakeReq({ params: { certificateId: "REAL-1" } }),
        recordingRes(),
      );

      assert.equal(
        created.length,
        1,
        "a failed verification MUST write a log entry",
      );
      assert.equal(created[0].certificateId, "REAL-1");
      assert.equal(created[0].success, false);
      assert.equal(created[0].ip, "203.0.113.7");
      assert.equal(created[0].userAgent, "test-agent/1.0");
    } finally {
      mock.restoreAll();
    }
  });

  test("a service failure RETHROWS rather than being turned into a 404", async () => {
    // `next(error)` in Express became a rethrow, because `toErrorResponse` is a
    // direct port of the same error handler and produces an IDENTICAL response
    // through the IDENTICAL code path. Swallowing it here would report a
    // MongoDB outage as "Certificate not found", which is a lie the client
    // would cache.
    mock.method(Certificate, "countDocuments", async () => {
      throw new Error("mongo down");
    });
    try {
      await assert.rejects(
        () => getCertificateStats(fakeReq(), recordingRes()),
        /mongo down/,
      );
    } finally {
      mock.restoreAll();
    }
  });
});

// -----------------------------------------------------------------------------
// ENVELOPE 4 — visitor handlers -> { count } / { success, count }
// -----------------------------------------------------------------------------
describe("envelope 4 — the visitor handlers", () => {
  test("a successful count read is a BARE { count } — no `success`, no `status`", async () => {
    mock.method(Visitor, "findOne", async () => ({ count: 4321 }));
    try {
      const res = recordingRes();
      await getVisitorCount(fakeReq(), res);

      assert.equal(res.last.status, 200);
      // EXACTLY one key. This is the odd one out of the odd ones out, and it is
      // the envelope most likely to be "helpfully" wrapped in an `ApiResponse`.
      assert.deepEqual(Object.keys(res.last.body), ["count"]);
      assert.equal(res.last.body.count, 4321);
      assert.equal("success" in res.last.body, false);
      assert.equal("status" in res.last.body, false);
      assert.equal("statusCode" in res.last.body, false);
      assert.equal("data" in res.last.body, false);
      assert.equal("message" in res.last.body, false);
    } finally {
      mock.restoreAll();
    }
  });

  test("a missing counter document reads as 0, and a stored 0 also reads as 0", async () => {
    // `visitor?.count || 0` covers BOTH "no counter document yet" and "the
    // document exists but its count is 0". The `?.` is what keeps a first-ever
    // request from throwing on `null.count` — this handler is the
    // highest-traffic endpoint in the API and the most likely to hit a cold
    // database.
    for (const stored of [null, undefined, { count: 0 }, {}]) {
      mock.restoreAll();
      mock.method(Visitor, "findOne", async () => stored);
      try {
        const res = recordingRes();
        await getVisitorCount(fakeReq(), res);
        assert.equal(res.last.status, 200);
        assert.deepEqual(
          res.last.body,
          { count: 0 },
          `${JSON.stringify(stored)} must read as 0`,
        );
      } finally {
        mock.restoreAll();
      }
    }
  });

  test("a FAILED count read is a 500 with the SAME bare { count: 0 } shape", async () => {
    // The asymmetry inside this envelope: the failure branch returns
    // `{ count: 0 }` with NO `success` key, so a client cannot distinguish "zero
    // visitors so far" from "the database was unreachable" by the presence of a
    // flag — only by the status code. Preserved exactly.
    mock.method(Visitor, "findOne", async () => {
      throw new Error("mongo down");
    });
    mock.method(console, "error", () => {});
    try {
      const res = recordingRes();
      await getVisitorCount(fakeReq(), res);

      assert.equal(res.last.status, 500);
      assert.deepEqual(Object.keys(res.last.body), ["count"]);
      assert.equal(res.last.body.count, 0);
      assert.equal("success" in res.last.body, false);
    } finally {
      mock.restoreAll();
    }
  });

  test("an increment returns { success, count } — the one visitor shape with a flag", async () => {
    // `findOneAndUpdate` with `$inc` + `upsert: true` is a SINGLE ATOMIC
    // DOCUMENT OPERATION: two simultaneous page loads must not both read 100 and
    // both write 101. `new: true` returns the POST-increment value, so the
    // displayed total is not always one behind.
    mock.method(Visitor, "findOneAndUpdate", async () => ({ count: 101 }));
    try {
      const res = recordingRes();
      await incrementVisitor(fakeReq(), res);

      assert.equal(res.last.status, 200);
      assert.deepEqual(Object.keys(res.last.body).sort(), ["count", "success"]);
      assert.equal(res.last.body.success, true);
      assert.equal(res.last.body.count, 101);
    } finally {
      mock.restoreAll();
    }
  });

  test("a FAILED increment returns { success: false, count: 0 }", async () => {
    // `success: false` HERE but NO `success` key in `getVisitorCount`'s 500.
    // That inconsistency is the original's behaviour and is preserved; the two
    // halves of this one envelope are asserted separately precisely so nobody
    // "unifies" them.
    mock.method(Visitor, "findOneAndUpdate", async () => {
      throw new Error("mongo down");
    });
    mock.method(console, "error", () => {});
    try {
      const res = recordingRes();
      await incrementVisitor(fakeReq(), res);

      assert.equal(res.last.status, 500);
      assert.deepEqual(Object.keys(res.last.body).sort(), ["count", "success"]);
      assert.equal(res.last.body.success, false);
      assert.equal(res.last.body.count, 0);
    } finally {
      mock.restoreAll();
    }
  });

  test("neither visitor shape is ever an ApiResponse or an error envelope", () => {
    // The rule, executable: none of the four visitor bodies may carry a status
    // key of any spelling, and none may carry an `errors` list. A single
    // `new ApiResponse(...)` or `throw new ApiError(...)` introduced into either
    // visitor handler breaks one of these assertions.
    const forbidden = ["status", "statusCode", "data", "message", "errors"];

    for (const body of [{ count: 0 }, { count: 4321 }]) {
      for (const key of forbidden) {
        assert.equal(
          key in body,
          false,
          `a bare visitor body must not carry \`${key}\``,
        );
      }
    }
  });
});
