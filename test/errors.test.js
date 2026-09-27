// =============================================================================
// `errors.js` — all four response branches of the ported Express error handler.
//
// WHY THIS MATTERS. `toErrorResponse` reproduces all four branches of
// `cpccu-server/src/app.js:78-117`. The client parses the resulting envelope
// key-by-key, so the EXACT KEY SET of each branch is part of the API contract —
// and one of those key sets is asymmetric in a way that is trivially breakable:
//
//     branch 1 (file size)  -> { status, message, errors: [] }
//     branch 2 (dup key)    -> { status, message, errors: [{ field, message }] }
//     branch 3 (ApiError)   -> { status, message, errors }
//     branch 4 (unhandled)  -> { status, message }          <-- NO `errors` KEY
//
// Branch 4 has no `errors` key AT ALL, and that asymmetry is preserved
// deliberately: the frontend reads `errors` CONDITIONALLY on some endpoints, so
// an always-present empty array on the 500 branch would be a visible change.
// "Tidying" branch 4 into the same shape as the other three is a one-line change
// that silently alters what clients see, which is why each branch's key set is
// asserted with `Object.keys()` rather than with a property check.
//
// LOADING. Imported through the `@/` alias, and the module's own
// `import 'server-only'` is stubbed — both handled in `test/loader.mjs`, which
// `npm test` loads via `--import`.
// =============================================================================

import { test, describe, mock } from "node:test";
import assert from "node:assert/strict";

import { ApiError, isResponsePair, toErrorResponse } from "@/lib/server/errors";
import { MAX_UPLOAD_BYTES, uploadSizeMessage } from "@/lib/server/constants";

/**
 * Branch 4 logs the real error UNCONDITIONALLY (`console.error('Unhandled server
 * error:', err)`) — redaction belongs on the wire, not in the operator's own
 * logs. That is correct behaviour and it is noisy in a test run, so it is
 * silenced here rather than in the module. `mock.method` restores the original
 * when the test ends, so nothing leaks between files.
 *
 * @param {() => void} body
 * @returns {{error: unknown}} the captured `console.error` arguments
 */
function withSilencedErrorLog(body) {
  const calls = [];
  mock.method(console, "error", (...args) => {
    calls.push(args);
  });
  try {
    return { result: body(), calls };
  } finally {
    mock.restoreAll();
  }
}

describe("toErrorResponse — branch 1: file-size / multer LIMIT_FILE_SIZE", () => {
  test("returns a 400 whose message is the SINGLE SOURCE OF TRUTH upload message", () => {
    const pair = toErrorResponse({ code: "LIMIT_FILE_SIZE" });

    assert.equal(pair.status, 400, "the pair status is the HTTP status");
    assert.equal(pair.body.status, 400, "the body carries the same status");

    // The message is built from `MAX_UPLOAD_BYTES` rather than hard-coded,
    // because the hard-coded text used to say "less than 5MB" while the enforced
    // cap is 4 MiB — which told a user to retry with a file the server would
    // reject again. It is the same string `cloudinary.js` throws, so both paths
    // agree by construction.
    assert.equal(pair.body.message, uploadSizeMessage());
    assert.equal(
      pair.body.message,
      "File size too large. Profile picture must be at most 4MB.",
      "the message must be derived from MAX_UPLOAD_BYTES, not written out",
    );
    assert.equal(MAX_UPLOAD_BYTES, 4 * 1024 * 1024);
  });

  test("the key set is EXACTLY { status, message, errors } with an empty errors array", () => {
    const { body } = toErrorResponse({ code: "LIMIT_FILE_SIZE" });

    // `Object.keys` on purpose: this is an assertion about the SHAPE, and a
    // property-existence check would pass even if a fourth key appeared. An
    // extra key on a 400 is a contract change a client cannot see coming.
    assert.deepEqual(Object.keys(body).sort(), ["errors", "message", "status"]);
    assert.deepEqual(
      body.errors,
      [],
      "errors is present and EMPTY, not absent",
    );
  });

  test("the branch is selected by `code` alone and does not require a MulterError instance", () => {
    // The App Router has no multer, so the error is whatever the shim produced.
    // Matching on the `code` string rather than on `instanceof` is what lets the
    // same branch catch both shapes.
    assert.equal(toErrorResponse({ code: "LIMIT_FILE_SIZE" }).status, 400);
    assert.equal(
      toErrorResponse({
        code: "LIMIT_FILE_SIZE",
        name: "MulterError",
        field: "image",
      }).status,
      400,
    );

    // A DIFFERENT multer limit is NOT this branch — it falls through to the
    // catch-all, because the Express original only special-cased the size one.
    const other = withSilencedErrorLog(() =>
      toErrorResponse({ code: "LIMIT_FILE_COUNT" }),
    );
    assert.equal(other.result.status, 500);
    assert.notEqual(other.result.body.message, uploadSizeMessage());
  });
});

