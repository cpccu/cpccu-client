// =============================================================================
// `request.js` — `assertSameOrigin`, the CSRF control. EVERY branch.
//
// WHY THIS IS A PRIORITY. This is a security control with no coverage at all,
// and it is the second of two independent CSRF layers in this codebase (the
// first is `SameSite=Lax` on the auth cookies). The Express original was
// STRUCTURALLY CSRF-VULNERABLE: `COOKIE_OPTIONS.sameSite` was `'none'`,
// `verifyToken` read the `accessToken` cookie BEFORE the `Authorization` header,
// and `express.urlencoded()` was mounted — so a bare cross-site
// `<form method="POST">` (no JavaScript, no custom headers, therefore no CORS
// preflight) arrived fully authenticated.
//
// The function is a CONJUNCTION of several independent rules, and every one of
// them has a "reasonable simplification" that removes a layer:
//
//   Sec-Fetch-Site: same-origin              -> allowed
//   Sec-Fetch-Site: none                    -> allowed (typed URL / email link)
//   Sec-Fetch-Site: same-site + allow-listed Origin -> allowed
//   Sec-Fetch-Site: same-site, no/other Origin      -> DENIED
//   no Sec-Fetch-Site + allow-listed Origin         -> allowed (old browsers)
//   no Sec-Fetch-Site, no Origin + Bearer           -> allowed (non-browser)
//   no Sec-Fetch-Site, no Origin, no Bearer         -> DENIED
//
// A sibling subdomain (`evil.cpccu.club`) is the realistic threat this exists to
// stop, and it is the case most likely to be broken by a "cleanup", so it gets
// its own named test.
//
// LOADING. Imported through the `@/` alias, with `server-only` stubbed — both
// handled in `test/loader.mjs`, loaded by `npm test` via `--import`.
//
// ENVIRONMENT DETERMINISM. `allowedOrigins()` reads `WEB_DOMAIN`,
// `NEXT_PUBLIC_SITE_URL` and `EXTRA_ALLOWED_ORIGINS` LAZILY on every call (a
// module-load capture would freeze the decision before the platform's
// environment is fully populated). These tests therefore SET those variables
// themselves, so the allow-list is the same on a developer's laptop, in CI and
// on a machine that has a populated `.env`. Without that, a test that passed
// locally could fail in CI purely because the ambient allow-list differed.
// =============================================================================

import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";

import { assertSameOrigin } from "@/lib/server/request";

/** The apex domain used for every allow-list assertion below. */
const APEX = "https://cpccu.club";
/** The `www.` sibling, which `apexAndWww` derives automatically. */
const WWW = "https://www.cpccu.club";
/** A sibling subdomain under the same registrable domain — the attack case. */
const SIBLING = "https://evil.cpccu.club";
/** An unrelated site. */
const FOREIGN = "https://attacker.example";

/**
 * Builds a `Request`-alike with just the headers `assertSameOrigin` reads.
 *
 * A real `Request` is not used because `assertSameOrigin` reads exactly two
 * things off it — `method` and `headers.get()` — and constructing a genuine
 * `Request` would add a body/lifecycle surface that these tests must not depend
 * on. `Headers` IS the real WHATWG class, so header-name casing and
 * case-insensitive lookup behave exactly as they do in production.
 *
 * @param {string} method
 * @param {Record<string, string>} headers
 */
function request(method, headers = {}) {
  return { method, headers: new Headers(headers) };
}

/**
 * The origin-control environment every assertion in this file runs under.
 * Restored by the `after` hook so nothing leaks into another test file.
 */
const ENV_KEYS = [
  "WEB_DOMAIN",
  "NEXT_PUBLIC_SITE_URL",
  "EXTRA_ALLOWED_ORIGINS",
];
const SAVED_ENV = {};

before(() => {
  for (const key of ENV_KEYS) SAVED_ENV[key] = process.env[key];

  // Only `WEB_DOMAIN` is set. `NEXT_PUBLIC_SITE_URL` is deliberately left unset
  // so the tests do not depend on the apex/www derivation being reachable twice,
  // and `EXTRA_ALLOWED_ORIGINS` is empty so nothing is implicitly trusted.
  process.env.WEB_DOMAIN = APEX;
  delete process.env.NEXT_PUBLIC_SITE_URL;
  process.env.EXTRA_ALLOWED_ORIGINS = "";
});

after(() => {
  for (const key of ENV_KEYS) {
    if (SAVED_ENV[key] === undefined) delete process.env[key];
    else process.env[key] = SAVED_ENV[key];
  }
});

