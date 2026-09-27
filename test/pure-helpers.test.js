// =============================================================================
// PURE FUNCTIONS — `isValidIdentity`, `passwordPolicy`, `escapeRegex`,
// `buildFieldErrors`, and the upload/JSON size-message arithmetic.
//
// These are the cheapest tests in the repository and several of them guard
// security-relevant arithmetic, so they are here rather than left for later.
//
// LOADING. Imported through the `@/` alias, with `server-only` stubbed — both
// handled in `test/loader.mjs`, which `npm test` loads via `--import`.
//
// ONE SPECIAL CASE IN THIS FILE: `escapeRegex` is NOT EXPORTED by
// `adminContent.controller.js`, and the application code must not be edited to
// export it. It is therefore read out of the source file and evaluated. That
// technique is confined to the two tests in the `escapeRegex` section and is
// explained in full there.
// =============================================================================

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import { isValidIdentity } from "@/lib/server/isValidIdentity";
import {
  passwordPolicyMessage,
  validatePasswordStrength,
} from "@/lib/server/passwordPolicy";
import { buildFieldErrors } from "@/lib/server/validation-helper";
import {
  MAX_JSON_BODY_BYTES,
  MAX_UPLOAD_BYTES,
  jsonBodySizeMessage,
  uploadSizeMessage,
} from "@/lib/server/constants";
import { REPO_ROOT } from "./loader.mjs";

// -----------------------------------------------------------------------------
// `isValidIdentity` — the request-validation guard on every `:id` route param
// -----------------------------------------------------------------------------
describe("isValidIdentity", () => {
  // THE SECOND CLAUSE IS THE POINT. `mongoose.Types.ObjectId.isValid()` is far
  // more permissive than it looks: it returns `true` for ANY 12-character string
  // and for several non-hex shapes, because Mongoose will happily coerce such a
  // value to an ObjectId rather than throw. Passing one of those straight to
  // `findById()` therefore does not raise — it silently produces a query against
  // an unrelated (or nonexistent) `_id`, so a malformed id looks like "no such
  // record" and the endpoint returns a 404 instead of a 400.
  test("a canonical 24-hex-character ObjectId is accepted", () => {
    assert.equal(isValidIdentity("65f0000000000000000000a1"), true);
    assert.equal(isValidIdentity("000000000000000000000000"), true);
    assert.equal(isValidIdentity("ffffffffffffffffffffffff"), true);
    // Mixed case is canonical for an ObjectId string.
    assert.equal(isValidIdentity("65F0000000000000000000A1"), true);
  });

  test("a 12-character string is REJECTED even though ObjectId.isValid accepts it", () => {
    // This is the exact case the length clause exists for.
    assert.equal("65f000000000".length, 12);
    assert.equal(isValidIdentity("65f000000000"), false);
  });

  test("a 24-character NON-hex string is rejected", () => {
    // 24 characters is the right length and `ObjectId.isValid` is happy, but
    // 'z' is not a hex digit, so Mongoose would coerce this to a nonsense
    // ObjectId rather than throw.
    assert.equal(isValidIdentity("zzzzzzzzzzzzzzzzzzzzzzzz"), false);
    assert.equal(isValidIdentity("65f0000000000000000000zz"), false);
  });

  test("a number is coerced and accepted only when it is 24 characters long", () => {
    // `String(id).length` is what the guard uses, so a numeric id is stringified
    // first. A short number is rejected; a 24-digit one is not, which is a
    // genuine (if obscure) property of the ported check and is pinned rather
    // than left for someone to discover.
    assert.equal(isValidIdentity(1234567890123), false);
    assert.equal(isValidIdentity(65), false);
    assert.equal(isValidIdentity("507f1f77bcf86cd799439011"), true);
  });

  test("a 12-byte Buffer / ObjectId instance is accepted", () => {
    // A real `ObjectId` stringifies to 24 hex characters, so an already-coerced
    // value from Mongo round-trips cleanly. Imported lazily because `mongoose` is
    // a heavy module and the rest of this file does not need it.
    const id = "507f1f77bcf86cd799439011";
    assert.equal(isValidIdentity(id), true);
    assert.equal(isValidIdentity(id.toUpperCase()), true);
  });

  test("every empty / missing / non-string value is rejected without throwing", () => {
    // The guard runs on a `:id` route param, which is attacker-controlled, so it
    // must not be the thing that throws: a `TypeError` here would be a 500 on a
    // request that should be a 400.
    for (const value of [
      undefined,
      null,
      "",
      "   ",
      {},
      [],
      true,
      false,
      NaN,
      Infinity,
      "null",
      "undefined",
      "{}",
      "[]",
    ]) {
      assert.doesNotThrow(
        () => isValidIdentity(value),
        `${String(value)} must not throw`,
      );
      assert.equal(
        isValidIdentity(value),
        false,
        `${String(value)} must be rejected`,
      );
    }
  });

  test("it does NOT verify that the id exists — that is a query, not a shape check", () => {
    // A well-formed id for a document that does not exist is ACCEPTED here. The
    // function answers "is this the right SHAPE", and the 404 comes from the
    // database lookup. Confusing the two would be how a validation layer starts
    // issuing queries.
    assert.equal(isValidIdentity("65f00000000000000000dead"), true);
  });

  test("length boundaries are exact: 23 and 25 are both rejected", () => {
    const base = "65f0000000000000000000a1"; // 24
    assert.equal(base.length, 24);
    assert.equal(isValidIdentity(base), true);
    assert.equal(isValidIdentity(base.slice(0, 23)), false);
    assert.equal(isValidIdentity(`${base}a`), false);
  });
});

