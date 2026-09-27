// =============================================================================
// `handler.js` — `defineRoute`'s method assertion.
//
// WHY THIS TEST EXISTS. The method assertion is the ONLY guard against the
// export-name / declared-method mismatch, and that mismatch is a silent failure
// mode in BOTH directions:
//
//   - Copy-pasting a `GET` handler into a `route.js` whose export is `POST`
//     produces a route that compiles, builds, and returns a clean 405 for the
//     only request anyone makes — no clue anywhere as to why, and it looks
//     exactly like a client bug.
//   - Worse: a handler copied into the WRONG FILE still executes happily over
//     the WRONG method.
//
// The assertion converts both into a thrown `TypeError` on the very first
// request, shaped into a 500 by `toErrorResponse`, with a message naming both the
// declared method and the request's own.
//
// WHY THE ASSERTION CANNOT RUN AT MODULE LOAD. `method` is the method the author
// DECLARED; the method the route is REGISTERED under is the export NAME
// (`export const POST = …`). An ES module cannot enumerate its own exports, so
// the two cannot be compared while the module is being evaluated. What CAN be
// compared is the declared method against the method of the request that
// actually arrives — which is the check below.
//
// THE METHOD IS THE FIRST POSITIONAL ARGUMENT, `defineRoute(method, config)`, and
// that placement is itself part of the guard. It used to be a `method` property on
// the config object, two lines below the export name. A copy-paste that carried a
// `GET` handler into a file whose export is `POST` then produced a route that
// registered as `POST`, ran a `GET` controller, and PASSED the per-request
// assertion below — because the assertion compared the DECLARED method against
// the arriving request, and a caller hitting the `POST` export arrives with
// `POST`. The declared `'GET'` and the observed `'POST'` were never compared.
// Positional, the mismatch is `export const POST = defineRoute('GET', { … })`: a
// contradiction on ONE line, visible in review.
//
// THE `HEAD`-ON-`GET` EXCEPTION IS REQUIRED, NOT DEFENSIVE. Next auto-derives a
// `HEAD` handler from every `GET` route and invokes it with `method: 'HEAD'`
// (`auto-implement-methods.js` in
// `next/dist/server/route-modules/app-route/`), so a strict equality test would
// 500 EVERY single GET endpoint in the app on a HEAD probe. `HEAD` is a safe
// method with no body and the same authorisation as `GET` (see `SAFE_METHODS` in
// `request.js`), so treating it as `GET` is faithful rather than a loosening.
// The test below asserts the request is actually DISPATCHED, not merely that
// nothing was thrown synchronously — the first would pass even if the request
// were then rejected for an unrelated reason.
//
// ENVIRONMENT. `defineRoute` composes through `apiRoute`, which needs the four
// required environment variables. They are set to throwaway values HERE, before
// the module is imported, so the test is hermetic: it behaves the same on a
// developer laptop with a populated `.env`, in CI, and in a container. With the
// values set and no auth cookie present, `verifyToken` returns null and the route
// answers 401 without ever touching MongoDB — which is exactly the "the request
// was dispatched" signal these tests need.
//
// LOADING. Imported through the `@/` alias, with `server-only` stubbed and the
// extensionless `next/headers` subpath resolved — all handled in
// `test/loader.mjs`, which `npm test` loads via `--import`.
// =============================================================================

import { test, describe } from "node:test";
import assert from "node:assert/strict";

// MUST run before the dynamic `import()` of the module under test: `auth.js`
// reads these lazily on FIRST USE rather than at module load (deliberately — a
// top-level throw would fail `next build` for every route), so setting them at
// the top of the file is sufficient and a static import would work too. A
// dynamic import is used here anyway so the ordering is explicit and cannot be
// broken by someone hoisting an import statement.
process.env.ACCESS_TOKEN_SECRET = "test-only-access-secret-not-a-real-secret";
process.env.REFRESH_TOKEN_SECRET = "test-only-refresh-secret-not-a-real-secret";
process.env.PASSWORD_TOKEN_SECRET =
  "test-only-password-secret-not-a-real-secret";
process.env.MONGODB_URI =
  "mongodb://127.0.0.1:27017/cpccu-test-not-a-real-cluster";

const { defineRoute } = await import("@/lib/server/handler");

/** A controller that does nothing. The assertion fires before it is ever called. */
const noopController = async () => {};

/**
 * The methods the App Router accepts as a `route.js` export, and therefore the
 * only values `defineRoute` will accept. A lowercase `'post'` or a typo like
 * `'DELTE'` is a configuration mistake that would otherwise be invisible, because
 * the method is not what registers the route (the EXPORT NAME is) and so a wrong
 * value produces no framework error at all.
 */
const APP_ROUTER_METHODS = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
];

/**
 * A minimal `Request`-alike. `routeHandler` reads exactly two things off it —
 * `method` and, for the `rejectMultipart` case, `content-type` — and then hands
 * the whole object to `apiRoute`, which reads `headers`, cookies and the body.
 * A real `Request` is not used because these tests must not depend on a body
 * stream or on `next/headers` cookies actually resolving.
 */