/** Asserts that a request is accepted (the function returns, it does not throw). */
function assertAllowed(method, headers) {
  assert.doesNotThrow(
    () => assertSameOrigin(request(method, headers)),
    `${method} ${JSON.stringify(headers)} must be ALLOWED`,
  );
}

/** Asserts that a request is refused with a 403 and the CSRF message. */
function assertDenied(method, headers) {
  assert.throws(
    () => assertSameOrigin(request(method, headers)),
    (error) => {
      assert.equal(error.statusCode, 403, "a refused request must be a 403");
      assert.equal(error.message, "Cross-origin request rejected");
      return true;
    },
    `${method} ${JSON.stringify(headers)} must be DENIED`,
  );
}

describe("assertSameOrigin — safe methods are exempt entirely", () => {
  // `SAFE_METHODS` is `{ GET, HEAD, OPTIONS }`. A safe method cannot change
  // state, so there is nothing for a cross-site request to forge the effect of.
  // `OPTIONS` is included because the CORS preflight it answers is ITSELF the
  // browser asking whether the cross-site request would be allowed.
  for (const method of ["GET", "HEAD", "OPTIONS"]) {
    test(`${method} passes with no headers at all`, () => {
      assertAllowed(method, {});
    });
  }

  test("the method test is case-insensitive, and a missing method defaults to GET", () => {
    // `(request?.method || 'GET').toUpperCase()`. The lowercase `get` must be
    // recognised as safe, and the lowercase `post` must be recognised as unsafe
    // (proving the upper-casing ran rather than a lowercase method simply falling
    // through every `Set` lookup and being treated as safe).
    assertAllowed("get", {});
    assertAllowed("post", { origin: APEX });
    assertDenied("post", { origin: FOREIGN });
    assertDenied("Delete".toLowerCase(), { origin: FOREIGN });
    assertAllowed("delete", { origin: APEX });

    // A request object with no `method` at all is treated as a GET, i.e. safe.
    assert.doesNotThrow(() => assertSameOrigin({ headers: new Headers() }));
    assert.doesNotThrow(() => assertSameOrigin({}));
    assert.doesNotThrow(() => assertSameOrigin(undefined));
  });

  test("a safe method is exempt even for a hostile origin", () => {
    // Deliberate, and the reason the control is not simply "compare Origin":
    // a cross-site GET is not state-changing, and blocking it would break every
    // externally-linked asset and every prefetch.
    assertAllowed("GET", { origin: FOREIGN, "sec-fetch-site": "cross-site" });
    assertAllowed("HEAD", { origin: "null", "sec-fetch-site": "cross-site" });
  });
});

