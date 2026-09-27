// =============================================================================
// `defineRoute(method, config)` — the POSITIONAL method, what it does and does
// not catch, and the `HEAD`-on-`GET` exception's dependency on the framework.
//
// This is a SIBLING of `test/handler.test.js`, not a replacement for it. That
// file owns the per-request method assertion; this one owns the three questions
// the assertion alone cannot answer:
//
//   1. IS THE SIGNATURE ACTUALLY POSITIONAL? A mechanical migration of 53 route
//      files is only safe if a half-migrated one FAILS LOUDLY. If the old
//      `defineRoute({ method, ... })` form were still accepted, a route file
//      left behind would keep working, the migration would look finished, and
//      nothing would be wrong today — the divergence would surface later, from a
//      file nobody remembers touching.
//
//   2. WHAT DOES A MISMATCHED METHOD ACTUALLY CATCH? The honest answer is
//      "less than the old docblock implied", and a test that only asserted the
//      good cases would keep that misconception alive. Both directions are
//      pinned here, and so is the case NOTHING catches.
//
//   3. WHY IS `HEAD` SPECIAL? Because Next derives it from `GET`. That is a
//      property of the framework, not of this codebase, so it is asserted
//      against Next's own source. A Next upgrade that removed the derivation
//      would otherwise turn every GET endpoint into a 500 on a HEAD probe, and
//      the failure would look like an application bug.
//
// ENVIRONMENT. Identical to `test/handler.test.js`: the four required
// environment variables are set before the dynamic `import()` because
// `defineRoute` composes through `apiRoute`, which needs them. With the values
// set and no auth cookie present, `verifyToken` returns null and a dispatched
// route answers 401 without touching MongoDB — which is the "the request was
// actually dispatched" signal these tests need.
//
// LOADING. The `@/` alias, the `server-only` stub and the extensionless
// `next/headers` subpath are all handled by `test/loader.mjs`, which `npm test`
// loads via `--import`.
// =============================================================================

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

process.env.ACCESS_TOKEN_SECRET = 'test-only-access-secret-not-a-real-secret';
process.env.REFRESH_TOKEN_SECRET = 'test-only-refresh-secret-not-a-real-secret';
process.env.PASSWORD_TOKEN_SECRET = 'test-only-password-token-not-a-real-secret';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/cpccu-test-not-a-real-cluster';

const { defineRoute } = await import('@/lib/server/handler');

/** A controller that does nothing. The method assertion fires before it runs. */
const noopController = async () => {};

/**
 * A minimal `Request`-alike. Only `method` and `headers` are read before the
 * request reaches `apiRoute`; a real `Request` is avoided so these tests never
 * depend on a body stream or on `next/headers` cookies resolving.
 */
function fakeRequest(method, headers = {}) {
  return { method, headers: new Headers(headers), url: 'http://localhost/api/v1/test' };
}

describe('the method is the FIRST POSITIONAL ARGUMENT', () => {
  test('the positional form is the accepted one', () => {
    for (const method of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']) {
      assert.equal(
        typeof defineRoute(method, { controller: noopController }),
        'function',
        `${method} must be declarable as defineRoute('${method}', { … })`,
      );
    }
  });

  test('the OLD object form is REFUSED, and the message names the new signature', () => {
    // This is the assertion that makes the 53-file migration safe. Passing the
    // old shape puts an OBJECT where the method belongs and nothing where the
    // config belongs, so it is rejected at MODULE LOAD — i.e. during
    // `next build`. Without this, a route file that still said
    // `defineRoute({ method: 'GET', … })` would keep serving, the migration would
    // look finished, and the two signatures would coexist indefinitely.
    //
    // The message is asserted as well as the throw: the author of a half-migrated
    // route file sees this text in the build output, so it has to name the old
    // shape they wrote AND the call they should write instead.
    for (const oldShape of [
      { controller: noopController, method: 'GET' },
      { controller: noopController, method: 'POST', public: true },
    ]) {
      assert.throws(
        () => defineRoute(oldShape),
        (error) => {
          assert.ok(error instanceof TypeError);
          assert.match(error.message, /`method` is now the FIRST POSITIONAL ARGUMENT/);
          assert.match(error.message, /OLD `defineRoute\(\{ method: '…', … \}\)` signature/);
          assert.match(error.message, /defineRoute\('GET', \{ … \}\)/);
          return true;
        },
        `${JSON.stringify(Object.keys(oldShape))} must be refused`,
      );
    }
  });

  test('a missing config object is refused with a message that names the fix', () => {
    // Left to the destructuring pattern this would be
    // `TypeError: Cannot destructure property 'controller' of 'undefined'`, which
    // points at `defineRoute`'s internals and says nothing about the caller's
    // half-finished edit.
    for (const config of [undefined, null, 'GET', 42]) {
      assert.throws(
        () => defineRoute('GET', config),
        /the second argument must be a config object/,
        `${String(config)} must be refused`,
      );
    }
  });
});