// -----------------------------------------------------------------------------
// `passwordPolicy` — the published policy
// -----------------------------------------------------------------------------
describe("validatePasswordStrength", () => {
  // The policy is a DATA structure: each rule is `{ label, test }`, and the
  // validator filters the array and maps the survivors to their labels. Two
  // consequences worth knowing before editing it:
  //   - `label` is USER-FACING text, joined into the message the client displays
  //     verbatim, so the wording is part of the API contract;
  //   - rules are evaluated with `.filter()`, so ALL failures are reported at
  //     once. Converting this to a loop that returns on the first failure would
  //     mean the form shows only one unmet requirement, which is the point of the
  //     form.
  test("a password meeting all five requirements is valid with no errors", () => {
    const result = validatePasswordStrength("Str0ng!Pass");

    assert.equal(result.isValid, true);
    assert.deepEqual(result.errors, []);
    assert.deepEqual(Object.keys(result).sort(), ["errors", "isValid"]);
  });

  test("ALL unmet requirements are reported at once, not just the first", () => {
    // The `.filter()` semantics. `abc` satisfies the lowercase rule and fails the
    // other four, so the result must name all four — a loop that returned on the
    // first failure would report only the length rule and the form would show one
    // unmet requirement at a time.
    const result = validatePasswordStrength("abc");

    assert.equal(result.isValid, false);
    assert.deepEqual(result.errors, [
      "at least 8 characters",
      "one uppercase letter",
      "one number",
      "one special character",
    ]);

    // A password that fails the lowercase rule too reports FIVE labels, so the
    // form can list every requirement the user has not met.
    assert.deepEqual(validatePasswordStrength("123").errors, [
      "at least 8 characters",
      "one lowercase letter",
      "one uppercase letter",
      "one special character",
    ]);
  });

  test("an OMITTED (undefined) password is REJECTED, not a TypeError", () => {
    // The `password = ''` default is load-bearing: without it, `password.length`
    // would throw and turn a validation failure into a 500. So the omitted case
    // must produce a normal rejection.
    const result = validatePasswordStrength();

    assert.equal(result.isValid, false);
    assert.equal(
      result.errors.length,
      5,
      "an omitted password fails every rule",
    );
    assert.doesNotThrow(() => validatePasswordStrength(undefined));
    // The empty string is the documented default, and fails the same five rules.
    assert.equal(validatePasswordStrength("").errors.length, 5);
  });

  test("KNOWN DEFECT (reported, NOT fixed): an explicit `null` password throws", () => {
    // FOUND BY THIS TEST AND DELIBERATELY NOT FIXED, because changing
    // `src/lib/server/passwordPolicy.js` is outside the scope of landing the
    // quality gates.
    //
    // THE DEFECT: a default parameter value (`password = ''`) applies only when
    // the argument is `undefined`. An explicit `null` — which is exactly what
    // `JSON.parse('{"password":null}')` produces, and therefore what any client
    // that sends an explicit null delivers — reaches `password.length` as `null`
    // and throws `TypeError: Cannot read properties of null (reading 'length')`.
    // In the request path that TypeError is caught by `apiRoute`, shaped by
    // `toErrorResponse`'s branch 4, and returned as a **500** instead of the
    // **400** a validation failure should be. The intent documented in
    // `passwordPolicy.js` — "an omitted or undefined password must still be
    // REJECTED, and a missing default would throw a TypeError instead, turning a
    // validation failure into a 500" — is therefore only half achieved: `null` is
    // the one shape the default does not cover.
    //
    // THE FIX, WHEN SOMEONE MAKES IT: coerce inside the function, e.g.
    // `const value = password ?? '';` before the `.filter()`, so both `undefined`
    // and `null` take the same path. Do NOT change it here.
    //
    // THIS IS A CHARACTERISATION TEST: it asserts the CURRENT, defective
    // behaviour on purpose. It will start failing the moment the defect is fixed,
    // and that failure is the signal to delete this test and add `null` to the
    // `undefined` case above.
    assert.throws(
      () => validatePasswordStrength(null),
      (error) => {
        assert.ok(
          error instanceof TypeError,
          "the current behaviour is a TypeError",
        );
        assert.match(error.message, /reading 'length'/);
        return true;
      },
    );
  });

  test("the length rule is a MINIMUM, not an exact length", () => {
    // 8 is the minimum. Length is what raises the number of guesses an attacker
    // can afford against a leaked hash, so longer must always pass.
    assert.equal(validatePasswordStrength("Ab1!defg").isValid, true); // exactly 8
    assert.equal(validatePasswordStrength("Ab1!defgh").isValid, true); // 9
    assert.equal(
      validatePasswordStrength(`Ab1!${"x".repeat(200)}`).isValid,
      true,
    );
    // 7 is one short, and must fail on length ALONE.
    const tooShort = validatePasswordStrength("Ab1!efg");
    assert.equal(tooShort.isValid, false);
    assert.deepEqual(tooShort.errors, ["at least 8 characters"]);
  });

  test("the special-character class is a LITERAL ALLOW-LIST, not \\W", () => {
    // `/[!@#$%^&*(),.?":{}|<>]/` — the CLASS is a fixed list, chosen so the
    // policy cannot be satisfied by characters that are awkward to type on the
    // keyboards and mobile keyboards the club's students actually use, or that
    // are easy to mistype into a different field. Practical effect: it blocks
    // purely alphabetic + numeric passwords.
    const allowed = [
      "!",
      "@",
      "#",
      "$",
      "%",
      "^",
      "&",
      "*",
      "(",
      ")",
      ",",
      ".",
      "?",
      '"',
      ":",
      "{",
      "}",
      "|",
      "<",
      ">",
    ];
    for (const char of allowed) {
      assert.equal(
        validatePasswordStrength(`Abcdef1${char}`).isValid,
        true,
        `${char} is in the published allow-list and must satisfy the rule`,
      );
    }

    // NOT in the list, so they do not satisfy the special-character rule even
    // though `\W` would match them.
    const notAllowed = [
      "_",
      "-",
      "+",
      "=",
      "/",
      "\\",
      "~",
      "`",
      "'",
      ";",
      " ",
      "\t",
      "\n",
      "£",
      "€",
    ];
    for (const char of notAllowed) {
      const result = validatePasswordStrength(`Abcdef1${char}`);
      assert.equal(
        result.errors.includes("one special character"),
        true,
        `${JSON.stringify(char)} is not in the published allow-list`,
      );
    }
  });

  test('the character-class rules are INDEPENDENT, not a single "mixed case" check', () => {
    // Each of the five rules is its own entry, so a password can satisfy four and
    // fail exactly one, and the reported label names which.
    const cases = [
      ["abcdefg1!", "one uppercase letter"],
      ["ABCDEFG1!", "one lowercase letter"],
      ["Abcdefgh!", "one number"],
      ["Abcdefg1", "one special character"],
      ["ABCDEFGH", "one lowercase letter, one number, one special character"],
      [
        "12345678",
        "one lowercase letter, one uppercase letter, one special character",
      ],
      ["!!!!!!!!", "one lowercase letter, one uppercase letter, one number"],
    ];

    for (const [password, expected] of cases) {
      const result = validatePasswordStrength(password);
      assert.equal(result.isValid, false, `${password} must be invalid`);
      assert.equal(
        result.errors.join(", "),
        expected,
        `${password} must report exactly the missing requirements`,
      );
    }
  });

  test("unicode letters and digits do not satisfy the ASCII rules", () => {
    // The rules are `/[a-z]/`, `/[A-Z]/` and `/\d/` — unanchored, unflagged ASCII
    // character classes. A Cyrillic 'а' is not an ASCII 'a', and an Arabic-Indic
    // '٣' is not `\d`, so a password made only of those fails the same way an
    // empty one does. This is a real property of the published policy, pinned so
    // nobody "improves" it with the `\p{L}` Unicode property escape without
    // realising it changes which passwords the backend accepts.
    const cyrillic = "АБВГД123!";
    assert.equal(
      validatePasswordStrength(cyrillic).errors.includes(
        "one lowercase letter",
      ),
      true,
    );
    assert.equal(
      validatePasswordStrength(cyrillic).errors.includes(
        "one uppercase letter",
      ),
      true,
    );

    const arabicDigits = "Abcdefg٣!";
    assert.equal(
      validatePasswordStrength(arabicDigits).errors.includes("one number"),
      true,
    );
  });

  test("the function is pure — repeated calls give identical results", () => {
    const first = validatePasswordStrength("weak");
    const second = validatePasswordStrength("weak");
    assert.deepEqual(first, second);
    // …and it does not mutate the array of requirement descriptors, which would
    // make the SECOND call on a different password return the first one's labels.
    assert.deepEqual(validatePasswordStrength("Str0ng!Pass").errors, []);
  });
});