describe("assertSameOrigin — Sec-Fetch-Site is the primary signal", () => {
  test("`same-origin` is allowed, with or without an Origin header", () => {
    // The primary signal, set by the BROWSER as part of the fetch standard. It
    // cannot be set by `fetch`, XHR or any other scripted API — a page cannot
    // forge it, and it is not settable from JavaScript at all.
    assertAllowed("POST", { "sec-fetch-site": "same-origin" });
    assertAllowed("POST", { "sec-fetch-site": "same-origin", origin: APEX });
    // Even when the Origin is one this deployment does NOT trust: a browser
    // asserting `same-origin` is a stronger statement than any Origin value, and
    // it covers the case Origin cannot (a same-origin POST with no Origin).
    assertAllowed("POST", { "sec-fetch-site": "same-origin", origin: FOREIGN });
  });

  test("`none` is allowed — the user navigated directly, with no referring site", () => {
    // `'none'` means the user TYPED the URL, bookmarked it, or followed a link.
    // The `/reset-password/[code]/[token]` email link arrives exactly this way
    // and must keep working.
    assertAllowed("POST", { "sec-fetch-site": "none" });
    assertAllowed("POST", { "sec-fetch-site": "none", origin: FOREIGN });
  });

  test("`same-site` WITH an allow-listed Origin is allowed", () => {
    // `same-site` is only a SITE relationship — "the initiating document shares
    // a REGISTRABLE DOMAIN with the request" — which is much weaker than
    // "same-origin". It is accepted ONLY in combination with an `Origin` this
    // deployment actually trusts, because the Express CORS allow-list named
    // `cpccu.club` and `www.cpccu.club` (and the `.pro.bd` pair) as DISTINCT
    // permitted origins. Configuring only one of a pair would silently exclude
    // the other, and since this conjunction is now the only way through, a
    // www→apex redirect would 403 on every unsafe method with no way to fix it
    // short of editing this function.
    assertAllowed("POST", { "sec-fetch-site": "same-site", origin: APEX });
    // The apex/www sibling is derived automatically by `apexAndWww`, so the
    // operator does not have to remember to list both halves of a pair.
    assertAllowed("POST", { "sec-fetch-site": "same-site", origin: WWW });
  });

  test("`same-site` ALONE is DENIED — this is the sibling-subdomain attack", () => {
    // THE ROW THAT MATTERS MOST. `evil.cpccu.club` satisfies `same-site` and
    // also has `cpccu.club` in its cookie scope, so it passes `SameSite=Lax` AND
    // passes a bare `same-site` check. A sibling subdomain serving
    // attacker-controlled markup is exactly the cross-site request this function
    // exists to stop, and it is a far more realistic threat than a bare
    // cross-origin form POST — which `SameSite=Lax` already blocks on its own.
    assertDenied("POST", { "sec-fetch-site": "same-site" });
    assertDenied("POST", { "sec-fetch-site": "same-site", origin: SIBLING });
    assertDenied("POST", {
      "sec-fetch-site": "same-site",
      origin: "https://staging.cpccu.club",
    });
    assertDenied("POST", {
      "sec-fetch-site": "same-site",
      origin: "https://old.cpccu.club",
    });
  });

  test("`cross-site` is denied whatever the Origin says", () => {
    // There is no allow-listed `cross-site` conjunction: a request the browser
    // has already classified as cross-site is refused, full stop. Note the
    // ALLOW-LISTED origin does not rescue it — the only origins permitted here
    // are the site's OWN, and a page on one of those cannot produce
    // `sec-fetch-site: cross-site` while talking to itself.
    assertDenied("POST", { "sec-fetch-site": "cross-site" });
    assertDenied("POST", { "sec-fetch-site": "cross-site", origin: FOREIGN });
    assertDenied("POST", { "sec-fetch-site": "cross-site", origin: SIBLING });
  });

  test("`Origin: null` is denied", () => {
    // The literal string `null`, which a browser sends for a sandboxed iframe, a
    // `data:` document, a `file:` document and some redirect chains. It is not an
    // allow-listed origin, so it is refused — the check is an allow-list, so an
    // UNRECOGNISED origin is rejected rather than a matching one being trusted.
    assertDenied("POST", { "sec-fetch-site": "same-site", origin: "null" });
    assertDenied("POST", { origin: "null" });
    assertDenied("POST", { "sec-fetch-site": "cross-site", origin: "null" });
  });

  test("the Sec-Fetch-Site value is trimmed and lower-cased before comparison", () => {
    // A browser never sends padded values, but the normalisation is in the code
    // and a test that did not pin it would let someone drop `.trim()` believing
    // it redundant.
    assertAllowed("POST", { "sec-fetch-site": "  SAME-ORIGIN  " });
    assertAllowed("POST", {
      "sec-fetch-site": "Same-Site",
      origin: "  HTTPS://CPCCU.CLUB  ",
    });
    assertDenied("POST", { "sec-fetch-site": "  SAME-SITE  " });
  });
});