describe("toErrorResponse — branch 2: Mongo duplicate key (11000)", () => {
  test('email gets the actionable 409 message and `errors[0].field === "email"`', () => {
    const { status, body } = toErrorResponse({
      code: 11000,
      keyValue: { email: "a@b.com" },
    });

    assert.equal(status, 409);
    assert.equal(body.status, 409);
    assert.equal(body.message, "Validation failed");
    assert.equal(body.errors.length, 1);
    assert.equal(body.errors[0].field, "email");
    assert.equal(
      body.errors[0].message,
      "This email address is already registered. Please use a different email.",
    );

    assert.deepEqual(Object.keys(body).sort(), ["errors", "message", "status"]);
  });

  test("uniID gets a message that tells the user to contact an administrator", () => {
    // A Student ID is issued by the institution, so a duplicate is usually a
    // genuine data-entry problem the user cannot resolve by typing something
    // different — hence the different wording from the email case.
    const { status, body } = toErrorResponse({
      code: 11000,
      keyValue: { uniID: "2020-1" },
    });

    assert.equal(status, 409);
    assert.equal(body.errors[0].field, "uniID");
    assert.equal(
      body.errors[0].message,
      "This Student ID is already registered. Please contact an administrator if you believe this is a mistake.",
    );
  });

  test('any other field falls through to the generic "X already exists." template', () => {
    const { body } = toErrorResponse({
      code: 11000,
      keyValue: { certificateId: "ABC-1" },
    });

    assert.equal(body.errors[0].field, "certificateId");
    assert.equal(body.errors[0].message, "certificateId already exists.");
  });

  test('a missing or empty `keyValue` degrades to the literal field name "field"', () => {
    // `Object.keys(err.keyValue || {})[0] || 'field'` — the fallback keeps the
    // response well-formed rather than throwing inside the error handler, which
    // is the one place a throw cannot be handled.
    for (const err of [{ code: 11000 }, { code: 11000, keyValue: {} }]) {
      const { status, body } = toErrorResponse(err);
      assert.equal(status, 409);
      assert.equal(body.errors[0].field, "field");
      assert.equal(body.errors[0].message, "field already exists.");
    }
  });

  test("the `MongoServerError` spelling is accepted and is fully subsumed by the code test", () => {
    // The Express handler tested
    // `err.code === 11000 || (err.name === 'MongoServerError' && err.code === 11000)`.
    // The second clause is subsumed by the first, so both spellings land on the
    // same branch — asserted so that simplification is not read as a removal.
    const driver = toErrorResponse({
      code: 11000,
      name: "MongoServerError",
      keyValue: { email: "a@b.com" },
    });
    const wrapper = toErrorResponse({
      code: 11000,
      name: "MongoError",
      keyValue: { email: "a@b.com" },
    });

    assert.equal(driver.status, 409);
    assert.equal(wrapper.status, 409);
    assert.deepEqual(driver.body, wrapper.body);
  });

  test("11000 as a STRING is not a duplicate key — it falls through to the 500 branch", () => {
    // Mongo emits a number. A string `'11000'` is a different thing, and treating
    // it as a duplicate would let an arbitrary error masquerade as a 409.
    const { result } = withSilencedErrorLog(() =>
      toErrorResponse({ code: "11000" }),
    );
    assert.equal(result.status, 500);
  });
});