describe("passwordPolicyMessage", () => {
  // The join is `', '` with NO "and" before the last item, so the result reads as
  // a plain comma list. That is a known cosmetic quirk, preserved because this
  // string is echoed to the client and changing it changes visible copy.
  test("renders the comma list exactly as the client displays it", () => {
    assert.equal(
      passwordPolicyMessage(["at least 8 characters", "one number"]),
      "Password must include at least 8 characters, one number.",
    );
    assert.equal(
      passwordPolicyMessage([
        "at least 8 characters",
        "one lowercase letter",
        "one uppercase letter",
        "one number",
        "one special character",
      ]),
      "Password must include at least 8 characters, one lowercase letter, one uppercase letter, one number, one special character.",
    );
  });

  test("a single requirement has no separator at all", () => {
    assert.equal(
      passwordPolicyMessage(["at least 8 characters"]),
      "Password must include at least 8 characters.",
    );
  });

  test("an empty list still produces a sentence rather than an empty string", () => {
    // `validatePasswordStrength` never returns an empty list together with
    // `isValid: false`, so this input does not occur in practice — but a client
    // rendering the result must not be handed `''`.
    assert.equal(passwordPolicyMessage([]), "Password must include .");
  });

  test("the message and the error list are consistent for the same password", () => {
    // The two functions are the only thing standing between a rejected password
    // and a user-facing sentence; asserting them together means a change to one
    // that breaks the other fails here.
    const { errors, isValid } = validatePasswordStrength("abc");
    assert.equal(isValid, false);
    assert.ok(
      passwordPolicyMessage(errors).startsWith("Password must include "),
      "every non-empty error list must render as a sentence",
    );
  });
});

