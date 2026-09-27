// =============================================================================
// `request.js` — `getClientIp`, the sole definition of "a client" for limiting.
//
// WHY THIS IS SECURITY-RELEVANT. Every IP-keyed rate limiter in this codebase
// keys on this value: `loginRateLimiter` (10 / 15 min),
// `registrationRateLimiter` (100 / hour), `authEmailRateLimiter`,
// `passwordResetRateLimiter`, `contactRateLimiter` (3 / min),
// `memberListRateLimiter`, `uploadRateLimiter` and
// `otpVerificationRateLimiter`. A forged header does not merely weaken one limit —
// it removes the per-caller dimension from ALL of them at once, and the controls
// that matter are the credential-guessing ones. (`userUploadRateLimiter` keys on
// the authenticated user id instead, which is why it is unaffected.)
//
// THE `.pop()` IS CORRECT AND MUST NOT BE "FIXED" TO `[0]`. The Vercel edge
// OVERWRITES `X-Forwarded-For` on every request and APPENDS the address it
// observed to whatever chain it received, so the address IT saw — the one hop we
// actually trust — is the RIGHTMOST entry. `[0]` is the value the ORIGINAL
// CLIENT claimed, and is attacker-controlled. Changing `.pop()` to `[0]` silently
// disables every IP-keyed rate limiter in the app while every test that checks
// "an IP was returned" still passes. The spoofed-chain tests below exist
// specifically to make that change fail.
//
// HARD DEPLOYMENT CONSTRAINT, restated because it is easy to forget: these
// headers are only trustworthy because the edge overwrites them. Behind a host
// that does not (a bare Node process, a container, a reverse proxy, a local
// `next dev`), all three are ordinary client-supplied fields. That is a
// deployment property, not something these tests can or should verify.
//
// LOADING. Imported through the `@/` alias, with `server-only` stubbed — both
// handled in `test/loader.mjs`, which `npm test` loads via `--import`.
// =============================================================================

import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { getClientIp } from "@/lib/server/request";

/**
 * A `Request`-alike carrying only headers, which is all `getClientIp` reads.
 * `Headers` is the real WHATWG class, so header-name casing behaves exactly as it
 * does in production — including the case-insensitivity that lets an attacker try
 * `X-Real-IP`, `x-real-ip` and `X-REAL-IP` interchangeably.
 */
function withHeaders(headers) {
  return { headers: new Headers(headers) };
}

describe("getClientIp — header preference order", () => {
  // Preference order, each candidate validated before the next is tried:
  //   1. x-real-ip                (set by Vercel's own edge, not client-settable)
  //   2. x-vercel-forwarded-for   (the Vercel-specific equivalent)
  //   3. x-forwarded-for          (rightmost entry)
  //   4. the fixed fallback string 'unknown'
  test("x-real-ip wins over both forwarded-for headers", () => {
    assert.equal(
      getClientIp(
        withHeaders({
          "x-real-ip": "203.0.113.1",
          "x-vercel-forwarded-for": "198.51.100.1",
          "x-forwarded-for": "192.0.2.1",
        }),
      ),
      "203.0.113.1",
    );
  });

  test("x-vercel-forwarded-for is used when x-real-ip is absent", () => {
    assert.equal(
      getClientIp(
        withHeaders({
          "x-vercel-forwarded-for": "198.51.100.1",
          "x-forwarded-for": "192.0.2.1",
        }),
      ),
      "198.51.100.1",
    );
  });

  test("x-forwarded-for is the last resort, and only when it is the sole source", () => {
    assert.equal(
      getClientIp(withHeaders({ "x-forwarded-for": "192.0.2.1" })),
      "192.0.2.1",
    );
  });

  test("no usable source at all yields the fixed fallback", () => {
    // A single fixed string rather than `undefined` or a random value, because
    // this value becomes a rate-limit KEY. Returning `undefined` would collapse
    // every user into one shared bucket and deny service to everyone once any
    // single client trips a limit; a random value would give every request a
    // fresh bucket and disable limiting entirely. The fallback is deliberately
    // a SHARED bucket: it over-limits rather than under-limits.
    for (const headers of [
      {},
      { "x-real-ip": "" },
      { "x-forwarded-for": "   " },
    ]) {
      assert.equal(getClientIp(withHeaders(headers)), "unknown");
    }
    // A request with no headers object at all.
    assert.equal(getClientIp({}), "unknown");
    assert.equal(getClientIp(undefined), "unknown");
  });

  test("header names are matched case-insensitively, as HTTP requires", () => {
    // A client cannot smuggle a second `x-real-ip` past the lookup by casing it
    // differently; the WHATWG `Headers` class normalises, and the function reads
    // by the lower-case name.
    assert.equal(
      getClientIp(withHeaders({ "X-Real-IP": "203.0.113.9" })),
      "203.0.113.9",
    );
    assert.equal(
      getClientIp(withHeaders({ "X-Forwarded-For": "192.0.2.9" })),
      "192.0.2.9",
    );
  });
});