describe('a handler pasted with a MISMATCHED method — what is and is not caught', () => {
  test('a GET handler bound to a POST export is caught on the first POST request', () => {
    // `export const POST = defineRoute('GET', { controller: getProject })`. The
    // declared method is `GET`; a caller hitting the `POST` export arrives with
    // `POST`; the assertion compares those two and fires. The message names both,
    // so the thrown 500 says which of the two is wrong rather than only that
    // something is.
    const pasted = defineRoute('GET', { controller: noopController });

    assert.throws(
      () => pasted(fakeRequest('POST'), { params: {} }),
      (error) => {
        assert.ok(error instanceof TypeError);
        assert.match(error.message, /this route declares `method: 'GET'`/);
        assert.match(error.message, /was invoked with POST/);
        // The message names the export name as the thing that registers the
        // route, because that is the counter-intuitive half of the failure.
        assert.match(error.message, /EXPORT NAME decides the method/);
        return true;
      },
    );
  });

  test('the assertion CANNOT catch a RIGHT-METHOD / WRONG-CONTROLLER paste, and that is why the declaration is checked statically below', () => {
    // `export const GET = defineRoute('GET', { controller: listAdminProjects })`
    // pasted into `admin/certificates/route.js`. Declared `GET`, registered
    // `GET`, invoked `GET` — every comparison the assertion can make agrees, and
    // the endpoint happily serves the wrong collection. The positional argument
    // does not catch this either, and pretending otherwise would be a lie in the
    // docblock. What it DOES do is put the method on the same line as the export
    // name and the controller, so the wrong controller is right there in the
    // diff — and the static check in the next block makes that machine-enforced
    // for the method half.
    const wrongController = defineRoute('GET', { controller: noopController });

    // Dispatched, not rejected: the assertion is silent by construction here.
    const response = wrongController(fakeRequest('GET'), { params: {} });
    assert.ok(
      response instanceof Promise,
      'the request must be dispatched — that silence is the documented failure mode',
    );
    return response.then(async (result) => {
      assert.ok(result instanceof Response);
      assert.equal(
        result.status,
        401,
        '401 (reached authentication) proves the request was dispatched and not refused',
      );
    });
  });
});