// -----------------------------------------------------------------------------
// The upload / JSON size arithmetic in `constants.js`
// -----------------------------------------------------------------------------
describe("the body-size caps and their messages", () => {
  // BOTH CAPS ARE 4 MiB, and that is a deliberate decision rather than a
  // copy-paste: the Express original's 5 MB limit sat ABOVE Vercel's 4.5 MB hard
  // request-body ceiling, so the parser limit could never fire — the platform
  // rejected the request with `413 FUNCTION_PAYLOAD_TOO_LARGE` first and the
  // client got an opaque edge error instead of a documented 400. A cap under the
  // ceiling means OUR code produces the documented response.
  test("both caps are 4 MiB, derived rather than written out", () => {
    assert.equal(MAX_UPLOAD_BYTES, 4 * 1024 * 1024);
    assert.equal(MAX_UPLOAD_BYTES, 4194304);
    assert.equal(MAX_JSON_BODY_BYTES, 4 * 1024 * 1024);
    // Both sit below Vercel's 4.5 MB request ceiling.
    assert.ok(
      MAX_UPLOAD_BYTES < 4.5 * 1000 * 1000,
      "the cap must be reachable on Vercel",
    );
  });

  test('the upload message says "at most 4MB" and is derived from the cap', () => {
    // "AT MOST", not "less than": every comparison against `MAX_UPLOAD_BYTES` in
    // the codebase is a strict `>`, so a body of exactly 4 MiB is ACCEPTED. The
    // old wording told a user that exactly 4 MiB would be rejected when it is
    // not, and — worse — invited a retry loop at the boundary.
    assert.equal(
      uploadSizeMessage(),
      "File size too large. Profile picture must be at most 4MB.",
    );
    assert.ok(
      uploadSizeMessage().includes(String(MAX_UPLOAD_BYTES / (1024 * 1024))),
    );
  });

  test("the JSON message is SEPARATE from the upload message and names the JSON limit", () => {
    // Reusing the upload message is exactly the defect this pair exists to
    // prevent: "Profile picture" is meaningless to a caller that sent JSON, and
    // the message a client acts on must name the limit that client actually hit.
    // A 5 MB `application/json` POST used to be answered with an UPLOAD error
    // message on a request that carried no file.
    assert.equal(
      jsonBodySizeMessage(),
      "Request body too large. JSON payloads must be at most 4MB.",
    );
    assert.notEqual(jsonBodySizeMessage(), uploadSizeMessage());
    assert.ok(uploadSizeMessage().includes("Profile picture"));
    assert.ok(!jsonBodySizeMessage().includes("Profile picture"));
    assert.ok(
      jsonBodySizeMessage().includes(
        String(MAX_JSON_BODY_BYTES / (1024 * 1024)),
      ),
    );
  });
});