function fakeRequest(method, headers = {}) {
  return {
    method,
    headers: new Headers(headers),
    url: "http://localhost/api/v1/test",
  };
}

/**
 * Asserts a route is DISPATCHED rather than rejected by the method assertion.
 *
 * The property under test is precisely "the method assertion did not fire", so
 * that is what is asserted: a real `Response` came back, it is not a 500, and its
 * body does not contain the assertion's message.
 *
 * The exact status is deliberately NOT pinned, because it legitimately depends on
 * the method and on the order of the security layers in `apiRoute`:
 *   - `GET` / `HEAD` / `OPTIONS` are CSRF-exempt, so they reach authentication
 *     and answer 401 (no auth cookie is present in this test process);
 *   - an unsafe method hits the CSRF origin check FIRST, and with no
 *     `Sec-Fetch-Site`, no `Origin` and no bearer token that check answers 403
 *     before authentication is attempted.
 * Both are correct outcomes of "the request was dispatched". Had the assertion
 * fired instead, the result would be a 500 carrying the assertion's message —
 * which is the one outcome that is a failure.
 *
 * @param {Function} routeHandler
 * @param {string} method
 * @returns {Promise<Response>}
 */
async function assertDispatched(routeHandler, method) {
  const response = await routeHandler(fakeRequest(method), { params: {} });

  assert.ok(
    response instanceof Response,
    "the route must return a real Response",
  );
  const body = await response.text();

  assert.notEqual(
    response.status,
    500,
    `${method} must be dispatched, not 500'd by the method assertion`,
  );
  assert.equal(
    body.includes("this route declares `method:"),
    false,
    `${method} must be dispatched, not rejected by the method assertion. Body was: ${body.slice(0, 200)}`,
  );
  return response;
}

describe("defineRoute — configuration errors are raised at MODULE LOAD", () => {
  // Every one of these throws while the route module is being evaluated, i.e.
  // during `next build`. A configuration mistake caught here costs nothing; the
  // same mistake caught on a live request costs an incident.
  test("a non-function `controller` is refused", () => {
    for (const controller of [undefined, null, "handler", 42, {}]) {
      assert.throws(
        () => defineRoute("GET", { controller }),
        (error) => {
          assert.ok(error instanceof TypeError);
          assert.match(
            error.message,
            /`controller` must be the ported \(req, res\) handler/,
          );
          return true;
        },
      );
    }
  });

  test("a method outside the App Router set is refused, and the message lists the valid ones", () => {
    for (const method of [
      "post",
      "delte",
      "Get",
      "FETCH",
      "",
      "get ",
      undefined,
      null,
      42,
    ]) {
      assert.throws(
        () => defineRoute(method, { controller: noopController }),
        (error) => {
          assert.ok(error instanceof TypeError);
          assert.match(
            error.message,
            /`method` must be one of GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS/,
          );
          return true;
        },
        `${JSON.stringify(method)} must be refused`,
      );
    }
  });

  test("every valid method is accepted at declaration time", () => {
    // The complement of the test above: the guard must not be so strict that a
    // legitimate route cannot be declared.
    for (const method of APP_ROUTER_METHODS) {
      assert.doesNotThrow(
        () => defineRoute(method, { controller: noopController }),
        `${method} must be accepted`,
      );
    }
  });

  test("an empty or non-string `fileField` is refused, but a valid one is accepted", () => {
    // `fileField` reproduces multer's field FILTER: `upload.single('image')` and
    // `upload.array('media', 20)` both filter to their named field, so a route
    // that mounts either one passes this. Omitting it collects every file part,
    // which is correct only for a single-file consumer.
    assert.throws(
      () =>
        defineRoute("POST", {
          controller: noopController,
          fileField: "",
        }),
      /`fileField` must be a non-empty multipart field name/,
    );
    assert.throws(
      () =>
        defineRoute("POST", {
          controller: noopController,
          fileField: 42,
        }),
      /`fileField` must be a non-empty multipart field name/,
    );
    assert.doesNotThrow(() =>
      defineRoute("POST", {
        controller: noopController,
        fileField: "image",
      }),
    );
  });

  test("a non-positive or non-integer `maxFiles` is refused", () => {
    // `maxFiles` cannot be ENFORCED — `createShim` accepts exactly
    // `{ params, fileField }` and has no file-count ceiling — so the option is
    // documentary. A negative or fractional value is nonetheless a mistake
    // rather than a number nobody uses yet, and it fails at module load.
    for (const maxFiles of [0, -1, 1.5, Number.NaN, "20"]) {
      assert.throws(
        () =>
          defineRoute("POST", {
            controller: noopController,
            maxFiles,
          }),
        /`maxFiles` must be a positive integer when present/,
        `${JSON.stringify(maxFiles)} must be refused`,
      );
    }
  });
});