describe("assertSameOrigin — the missing-header fallback, and the bearer escape hatch", () => {
  test("an allow-listed Origin with NO Sec-Fetch-Site is allowed", () => {
    // THE FALLBACK IS WEAKER AND EXISTS ONLY FOR OLDER BROWSERS. A client that
    // omits `Sec-Fetch-Site` entirely (pre-Chrome-76 / pre-Firefox-90, and every
    // non-browser client) falls back to comparing `Origin` against the
    // allow-list. A non-browser client can set `Origin` freely, so this is not a
    // complete defence on its own — it is defence in depth BEHIND
    // `SameSite=Lax`, not a replacement for it.
    assertAllowed("POST", { origin: APEX });
    assertAllowed("POST", { origin: WWW });
  });

  test("an un-allow-listed Origin with no Sec-Fetch-Site is denied", () => {
    assertDenied("POST", { origin: FOREIGN });
    assertDenied("POST", { origin: SIBLING });
    // The sibling derivation is HOSTNAME-based and deliberately produces nothing
    // for an IP literal or a `localhost` origin, so neither gains a sibling.
    assertDenied("POST", { origin: "https://cpccu.club.evil.example" });
    assertDenied("POST", { origin: "https://notcpccu.club" });
  });

  test("the Origin comparison is on the EXACT normalised string, not a suffix", () => {
    // `allowedOrigins()` normalises the CONFIGURED values (trim, lower-case,
    // strip trailing slashes) and the incoming header is trimmed and
    // lower-cased, but the match is `Set.has` on the resulting STRING. There is
    // no `endsWith`, no `includes` and no URL parsing on the incoming value, so
    // none of the following can be talked past it.
    //
    // `https://cpccu.club.attacker.net` is registrable by an attacker and is NOT
    // the site; an `endsWith('cpccu.club')` implementation would accept it.
    assertDenied("POST", { origin: "https://cpccu.club.attacker.net" });
    assertDenied("POST", { origin: "https://notcpccu.club" });
    assertDenied("POST", { origin: "https://cpccu.club.evil.example" });

    // The scheme is part of the compared string, so the `http://` form of the
    // site is not the site — which is correct, because this API is HTTPS-only in
    // production and an `http` origin in a mixed-content situation is exactly
    // what the check should refuse.
    assertDenied("POST", { origin: "http://cpccu.club" });

    // A PATH is not stripped, so this is not the configured origin.
    assertDenied("POST", { origin: "https://cpccu.club/evil" });

    // A TRAILING SLASH ON THE REQUEST is likewise not stripped. Only the
    // CONFIGURED value has its trailing slashes removed
    // (`value.trim().toLowerCase().replace(/\/+$/, '')`), because that is where
    // operators paste them — `WEB_DOMAIN=https://cpccu.club/` is a normal thing
    // to write. A browser never puts a trailing slash in an `Origin` header
    // (the header is scheme + host + optional port, per the Fetch standard), so
    // this asymmetry is not reachable in practice; it is pinned so that a future
    // "be lenient about the request too" change is a visible decision rather
    // than an accident.
    assertDenied("POST", { origin: "https://cpccu.club/" });

    // The configured value IS lenient, which is the point of the asymmetry: a
    // trailing slash in the environment variable must not silently produce an
    // allow-list that matches nothing.
    const saved = process.env.WEB_DOMAIN;
    try {
      process.env.WEB_DOMAIN = "  HTTPS://CPCCU.CLUB///  ";
      assertAllowed("POST", { origin: APEX });
      assertAllowed("POST", { origin: WWW });
      // …and `apexAndWww` cannot rescue a schemeless configuration either:
      // `new URL('cpccu.club')` throws, it returns `[]`, and the literal string
      // is compared as-is. A schemeless `WEB_DOMAIN` therefore produces an
      // allow-list that only a schemeless `Origin` matches — which is a
      // MISCONFIGURATION that fails CLOSED (a real browser always sends a scheme,
      // so nothing matches and every unsafe request 403s), not one that fails
      // open. Pinned because "fails closed, loudly" is the property that matters
      // here; silently widening it to `https://<anything>` would not.
      process.env.WEB_DOMAIN = "cpccu.club";
      assertAllowed("POST", { origin: "cpccu.club" });
      assertDenied("POST", { origin: "https://cpccu.club" });
      assertDenied("POST", { origin: "http://cpccu.club" });
    } finally {
      process.env.WEB_DOMAIN = saved;
    }
  });

  test("no Sec-Fetch-Site and no Origin, but a Bearer token, is allowed", () => {
    // THE ESCAPE HATCH, and it is a security argument rather than a convenience
    // shortcut. A request that carries NEITHER browser header is not a browser:
    // browsers set `Origin` on every state-changing request and `Sec-Fetch-Site`
    // on every fetch, so their absence is a POSITIVE signal. Such a request is
    // allowed only when it also presents `Authorization: Bearer`.
    //
    // `Authorization` is a CORS non-simple header, so setting it cross-site
    // requires a preflight this API never answers, and the token is not in a jar
    // an attacker's page can read. A request that must carry a bearer token is
    // therefore not CSRF-able at all.
    assertAllowed("POST", { authorization: "Bearer abc.def.ghi" });
    assertAllowed("POST", { authorization: "bearer abc.def.ghi" });
    assertAllowed("POST", { authorization: "  BEARER   abc.def.ghi  " });
  });

  test("the `Bearer ` prefix is REQUIRED, not cosmetic", () => {
    // Accepting the header with any other scheme would keep the CORS property
    // (the preflight is about the header, not the scheme) but would accept junk,
    // and a bare `Authorization: x` is not a credential this codebase issues —
    // `auth.js` reads it as `authorization?.replace('Bearer ', '')`.
    assertDenied("POST", { authorization: "abc.def.ghi" });
    assertDenied("POST", { authorization: "Basic dXNlcjpwYXNz" });
    assertDenied("POST", { authorization: "Bearer" });
    assertDenied("POST", { authorization: "Bearer " });
    assertDenied("POST", { authorization: "Bearerabc" });
  });

  test("no browser header AND no bearer token is denied", () => {
    // With neither browser header AND no bearer token there is nothing left to
    // distinguish a script from an attacker, so the request is rejected. This is
    // what 403s a bare `curl` POST, and it is the intended behaviour.
    assertDenied("POST", {});
    assertDenied("POST", { "user-agent": "curl/8.0" });
    assertDenied("POST", { accept: "application/json" });
    // An EMPTY Origin is not an origin: `originAllowed` requires a non-empty
    // value, so `Origin: ` does not accidentally satisfy the allow-list.
    assertDenied("POST", { origin: "" });

    // A WHITESPACE-ONLY Origin is normalised to `''` by
    // `headers.get('origin')?.trim().toLowerCase() || ''`, and therefore counts
    // as ABSENT — so the request reaches the bearer branch and is ALLOWED when it
    // carries a token. Pinned because it is the opposite of what a reader
    // skimming `if (!origin && hasBearerCredentials(headers))` might guess: the
    // trim happens BEFORE the emptiness test, so a padded `Origin` header cannot
    // be used to smuggle a request past the non-browser escape hatch.
    assertAllowed("POST", { origin: "   ", authorization: "Bearer x" });
    assertAllowed("POST", { origin: "\t\n", authorization: "Bearer x" });
    // …and with no token, a whitespace-only Origin is simply denied.
    assertDenied("POST", { origin: "   " });
    assertDenied("POST", { origin: "   ", authorization: "Basic abc" });
  });

  test("EXTRA_ALLOWED_ORIGINS is an ADDITIVE list that cannot rescue a bare same-site", () => {
    // The deployment-time escape hatch for a host that is genuinely neither the
    // apex nor its `www.` sibling — a staging domain, a preview deployment, a
    // first-party subdomain with its own frontend. It exists so that adding one
    // is a Vercel environment variable, not a pull request against a
    // security-critical allow-list. It is ADDITIVE: it cannot remove the
    // configured domains, and it cannot make a bare `same-site` request
    // acceptable unless the caller actually sends that `Origin`.
    const saved = process.env.EXTRA_ALLOWED_ORIGINS;
    try {
      process.env.EXTRA_ALLOWED_ORIGINS =
        "https://staging.cpccu.club, https://preview.example ,";

      // The added origin now passes the Origin-only fallback…
      assertAllowed("POST", { origin: "https://staging.cpccu.club" });
      // …and now satisfies the `same-site` conjunction, which is the whole
      // reason the staging host was being 403'd before it existed.
      assertAllowed("POST", {
        "sec-fetch-site": "same-site",
        origin: "https://staging.cpccu.club",
      });
      assertAllowed("POST", {
        "sec-fetch-site": "same-site",
        origin: "https://preview.example",
      });

      // …but it does NOT make a bare `same-site` acceptable, and it does not
      // trust anything else.
      assertDenied("POST", { "sec-fetch-site": "same-site" });
      assertDenied("POST", { "sec-fetch-site": "same-site", origin: SIBLING });
      assertDenied("POST", { origin: FOREIGN });

      // The configured domains survive: this is additive, not a replacement.
      assertAllowed("POST", { origin: APEX });
      assertAllowed("POST", { origin: WWW });
    } finally {
      process.env.EXTRA_ALLOWED_ORIGINS = saved;
    }
  });

  test("localhost dev origins are allow-listed, and their www siblings are not invented", () => {
    // Ports 3000/3001/3002 are `next dev` plus the two extra ports the Express
    // original's CORS allow-list named (`app.js:17-19`), so a second local dev
    // server does not trip the check. 3002 is the one that is easy to forget.
    for (const origin of [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:3002",
      "http://127.0.0.1:3000",
    ]) {
      assertAllowed("POST", { origin });
    }

    // Not allow-listed: `apexAndWww` returns nothing for a `localhost` origin,
    // so the list does not fill up with nonsense entries.
    assertDenied("POST", { origin: "http://localhost:3003" });
    assertDenied("POST", { origin: "http://127.0.0.1:3001" });
  });
});