describe("toErrorResponse — branch 3: ApiError", () => {
  test("the status, message and `error` LIST are carried through verbatim", () => {
    const fieldErrors = [
      { field: "email", message: "Email address is already registered." },
      { field: "uniID", message: "This Student ID is already registered." },
    ];
    const { status, body } = toErrorResponse(
      new ApiError(409, "Validation failed", fieldErrors),
    );

    assert.equal(status, 409);
    assert.equal(body.status, 409);
    assert.equal(body.message, "Validation failed");
    // The SINGULAR property name (`error`) holding a PLURAL collection is
    // preserved; it is the field both the serialiser and the Express error
    // handler read, and renaming it would drop every field-level message.
    assert.deepEqual(body.errors, fieldErrors);
    assert.deepEqual(Object.keys(body).sort(), ["errors", "message", "status"]);
  });

  test("`errors` is an empty array (not absent) when the ApiError carries no field list", () => {
    const { body } = toErrorResponse(new ApiError(400, "Post ID is required"));

    assert.deepEqual(body.errors, []);
    assert.deepEqual(Object.keys(body).sort(), ["errors", "message", "status"]);
  });

  test("a falsy statusCode defaults to 400, and 419 (OTP expired) survives", () => {
    // `statusCode || 400` — the default exists so `new ApiError()` cannot produce
    // a `ResponseInit` with a non-numeric status, which would be a `RangeError`
    // and therefore a 500 with a null body.
    assert.equal(new ApiError(0, "x").statusCode, 400);
    assert.equal(new ApiError(undefined, "x").statusCode, 400);
    assert.equal(new ApiError("", "x").statusCode, 400);
    assert.equal(new ApiError(null, "x").statusCode, 400);

    // 419 is not an HTTP-registered code, but this codebase uses it for "OTP
    // expired" and the client already relies on it.
    const expired = toErrorResponse(new ApiError(419, "OTP has expired"));
    assert.equal(expired.status, 419);
    assert.equal(expired.body.status, 419);
  });

  test("503 and 502 are both reachable through ApiError", () => {
    // `503` (service unavailable / DB down) and `502` (bad gateway) are named in
    // the ApiError docblock as reachable states, so they are pinned rather than
    // left as an untested claim.
    for (const code of [502, 503]) {
      const { status, body } = toErrorResponse(
        new ApiError(code, "upstream unavailable"),
      );
      assert.equal(status, code);
      assert.equal(body.status, code);
    }
  });

  test("a SUBCLASS of ApiError still hits branch 3", () => {
    class DomainError extends ApiError {}
    const { status } = toErrorResponse(new DomainError(422, "unprocessable"));
    assert.equal(status, 422);
  });

  test("an object shaped like an ApiError but not an instance falls through to the 500 branch", () => {
    // `instanceof`, deliberately: a plain `{ statusCode: 403, message: 'nope' }`
    // from some third-party library is not one of OUR deliberate errors, and
    // treating it as one would let an unrecognised error's own text reach the
    // client unredacted.
    const { result } = withSilencedErrorLog(() =>
      toErrorResponse({
        statusCode: 403,
        message: "mongo connection string leaked here",
      }),
    );
    assert.equal(result.status, 500);
  });
});