describe("defineRoute — the method assertion on the request that actually arrives", () => {
  test("a matching method is dispatched", async () => {
    for (const method of APP_ROUTER_METHODS) {
      const routeHandler = defineRoute(method, { controller: noopController });
      await assertDispatched(routeHandler, method);
    }
  });

  test("a MISMATCHED method throws synchronously and names both methods", () => {
    // The export-name / declared-method mismatch. Note it is thrown
    // SYNCHRONOUSLY, before the request enters `apiRoute` at all — which is what
    // makes it distinguishable from every other failure the route can produce.
    const getRoute = defineRoute("GET", { controller: noopController });

    for (const method of ["POST", "PUT", "PATCH", "DELETE", "OPTIONS"]) {
      assert.throws(
        () => getRoute(fakeRequest(method), { params: {} }),
        (error) => {
          assert.ok(
            error instanceof TypeError,
            "the assertion must be a TypeError",
          );
          assert.match(error.message, /this route declares `method: 'GET'`/);
          assert.match(
            error.message,
            new RegExp(`was invoked with ${method}\\b`),
          );
          // The message names the EXPORT NAME as the thing that registers the
          // route, because that is the counter-intuitive part.
          assert.match(error.message, /EXPORT NAME decides the method/);
          return true;
        },
        `GET route invoked with ${method} must throw`,
      );
    }
  });

  test("a POST route invoked with GET throws too — the assertion is symmetric", () => {
    // The other half of the mismatch: a handler pasted into the WRONG FILE. It
    // must be caught in both directions, otherwise the "declared GET, invoked
    // POST" half alone would leave this hole open.
    const postRoute = defineRoute("POST", {
      controller: noopController,
    });

    for (const method of ["GET", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]) {
      assert.throws(
        () => postRoute(fakeRequest(method), { params: {} }),
        /this route declares `method: 'POST'`/,
        `POST route invoked with ${method} must throw`,
      );
    }
  });

  test("a lower-case request method is compared case-SENSITIVELY against the upper-case declaration", () => {
    // The declaration is validated to be upper-case; the incoming method is
    // whatever the runtime gives us, and a real `Request` always normalises it
    // to upper case. A hand-built `Request`-alike with a lower-case method is
    // therefore something no real caller can produce, and treating it as a match
    // would weaken the assertion. Pinned so the comparison is not "helpfully"
    // case-folded later.
    const getRoute = defineRoute("GET", { controller: noopController });
    assert.throws(
      () => getRoute(fakeRequest("get"), { params: {} }),
      /was invoked with get/,
    );
  });
});

describe("defineRoute — HEAD on a GET route is REQUIRED, not defensive", () => {
  test("a GET route is dispatched for a HEAD request", async () => {
    // Next auto-derives a `HEAD` handler from every `GET` route and invokes it
    // with `method: 'HEAD'`. A strict equality test would 500 every single GET
    // endpoint in the app. The request is asserted to be genuinely DISPATCHED —
    // it comes back as a real `Response`, not a 500 — rather than merely "not
    // throwing synchronously", which would also pass if the request were then
    // rejected for some unrelated reason.
    const getRoute = defineRoute("GET", { controller: noopController });
    const response = await assertDispatched(getRoute, "HEAD");
    // `HEAD` is CSRF-exempt, so it reaches authentication and — with no auth
    // cookie present in this process — answers 401. That is the concrete
    // end-to-end evidence that a real request went all the way through the
    // pipeline.
    assert.equal(response.status, 401);
  });

  test("a HEAD route is dispatched for a HEAD request, and refuses GET", async () => {
    // The exception is narrow: it is `method === 'GET' && request.method ===
    // 'HEAD'` and nothing else. A route DECLARED as `HEAD` is not granted the
    // converse, because the two are not symmetric in Next — a declared `HEAD`
    // export has no auto-derived `GET`.
    const headRoute = defineRoute("HEAD", {
      controller: noopController,
    });
    await assertDispatched(headRoute, "HEAD");
    assert.throws(
      () => headRoute(fakeRequest("GET"), { params: {} }),
      /was invoked with GET/,
    );
  });

  test("HEAD is NOT granted to any non-GET route", async () => {
    // If the exception were written as `['GET', 'HEAD'].includes(request.method)`
    // on the REQUEST side, every route would answer a HEAD request — including
    // `POST /login` and `POST /auth/register`, whose bodies are what make them
    // state-changing. A HEAD request has no body, so those routes would see an
    // empty payload and fail confusingly instead of being refused.
    for (const method of ["POST", "PUT", "PATCH", "DELETE", "OPTIONS"]) {
      const routeHandler = defineRoute(method, { controller: noopController });
      assert.throws(
        () => routeHandler(fakeRequest("HEAD"), { params: {} }),
        new RegExp(
          `this route declares \`method: '${method}'\` but was invoked with HEAD`,
        ),
        `${method} must refuse a HEAD request`,
      );
    }
  });
});