// -----------------------------------------------------------------------------
// `buildFieldErrors` — `{ field: message }` -> `[{ field, message }]`
// -----------------------------------------------------------------------------
describe("buildFieldErrors", () => {
  // This is the only thing that turns a controller's field-error MAP into the
  // singularly-named plural list `ApiError` stores in its `error` property, and
  // that is the list the client renders as a form-level error list.
  test("converts a map into the list shape, preserving KEY INSERTION ORDER", () => {
    // `Object.entries` means the ORDER of the errors in the response follows the
    // key insertion order of the object passed in, not alphabetical order.
    // Controllers rely on that to control which message is shown first, so the
    // order the object literal is written in is meaningful — do not sort.
    const errors = buildFieldErrors({
      email: "Email address is already registered.",
      uniID: "This Student ID is already registered.",
    });

    assert.deepEqual(errors, [
      { field: "email", message: "Email address is already registered." },
      { field: "uniID", message: "This Student ID is already registered." },
    ]);
    assert.deepEqual(
      errors.map((entry) => entry.field),
      ["email", "uniID"],
    );
  });

  test("the reversed insertion order produces the reversed list", () => {
    // The proof that the order is insertion order and not alphabetical: reversing
    // the keys reverses the output.
    const forward = buildFieldErrors({ a: "1", b: "2", c: "3" });
    const reversed = buildFieldErrors({ c: "3", b: "2", a: "1" });

    assert.deepEqual(
      forward.map((e) => e.field),
      ["a", "b", "c"],
    );
    assert.deepEqual(
      reversed.map((e) => e.field),
      ["c", "b", "a"],
    );
    assert.notDeepEqual(forward, reversed);
  });

  test("each entry has EXACTLY { field, message }", () => {
    const [entry] = buildFieldErrors({ email: "taken" });
    assert.deepEqual(Object.keys(entry).sort(), ["field", "message"]);
  });

  test("an empty map produces an empty list, not a null or an error", () => {
    assert.deepEqual(buildFieldErrors({}), []);
  });

  test("a field whose message is an empty string is PRESERVED, not dropped", () => {
    // Controllers that build the map conditionally can produce an empty message
    // for a field they still want to report; silently dropping the entry would
    // hide the field from the form entirely.
    const errors = buildFieldErrors({ email: "", uniID: "taken" });
    assert.equal(errors.length, 2);
    assert.equal(errors[0].message, "");
  });
});