describe('every real route file declares a method that MATCHES its export name', () => {
  /**
   * Recursively collects every `route.js` under `src/app`.
   *
   * `node_modules` is excluded even though nothing under `src/app` can contain
   * one, so this keeps working if the walk is ever pointed elsewhere.
   */
  function routeFiles(dir = 'src/app') {
    const found = [];

    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);

      if (entry.isDirectory()) found.push(...routeFiles(full));
      else if (entry.name === 'route.js') found.push(full);
    }

    return found.sort();
  }

  /**
   * Extracts `{ exportName, declaredMethod }` for every `defineRoute` call.
   *
   * The method is matched ONLY in the argument position — `defineRoute('GET', {`
   * — and never as a `method:` property, because accepting the property form here
   * would make this test pass on a file that has silently reverted to the old
   * signature. An unrecognised call shape therefore shows up as
   * `declaredMethod === null` and fails loudly instead of being skipped.
   */
  function declarations(source) {
    const found = [];
    let lastExport = null;

    for (const line of source.split('\n')) {
      const exportMatch = line.match(/^export const ([A-Z_]+) =/);
      if (exportMatch) lastExport = exportMatch[1];

      if (!line.includes('defineRoute(')) continue;

      const call = line.match(/defineRoute\('([A-Z]+)',\s*\{\s*$/);
      found.push({ exportName: lastExport, declaredMethod: call ? call[1] : null });
    }

    return found;
  }

  test('no route file declares a method that disagrees with its export name', () => {
    const files = routeFiles();
    const problems = [];
    let declarationsChecked = 0;

    for (const file of files) {
      for (const { exportName, declaredMethod } of declarations(readFileSync(file, 'utf8'))) {
        declarationsChecked += 1;

        if (declaredMethod === null) {
          problems.push(`${file}: \`defineRoute(\` is not in the positional form \`defineRoute('GET', {\``);
        } else if (exportName !== declaredMethod) {
          problems.push(`${file}: \`export const ${exportName}\` declares \`${declaredMethod}\``);
        }
      }
    }

    assert.deepEqual(problems, [], 'every route file must agree with its own export name');
    // GUARD AGAINST THE TEST SILENTLY CHECKING NOTHING. Without this, a future
    // edit that made `declarations()` stop matching would turn the whole block
    // into a vacuous pass — the exact class of silent failure this test exists to
    // catch. 64 `defineRoute` calls live in the 52 API route files; the 53rd
    // (`src/app/api/v1/route.js`, the health probe) calls `apiRoute` directly.
    assert.ok(declarationsChecked > 60, `only ${declarationsChecked} declarations were checked`);
  });

  test('the health probe is the only route that does NOT use `defineRoute`', () => {
    // It is a documented, deliberate exception: its body is a raw `text/html`
    // string, which `createShim`'s `collect.result()` cannot produce. If a second
    // route ever bypasses `defineRoute`, it bypasses the `await getDb()` in
    // `runController` too, and that is worth knowing.
    const withoutDefineRoute = routeFiles().filter(
      (file) => !readFileSync(file, 'utf8').includes('defineRoute('),
    );

    assert.deepEqual(withoutDefineRoute, ['src/app/api/v1/route.js']);
  });
});

describe('the HEAD-on-GET exception rests on Next deriving HEAD from GET', () => {
  test('Next still assigns the GET handler to HEAD when HEAD is not implemented', () => {
    // `defineRoute`'s method assertion grants `HEAD` on a `GET` route. If that
    // exception were removed without this, every GET endpoint in the app would
    // 500 on a HEAD probe — and the failure would surface as an application
    // bug, because nothing in THIS repository decides it.
    //
    // The file is the framework's own, so the assertion is against the shipped
    // source rather than against a docblock. `methods.HEAD = handlers.GET` is
    // what makes the request arrive with `method: 'HEAD'` while running the GET
    // handler — the two facts the exception depends on.
    const source = readFileSync(
      'node_modules/next/dist/server/route-modules/app-route/helpers/auto-implement-methods.js',
      'utf8',
    );

    assert.match(source, /methods\.HEAD = handlers\.GET;/);
    assert.match(
      source,
      /if \(handlers\.GET\) \{/,
      'the derivation must still be conditional on a userland GET existing',
    );
  });

  test('a GET route really does answer a HEAD request, and a HEAD route does not answer GET', async () => {
    // The behavioural half. `HEAD` is in `SAFE_METHODS` (`request.js`), so it is
    // CSRF-exempt and reaches authentication, where the absence of an auth cookie
    // in this process answers 401. A 401 is the concrete evidence that the
    // request went all the way through the pipeline rather than being turned away
    // by the method assertion.
    const getRoute = defineRoute('GET', { controller: noopController });
    const headResponse = await getRoute(fakeRequest('HEAD'), { params: {} });

    assert.equal(headResponse.status, 401);

    // And the exception stays NARROW: it is `declared GET` + `arriving HEAD`, and
    // nothing else. A route DECLARED as `HEAD` is not granted the converse,
    // because a declared `HEAD` export has no auto-derived `GET`.
    const headRoute = defineRoute('HEAD', { controller: noopController });

    assert.throws(
      () => headRoute(fakeRequest('GET'), { params: {} }),
      /this route declares `method: 'HEAD'` but was invoked with GET/,
    );
  });
});