describe("toErrorResponse — branch 4: the unhandled 500, and its MISSING errors key", () => {
  test("the key set is EXACTLY { status, message } — there is NO `errors` key", () => {
    // THIS IS THE ASYMMETRY. Branches 1-3 all carry `errors`; this one does
    // not, and that is preserved because the frontend reads `errors`
    // CONDITIONALLY on some endpoints. `Object.keys` is used rather than
    // `assert.equal(body.errors, undefined)` so that ADDING the key back — the
    // one-line "tidying" that breaks the contract — fails this test.
    const { result } = withSilencedErrorLog(() =>
      toErrorResponse(new Error("boom")),
    );

    assert.equal(result.status, 500);
    assert.equal(result.body.status, 500);
    assert.deepEqual(Object.keys(result.body).sort(), ["message", "status"]);
    assert.equal(
      "errors" in result.body,
      false,
      "the 500 branch must NOT carry an `errors` key, even an empty one",
    );
  });

  test("the real error is ALWAYS logged, and the redaction is on the wire only", () => {
    // Gating the `console.error` on NODE_ENV previously meant local dev and
    // preview deploys emitted no stack trace for an unhandled error WHILE STILL
    // returning the raw message to the client — so the one environment where a
    // developer is diagnosing the failure was the one with no log. Redaction
    // belongs on the wire, not in the operator's own logs, so the log is
    // unconditional in every environment.
    const secret = "mongodb+srv://user:hunter2@cluster.example/db";
    const { calls } = withSilencedErrorLog(() =>
      toErrorResponse(new Error(secret)),
    );

    assert.equal(
      calls.length,
      1,
      "exactly one console.error per unhandled error",
    );
    assert.equal(calls[0][0], "Unhandled server error:");
    assert.ok(calls[0][1] instanceof Error);
    assert.ok(
      JSON.stringify(calls[0][1].message).includes("hunter2"),
      "the LOG keeps the real message even in production",
    );
  });

  test("NODE_ENV=production redacts the message; any other value keeps it", () => {
    const original = process.env.NODE_ENV;

    try {
      process.env.NODE_ENV = "production";
      delete process.env.VERBOSE_ERRORS;
      const prod = withSilencedErrorLog(() =>
        toErrorResponse(
          new Error("mongodb+srv://user:hunter2@cluster.example/db"),
        ),
      );
      assert.equal(prod.result.body.message, "Internal Server Error");
      assert.equal(
        prod.result.body.message.includes("hunter2"),
        false,
        "internal detail must not reach the client in production",
      );

      for (const nodeEnv of ["development", "test", "staging", "preview"]) {
        process.env.NODE_ENV = nodeEnv;
        const raw = withSilencedErrorLog(() =>
          toErrorResponse(new Error("stack-shaped detail")),
        );
        assert.equal(
          raw.result.body.message,
          "stack-shaped detail",
          `NODE_ENV=${nodeEnv} keeps the raw message so a developer can diagnose locally`,
        );
      }
    } finally {
      if (original === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = original;
      delete process.env.VERBOSE_ERRORS;
    }
  });

  test("VERBOSE_ERRORS overrides NODE_ENV in BOTH directions", () => {
    // `VERBOSE_ERRORS` exists because the redaction is gated on a variable the
    // application does NOT control: NODE_ENV is set by the build and the
    // platform, and a host that builds with it unset serves a PRODUCTION
    // database while taking the non-redacting branch. The override is checked
    // FIRST, as an explicit string equality on 'true' — not truthiness, so
    // `VERBOSE_ERRORS=0` and `VERBOSE_ERRORS=` do not accidentally enable it —
    // and it wins over NODE_ENV in both directions.
    const originalNodeEnv = process.env.NODE_ENV;
    const originalVerbose = process.env.VERBOSE_ERRORS;

    const cases = [
      // [ NODE_ENV, VERBOSE_ERRORS, expected message ]
      ["production", "true", "raw detail"], // documented escape hatch for debugging a live deploy
      ["production", "false", "Internal Server Error"],
      ["development", "false", "Internal Server Error"], // the direction that FIXES the finding
      ["production", "0", "Internal Server Error"], // not truthiness
      ["production", "", "Internal Server Error"],
      ["production", "TRUE", "Internal Server Error"], // case-sensitive equality
      ["production", "1", "Internal Server Error"],
      ["production", undefined, "Internal Server Error"], // absent -> NODE_ENV behaviour
      ["development", undefined, "raw detail"],
    ];

    try {
      for (const [nodeEnv, verbose, expected] of cases) {
        process.env.NODE_ENV = nodeEnv;
        if (verbose === undefined) delete process.env.VERBOSE_ERRORS;
        else process.env.VERBOSE_ERRORS = verbose;

        const { result } = withSilencedErrorLog(() =>
          toErrorResponse(new Error("raw detail")),
        );
        assert.equal(
          result.body.message,
          expected,
          `NODE_ENV=${nodeEnv} VERBOSE_ERRORS=${JSON.stringify(verbose)}`,
        );
      }
    } finally {
      if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = originalNodeEnv;
      if (originalVerbose === undefined) delete process.env.VERBOSE_ERRORS;
      else process.env.VERBOSE_ERRORS = originalVerbose;
    }
  });

  test("a non-Error throw and an error with no message both degrade safely", () => {
    // A `throw 'string'` or `throw null` is legal JavaScript, and this is the
    // one code path that cannot let anything else handle it, so it must not be
    // the thing that throws a SECOND time.
    const cases = ["a string", null, undefined, 42, {}, { message: "" }];

    for (const thrown of cases) {
      const { result } = withSilencedErrorLog(() => toErrorResponse(thrown));
      assert.equal(result.status, 500);
      assert.equal(typeof result.body.message, "string");
      assert.ok(
        result.body.message.length > 0,
        "the message must never be empty",
      );
      assert.deepEqual(Object.keys(result.body).sort(), ["message", "status"]);
    }
  });
});

describe("the response-pair brand", () => {
  test("every branch returns a BRANDED pair, and only a pair is recognised", () => {
    // `http.js` recognises these pairs with `isResponsePair` rather than a
    // duck-typed `typeof x.status === 'number'` test. That check would be
    // UNSAFE here, because `status` is a REAL FIELD NAME on the domain
    // documents these pairs travel alongside: `adminContent.model.js` defines
    // `status` on `Event` ('upcoming'), `ContactMessage` ('unread') and
    // `DeveloperProfile` ('pending'). A handler returning a single `Event` would
    // be mistaken for an error pair and serialised as
    // `Response.json(null, { status: 'upcoming' })` — a non-numeric
    // `ResponseInit.status`, i.e. a `RangeError`, i.e. a 500 with a null body.
    // Arrays were unaffected, which is why the bug only ever showed up on
    // single-document GETs.
    const pairs = [
      toErrorResponse({ code: "LIMIT_FILE_SIZE" }),
      toErrorResponse({ code: 11000, keyValue: { email: "a@b.com" } }),
      toErrorResponse(new ApiError(400, "nope")),
      withSilencedErrorLog(() => toErrorResponse(new Error("boom"))).result,
    ];

    for (const pair of pairs) {
      assert.equal(
        isResponsePair(pair),
        true,
        `${JSON.stringify(pair.body)} must be a pair`,
      );
    }

    // The brand is a module-private symbol, so it is invisible to
    // `JSON.stringify` and to `Object.keys` — it never leaks into a body.
    const pair = pairs[0];
    assert.equal(
      Object.keys(pair).includes("errors"),
      false,
      "the brand key is a symbol, not a string, so Object.keys cannot see it",
    );
    assert.equal(JSON.parse(JSON.stringify(pair)).body.status, 400);

    // A domain document with a `status` FIELD is not a pair. This is the exact
    // false positive the brand exists to prevent.
    assert.equal(isResponsePair({ status: "upcoming" }), false);
    assert.equal(
      isResponsePair({ status: "unread", message: "x", errors: [] }),
      false,
    );
    assert.equal(isResponsePair({ status: 200, data: [] }), false);

    // And the null / primitive cases.
    for (const value of [null, undefined, 0, "", "x", [], () => {}]) {
      assert.equal(
        isResponsePair(value),
        false,
        `${String(value)} is not a pair`,
      );
    }
  });

  test("the brand is a SYMBOL, so a look-alike forged with a string key is rejected", () => {
    // The symbol is created inside the module and never exported, so no other
    // module can mint a pair by accident. A string key of the same name must not
    // satisfy the check.
    assert.equal(
      isResponsePair({
        "[Symbol(cpccu.responsePair)]": true,
        status: 500,
        body: {},
      }),
      false,
    );
    assert.equal(isResponsePair({ status: 500, body: {} }), false);
  });
});