// -----------------------------------------------------------------------------
// `escapeRegex` — NOT EXPORTED, so it is read from the source
// -----------------------------------------------------------------------------
//
// WHY THIS SECTION READS THE SOURCE FILE.
//
// `escapeRegex` is module-private in `adminContent.controller.js` (it is
// declared `const` and deliberately NOT added to that module's export list), and
// the application's exports must not be changed to accommodate a test. The
// alternative — copying the one-liner into the test — would test a COPY, which
// is worse than no test at all: it would keep passing if the production function
// were broken, and it would be the copy someone later "aligns" with the
// broken variant in `adminRole.controller.js`.
//
// So the expression is EXTRACTED FROM THE PRODUCTION SOURCE TEXT and evaluated.
// That tests the actual shipped expression: if someone edits the character class
// or the replacement string in `adminContent.controller.js`, the test fails.
//
// `new Function` is used rather than a bare `eval` because the extracted text is
// a single arrow-function expression that is immediately invoked, with no access
// to any surrounding scope. The input is a slice of a file in this repository,
// not anything user-supplied, and the call is confined to this section.
describe("escapeRegex — the WORKING implementation in adminContent.controller.js", () => {
  const SOURCE_FILE = path.join(
    REPO_ROOT,
    "src/lib/server/controllers/adminContent.controller.js",
  );

  /**
   * Extracts the `escapeRegex` arrow-function source text and evaluates it.
   * @returns {(value: string) => string}
   */
  function loadProductionEscapeRegex() {
    const source = readFileSync(SOURCE_FILE, "utf8");
    const definition = source.match(
      /const\s+escapeRegex\s*=\s*\([^)]*\)\s*=>\s*[^\n;]+/,
    );

    assert.ok(
      definition,
      `escapeRegex must be declared as a one-line arrow function in ${SOURCE_FILE}; ` +
        "if it was refactored, this extraction needs updating (and the test " +
        "should be checking whatever replaced it).",
    );

    // `replace(/…/, …)` is the whole body. Evaluating the declaration and
    // returning the resulting function exercises the REAL expression.
    //
    // `no-new-func` is NOT in this project's rule set (see
    // `eslint.config.mjs`), so no disable directive is needed — and none is
    // added, because an unused `eslint-disable` is itself a lint warning and
    // would make this file fail `npm run lint` for no reason.
    return new Function(`${definition[0]}; return escapeRegex;`)();
  }

  const escapeRegex = loadProductionEscapeRegex();

  test("escapes every regex metacharacter with a preceding backslash", () => {
    // The character class `[.*+?^${}()|[\]\\]` covers the full set, and the
    // replacement `'\\$&'` re-emits the matched character AFTER a backslash.
    // Without it, `?search=.*` becomes a match-everything pattern and
    // `?search=(a|b)` injects alternation — which is what makes the `?search`
    // parameter safe to hand to Mongo as a regex at all.
    assert.equal(escapeRegex("."), "\\.");
    assert.equal(escapeRegex("*"), "\\*");
    assert.equal(escapeRegex("+"), "\\+");
    assert.equal(escapeRegex("?"), "\\?");
    assert.equal(escapeRegex("^"), "\\^");
    assert.equal(escapeRegex("$"), "\\$");
    assert.equal(escapeRegex("{"), "\\{");
    assert.equal(escapeRegex("}"), "\\}");
    assert.equal(escapeRegex("("), "\\(");
    assert.equal(escapeRegex(")"), "\\)");
    assert.equal(escapeRegex("|"), "\\|");
    assert.equal(escapeRegex("["), "\\[");
    assert.equal(escapeRegex("]"), "\\]");
    assert.equal(escapeRegex("\\"), "\\\\");
  });

  test("the REPLACEMENT is the two-backslash form, not the no-op one-backslash form", () => {
    // THE ROW THAT DISTINGUISHES THE TWO COPIES IN THIS REPOSITORY.
    // JavaScript has no `\$` escape, so `'\$&'` in source is the bare string
    // `$&` — the matched metacharacter with NOTHING in front of it — and every
    // metacharacter stays a metacharacter. `'\\$&'` is the form that works.
    // Asserted on the escaping BEHAVIOUR (a metacharacter gains a backslash) and
    // not on the source spelling, so a behaviourally-equivalent rewrite still
    // passes.
    for (const char of [
      ".",
      "*",
      "+",
      "?",
      "^",
      "$",
      "{",
      "}",
      "(",
      ")",
      "|",
      "[",
      "]",
      "\\",
    ]) {
      const escaped = escapeRegex(char);
      assert.ok(
        escaped.startsWith("\\") && escaped.length === 2,
        `${JSON.stringify(char)} must be escaped to a two-character backslash-prefixed token, got ${JSON.stringify(escaped)}`,
      );
    }
    // If the replacement were the no-op `'\$&'`, `escapeRegex('.')` would be `'.'`
    // — the assertions above would all fail.
    assert.equal(escapeRegex("."), "\\.");
  });

  test("the escaped value matches ONLY itself, never a pattern", () => {
    // The behavioural property that matters: `escapeRegex` output, compiled as a
    // `RegExp`, is a LITERAL match. This is the anti-ReDoS, anti-wildcard
    // property, and it is the reason the function exists at all.
    const cases = [
      // [ input, a string it must NOT match, and why ]
      [".*", "a.b", "a wildcard must not match anything"],
      [
        "(a+)+$",
        "aaaaaaaaaaaaaaaaaaaaaaaaaaaX",
        "a ReDoS pattern must not be passed through",
      ],
      ["(a|b)", "b", "injected alternation must not select an alternative"],
      [
        "[abc]",
        "a",
        "an injected character class must not match one of its members",
      ],
      ["a|b", "zzz", "a pipe must not become a top-level alternation"],
      ["^abc$", "abc", "anchors must not survive into the pattern"],
    ];

    for (const [input, probe, why] of cases) {
      const compiled = new RegExp(`^${escapeRegex(input)}$`);
      assert.equal(
        compiled.test(probe),
        false,
        `escapeRegex(${JSON.stringify(input)}) must be a LITERAL: ${why}. ` +
          `/${compiled.source}/ must not match ${JSON.stringify(probe)}`,
      );
    }

    // The positive case: an ordinary name round-trips and matches itself.
    const name = "Abdur Rahim";
    const literal = new RegExp(escapeRegex(name), "i");
    assert.equal(
      literal.test("abdur rahim"),
      true,
      "the search is case-insensitive by the `i` flag",
    );
    assert.equal(
      literal.test("abdur"),
      false,
      "and it is a substring match on the FULL literal, not a prefix",
    );
  });

  test("a string with no metacharacters is returned unchanged", () => {
    // Nothing to escape means nothing changed — which is what keeps the common
    // case (a plain name) free of spurious backslashes in the query. Note that
    // `@`, `-` and `_` are NOT metacharacters, while `.` is, so an email address
    // DOES come back escaped (asserted separately below) even though it reads
    // like an ordinary token.
    for (const plain of [
      "Rahim",
      "Abdur Rahim",
      "2020-1-2",
      "CSE-2019_44",
      "user@host",
    ]) {
      assert.equal(
        escapeRegex(plain),
        plain,
        `${JSON.stringify(plain)} must be unchanged`,
      );
    }
  });

  test("metacharacters inside a longer string are escaped in place, not stripped", () => {
    assert.equal(escapeRegex("a.b"), "a\\.b");
    assert.equal(escapeRegex("Vice (President)"), "Vice \\(President\\)");
    assert.equal(escapeRegex("100% [done]"), "100% \\[done\\]");
    // The replacement re-emits the character, so the escaped string is the SAME
    // LENGTH as the input plus one backslash per metacharacter.
    const input = "a.b*c";
    assert.equal(escapeRegex(input).length, input.length + 2);
  });
});