describe("getClientIp — the RIGHTMOST x-forwarded-for entry", () => {
  test("a SPOOFED chain yields the rightmost entry, not the attacker-supplied leftmost one", () => {
    // THE TEST THAT PINS `.pop()`. An attacker sends
    //   x-forwarded-for: 1.2.3.4
    // and the Vercel edge appends the address it actually saw, giving
    //   x-forwarded-for: 1.2.3.4, 203.0.113.50
    // The RIGHTMOST entry is the one we trust. If this were `[0]`, the attacker
    // would get a fresh rate-limit bucket per request and every IP-keyed limiter
    // in the app — login, registration, contact, OTP, password reset — would be
    // defeated at once.
    const spoofed = getClientIp(
      withHeaders({ "x-forwarded-for": "1.2.3.4, 5.6.7.8, 203.0.113.50" }),
    );
    assert.equal(
      spoofed,
      "203.0.113.50",
      "the rightmost entry is the edge-observed address",
    );
    assert.notEqual(
      spoofed,
      "1.2.3.4",
      "the leftmost entry is attacker-controlled and must be ignored",
    );
    assert.notEqual(spoofed, "5.6.7.8");
  });

  test("a longer spoofed chain still resolves to the rightmost entry", () => {
    assert.equal(
      getClientIp(
        withHeaders({
          "x-forwarded-for":
            "10.0.0.1, 172.16.0.1, 192.168.1.1, 1.1.1.1, 2.2.2.2, 198.51.100.77",
        }),
      ),
      "198.51.100.77",
    );
  });

  test("a single-entry x-forwarded-for is already the rightmost entry", () => {
    assert.equal(
      getClientIp(withHeaders({ "x-forwarded-for": "203.0.113.5" })),
      "203.0.113.5",
    );
  });

  test("the rightmost entry is taken from x-vercel-forwarded-for as well", () => {
    // The multi-entry split is applied symmetrically to BOTH forwarded headers.
    // The previous code returned `x-real-ip` raw and trimmed the other two, so
    // the same client could get two different rate-limit keys depending on which
    // header arrived.
    assert.equal(
      getClientIp(
        withHeaders({ "x-vercel-forwarded-for": "1.2.3.4, 198.51.100.20" }),
      ),
      "198.51.100.20",
    );
  });

  test("padding around the chain entries is trimmed, so a padded chain is not a fallback", () => {
    // A rate-limit key that is not a valid IP is a SHARED BUCKET waiting to
    // happen: every caller with the same padding would collide on one key.
    assert.equal(
      getClientIp(
        withHeaders({ "x-forwarded-for": "  1.2.3.4 ,  203.0.113.60  " }),
      ),
      "203.0.113.60",
    );
    assert.equal(
      getClientIp(withHeaders({ "x-forwarded-for": "  203.0.113.61  " })),
      "203.0.113.61",
    );
  });
});

describe("getClientIp — a whitespace-only x-real-ip falls through to the next source", () => {
  // `x-real-ip: " "` is a truthy string that trims to `''`. Returning it would
  // make the literal key `''`, which EVERY such caller then shares — one
  // malformed header from one client would exhaust everyone's budget.
  test("a whitespace-only x-real-ip is rejected, not returned", () => {
    assert.equal(
      getClientIp(
        withHeaders({
          "x-real-ip": "   ",
          "x-vercel-forwarded-for": "198.51.100.2",
        }),
      ),
      "198.51.100.2",
      "a whitespace-only x-real-ip must fall through to the next source",
    );
    assert.equal(
      getClientIp(
        withHeaders({
          "x-real-ip": "   ",
          "x-forwarded-for": "192.0.2.2",
        }),
      ),
      "192.0.2.2",
    );
  });

  test("a whitespace-only x-real-ip with no other source yields the fallback", () => {
    assert.equal(getClientIp(withHeaders({ "x-real-ip": "\t\n " })), "unknown");
    assert.equal(getClientIp(withHeaders({ "x-real-ip": " " })), "unknown");
  });

  test("a tab- or newline-padded real IP is trimmed and accepted", () => {
    assert.equal(
      getClientIp(withHeaders({ "x-real-ip": " 203.0.113.11 " })),
      "203.0.113.11",
    );
    assert.equal(
      getClientIp(withHeaders({ "x-real-ip": "\t203.0.113.12\n" })),
      "203.0.113.12",
    );
  });
});