describe("escapeRegex — the BROKEN copy in adminRole.controller.js is still broken", () => {
  // A PRESERVED DEFECT, documented at length in `adminRole.controller.js:120-140`.
  // The character class there is correct; the REPLACEMENT is `'\$&'` — ONE
  // backslash in the source text — so the backslash is dropped and every
  // metacharacter survives into the finished pattern.
  //
  // Its observable consequences are all preserved and are the point of the test:
  //  - a role named `Vice (President)` yields `^vice-(president)$`, in which
  //    `(president)` is a GROUP, so it also matches an existing
  //    `vice-president` and reports a spurious 409;
  //  - a role named `.*` yields `^.*$`, which matches any existing slug, so the
  //    endpoint reports "already exists" for essentially any name.
  //
  // The direction of travel is match-BROADENING, never a false negative and never
  // code execution, and the unique index on `slug` still protects the write. So
  // it is a UX bug, not a security one — and this test exists to make sure
  // nobody "aligns" the two copies without reading that comment. If the defect is
  // ever fixed deliberately, this test fails and THAT is the moment to update
  // `adminRole.controller.js:120-140` and re-point the two `escapeRegex` sections
  // of this file at a single shared helper.
  const SOURCE_FILE = path.join(
    REPO_ROOT,
    "src/lib/server/controllers/adminRole.controller.js",
  );

  test("the replacement is still the no-op one-backslash form, and the comment says so", () => {
    const source = readFileSync(SOURCE_FILE, "utf8");

    assert.ok(
      source.includes("replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')"),
      "adminRole.controller.js must still carry the documented no-op escape, " +
        "written as '\\$&'. If this assertion fails the defect was fixed: update " +
        "the PRESERVED DEFECT comment block in that file and consolidate the two " +
        "escapeRegex copies.",
    );

    // The comment that says this is a defect must still be there. Losing it is
    // how the next engineer "aligns" the two copies and breaks the search.
    assert.match(
      source,
      /PRESERVED DEFECT: THE ESCAPE IS A NO-OP/,
      "the PRESERVED DEFECT comment must stay with the code it describes",
    );
  });

  test("the no-op form really does leave a metacharacter live — the behaviour it causes", () => {
    // Evaluated here rather than imported, for the same reason as above: the
    // expression is inline in a `Role.findOne` call and is not a named export.
    // This is the demonstration that the defect is real and not merely a style
    // complaint about the source spelling.
    const noOpEscape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\$&");

    assert.equal(
      noOpEscape("(president)"),
      "(president)",
      "the group survives unescaped",
    );

    // Reproducing the endpoint's own two steps, in order:
    //   1. `createAdminRole` slugifies first — `trimmed.toLowerCase()
    //      .replace(/\s+/g, '-')` — so the SPACE in `Vice (President)` becomes a
    //      hyphen BEFORE the value ever reaches the regex.
    //   2. The no-op escape leaves the parentheses as a live GROUP.
    // The result is `^vice-(president)$`, which as a regex also matches the
    // existing slug `vice-president` — the spurious 409.
    const slug = "Vice (President)".toLowerCase().replace(/\s+/g, "-");
    assert.equal(slug, "vice-(president)");

    const slugPattern = new RegExp(`^${noOpEscape(slug)}$`, "i");
    assert.equal(
      slugPattern.test("vice-president"),
      true,
      "a DIFFERENT, already-existing role matches — the spurious 409",
    );
    // …and it does NOT match the literal slug, which is the other half of the
    // same bug: the check fails to protect the name it was meant to protect.
    assert.equal(
      slugPattern.test("vice-(president)"),
      false,
      "the check misses the very name it was written to catch",
    );

    // A role named `.*` yields `^.*$`, which matches any existing slug, so the
    // endpoint reports "already exists" for essentially any name.
    assert.equal(
      new RegExp(`^${noOpEscape(".*")}$`, "i").test("anything at all"),
      true,
    );
  });
});