describe("getClientIp — every candidate is validated as a real IP", () => {
  // `net.isIP` returns 0 (falsy) for anything that is not a valid v4 or v6
  // address, which is exactly the "reject this candidate and fall through to the
  // next source" signal. Without it, `x-real-ip: "banana"` would become the
  // literal rate-limit key `"banana"`.
  test("garbage in x-real-ip falls through to a valid later source", () => {
    for (const garbage of [
      "banana",
      "not-an-ip",
      "999.999.999.999",
      "1.2.3",
      "1.2.3.4.5",
      "0x7f.0.0.1",
    ]) {
      assert.equal(
        getClientIp(
          withHeaders({ "x-real-ip": garbage, "x-forwarded-for": "192.0.2.3" }),
        ),
        "192.0.2.3",
        `${JSON.stringify(garbage)} must be rejected`,
      );
    }
  });

  test("garbage in EVERY source yields the shared fallback bucket", () => {
    assert.equal(
      getClientIp(
        withHeaders({
          "x-real-ip": "banana",
          "x-vercel-forwarded-for": "also-garbage",
          "x-forwarded-for": "1.2.3.4, still-garbage",
        }),
      ),
      "unknown",
    );
  });

  test("a valid IPv6 address is accepted, and a spoofed IPv6 chain resolves rightmost", () => {
    assert.equal(
      getClientIp(withHeaders({ "x-real-ip": "2001:db8::1" })),
      "2001:db8::1",
    );
    assert.equal(
      getClientIp(
        withHeaders({ "x-forwarded-for": "2001:db8::dead, 2001:db8::beef" }),
      ),
      "2001:db8::beef",
    );
  });

  test("a malformed IPv6 address is rejected", () => {
    assert.equal(
      getClientIp(
        withHeaders({
          "x-real-ip": "2001:db8:::1",
          "x-forwarded-for": "192.0.2.4",
        }),
      ),
      "192.0.2.4",
    );
  });

  test("a CIDR suffix is NOT a valid IP and is rejected", () => {
    // `203.0.113.0/24` is a network, not a host address. Returning it would put
    // every client behind that network in one bucket keyed by a string that
    // `net.isIP` does not recognise.
    assert.equal(
      getClientIp(
        withHeaders({
          "x-real-ip": "203.0.113.0/24",
          "x-forwarded-for": "192.0.2.5",
        }),
      ),
      "192.0.2.5",
    );
  });
});

describe("getClientIp — the value is a usable rate-limit key", () => {
  test("the same client behind the same chain always gets the SAME key", () => {
    // The reason the header preference order and the validation are written the
    // way they are: two requests from one client must land in one bucket, or the
    // limiter counts nothing.
    const headers = {
      "x-real-ip": "203.0.113.20",
      "x-forwarded-for": "1.2.3.4, 203.0.113.20",
    };
    const first = getClientIp(withHeaders(headers));
    const second = getClientIp(withHeaders(headers));
    assert.equal(first, second);
    assert.equal(first, "203.0.113.20");
  });

  test("a different client gets a different key", () => {
    assert.notEqual(
      getClientIp(withHeaders({ "x-real-ip": "203.0.113.20" })),
      getClientIp(withHeaders({ "x-real-ip": "203.0.113.21" })),
    );
  });

  test("the real address and the vercel header agree, so either path yields one key", () => {
    // Vercel documents `x-real-ip` and `x-vercel-forwarded-for` as carrying the
    // same value as `x-forwarded-for`. If the two paths through the preference
    // order could produce different strings for the same client, that client would
    // get two buckets.
    const viaReal = getClientIp(
      withHeaders({
        "x-real-ip": "203.0.113.30",
        "x-vercel-forwarded-for": "203.0.113.30",
        "x-forwarded-for": "203.0.113.30",
      }),
    );
    const viaVercel = getClientIp(
      withHeaders({
        "x-vercel-forwarded-for": "203.0.113.30",
        "x-forwarded-for": "203.0.113.30",
      }),
    );
    const viaForwarded = getClientIp(
      withHeaders({ "x-forwarded-for": "203.0.113.30" }),
    );

    assert.equal(viaReal, viaVercel);
    assert.equal(viaVercel, viaForwarded);
  });
});
