// =============================================================================
// CLIENT/BACKEND ENDPOINT PARITY — every URL the frontend declares must be a
// real `route.js` under `src/app/api/`, answering the method the client uses.
//
// WHY THIS FILE EXISTS, and why it is the highest-value guard in the suite.
// The backend was migrated from the separate Express app (`cpccu-server`) into
// 53 route handlers inside THIS repository, and the frontend was then repointed
// at them. Between those two events the client and the server were, by
// construction, able to disagree: the client is a pile of string literals spread
// across nine `src/features` API files, and the server is a directory
// tree. Nothing in either language connects them. A route that is renamed,
// re-parented, or has its method changed on the server leaves the client
// compiling perfectly, building perfectly, and failing at runtime — a 404 that
// no type checker, linter or build step in this repository can see. That is
// exactly the class of regression the migration was most exposed to, and it is
// silent in both directions: a stale client URL and a stale server route are
// indistinguishable from "working" until a user clicks.
//
// SO THIS IS A STATIC CROSS-REFERENCE, not an integration test. It reads both
// sides off disk and joins them. Nothing is imported, no server is started, no
// database is touched — which is deliberate, because an integration test would
// only catch a break at the moment it ran, in whatever environment it ran in.
//
// WHAT IS EXTRACTED, AND WHY IT IS A TEXT SCAN RATHER THAN AN AST WALK.
// The declarations are plain object literals and arrow functions in `.js` files.
// A brace-matched scan of each `builder.query({…})` / `builder.mutation({…})` /
// `build.query({…})` block is enough, and it has one property a real parser
// would not give us for free: a FAILURE MESSAGE THAT POINTS AT A LINE NUMBER.
// "…/projects/:id has no route.js" is actionable; "RTK Query endpoint 31 of 40
// is unsatisfiable" is not.
//
//   - `url: '…'` / `url: \`…\`` inside the block, with `method:` read from the
//     SAME block. Both quote styles are accepted because `adminApi.js` and
//     `userApi.js` use double quotes while `authApi.js` uses single ones, and a
//     single-quote-only regex would have silently defaulted every double-quoted
//     mutation to POST and passed — the exact false-negative this file is for.
//   - `query: (…) => '…'` and the block-bodied `query: (…) => { return '…'; }`
//     form, which carry no `url:` key at all. RTK Query defaults a bare `query`
//     to GET, so that is what they are asserted as.
//   - Template-literal `${…}` holes become the wildcard `*`. Brace depth is
//     tracked, so a nested `{` inside the expression cannot desynchronise the
//     scan. NOTE: this repo no longer HAS a template-literal endpoint URL — the
//     one that did (`` `/auth/reset-link/${encodeURIComponent(email)}` ``) was
//     migrated to a `POST` with the address in the body, precisely because a
//     path-segment address is what made the endpoint reachable from a bare
//     cross-site `<img src>`. The handling is kept because a client URL built
//     from a runtime value is a perfectly ordinary thing to add back, and this
//     file should not be the thing that silently mis-parses when it is.
//
// EXTERNAL URLS ARE OUT OF SCOPE, and the exclusion is by SHAPE not by name:
// anything carrying a scheme (`https://www.facebook.com/groups/cpccu` in
// `src/lib/server/email/welcomeEmail.js`) is not an API path and is filtered
// out before any assertion. Filtering on a list of known hosts instead would
// mean the list has to be maintained, and the day somebody adds a genuinely
// wrong external URL is the day the guard is not there.
//
// THE SKIP LIST IS A CONSTANT IN THIS FILE, NOT A `continue` IN THE LOOP, so
// that every exception is visible at the top of the file with a stated reason
// rather than being discovered by reading the matcher. A test
// (`every skip-list entry still names a real route`) fails if an entry outlives
// the route it was written for, so the list cannot rot into a blanket amnesty.
//
// NO ASSERTION HERE MAY BE DELETED TO MAKE A FAILURE GO AWAY. If a URL genuinely
// has no route, the fix is to add the route, repoint the client, or — if the
// endpoint is deliberately not client-facing — add a reasoned entry to
// `SKIPPED_NOT_CLIENT_FACING` above. Removing the check is not one of those.
//
// LOADING. Pure `node:fs`; no `@/` import and no `server-only`, so unlike its
// siblings this file needs nothing from `test/loader.mjs` beyond the
// `--import` that `npm test` already applies for them.
// =============================================================================

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from './loader.mjs';

/**
 * The base path every client URL is resolved against.
 *
 * This is duplicated from `src/services/baseApi.js` on purpose rather than
 * imported: `baseApi.js` imports `@reduxjs/toolkit/query/react`, which pulls
 * React and a DOM-less render environment into a `node --test` process for no
 * reason. The duplication is SAFE, and is not silently allowed to drift —
 * `the base path in baseApi.js is this exact literal` below asserts the two
 * agree, so changing one without the other is a failing test rather than a
 * runtime surprise.
 */
const BASE_PATH = '/api/v1';

/**
 * The two origins the retired Express backend was reachable at, in the forms
 * they appeared in this repository. Asserted absent from EVERY file under
 * `src/`, not just from the files this file scans, because the whole point is
 * that a stale origin must not survive in a comment, a config default, or a
 * module nothing imports any more.
 *
 * `cpccu-server.onrender.com` is the deployed instance of the old backend; it is
 * the string most likely to be pasted back in by someone "just fixing the
 * login" against a stale doc. `localhost:5000` is the local Express port and is
 * what the removed `process.env.NEXT_PUBLIC_API_BASE_URL || '…'` defaults all
 * fell through to.
 */
const RETIRED_ORIGINS = ['localhost:5000', 'cpccu-server.onrender.com'];

/**
 * Routes that exist, are real, and are deliberately NOT checked against the
 * client — each with the reason, stated here so the list cannot grow silently.
 *
 * KEEP THIS LIST EMPTY UNLESS THE REASON IS "this endpoint is not for the
 * browser". A route that no client calls needs no entry: absence of a client
 * URL is not a parity failure, it is just an unused endpoint (the admin panel
 * reaching `/admin/content/*` instead of `/posts/*` is exactly that case, and
 * both routes are migrated and working).
 */
const SKIPPED_NOT_CLIENT_FACING = [
  {
    path: '/api/v1',
    method: 'GET',
    reason:
      'Health probe. It is the deployment/uptime surface, reached by the host ' +
      'platform rather than by a browser bundle, and it cannot be a client ' +
      'target in any case: `GET /api/v1` is the API ROOT, so a client URL of ' +
      'the empty path would collide with the base path itself.',
  },
];

/** Recursively list every file under `dir` whose name ends with `suffix`. */
function walk(dir, suffix, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, suffix, out);
    } else if (entry.name.endsWith(suffix)) {
      out.push(full);
    }
  }
  return out;
}

/**
 * The slice of the source tree whose client-facing URLs are checked.
 *
 * `src/features/**` is where every RTK Query endpoint is declared — all nine
 * `…Api.js` files live there. `src/lib/**` is included because it is the other
 * place a URL can be written (and is where the four that were already migrated
 * to a direct service call used to be), so excluding it would leave a blind
 * spot in exactly the directory that had one. `src/app/api/**` is deliberately
 * NOT scanned: those files declare the SERVER side, and joining the two would
 * make every endpoint self-satisfying and assert nothing.
 */
function clientSourceFiles() {
  return [
    ...walk(path.join(REPO_ROOT, 'src/features'), '.js'),
    ...walk(path.join(REPO_ROOT, 'src/lib'), '.js'),
  ].sort();
}

/** True when a string literal is an absolute URL with a scheme (or protocol-relative). */
function isExternalUrl(value) {
  return /^[a-z][a-z0-9+.-]*:/i.test(value) || value.startsWith('//');
}

/**
 * Replace every `${…}` hole in a template literal with `*`, tracking brace
 * depth so an expression containing an object literal or a nested template does
 * not truncate the wildcard early.
 *
 * The result is a ROUTE PATTERN, not a URL: `/admin/members/*` is how
 * `src/app/api/v1/admin/members/[id]/route.js` is addressed below. Using `*`
 * rather than the Next `[param]` syntax keeps this file independent of App
 * Router conventions — it only has to know that "some segment goes here".
 */
function templateToPattern(body) {
  let out = '';
  for (let i = 0; i < body.length; i += 1) {
    if (body[i] === '$' && body[i + 1] === '{') {
      let depth = 1;
      let j = i + 2;
      while (j < body.length && depth > 0) {
        if (body[j] === '{') depth += 1;
        else if (body[j] === '}') depth -= 1;
        if (depth > 0) j += 1;
      }
      out += '*';
      i = j;
      continue;
    }
    out += body[i];
  }
  return out;
}

/** Unwrap a single- or double-quoted JS string literal into its raw contents. */
function unquote(literal) {
  const inner = literal.slice(1, -1);
  // Only the escapes that can appear inside a PATH matter here; anything else is
  // left alone rather than half-decoded.
  return inner.replace(/\\(['"`\\/])/g, '$1');
}

/**
 * Return the source of the `{…}` block whose `{` is at `openIndex`, or `null`
 * if the file ends first.
 *
 * Brace counting is done over the raw text, which is sound for the files this
 * scans because every one of them is a plain endpoint declaration. It is NOT a
 * general JS parser and must not be treated as one: a `{` or `}` inside a
 * string, a comment or a regex literal in one of these files would unbalance
 * it. That risk is bounded rather than eliminated — the extraction count is
 * asserted (see `the extractor still finds the endpoints it is supposed to`),
 * so an unbalanced scan shows up as a FAILURE, not as a quietly shorter list.
 */
function blockAt(source, openIndex) {
  let depth = 0;
  for (let i = openIndex; i < source.length; i += 1) {
    if (source[i] === '{') depth += 1;
    else if (source[i] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(openIndex, i + 1);
    }
  }
  return null;
}

const STRING_LITERAL = "(?:`(?:[^`\\\\]|\\\\.)*`|'(?:[^'\\\\]|\\\\.)*'|\"(?:[^\"\\\\]|\\\\.)*\")";

/**
 * Extract every client request the feature/lib tree declares.
 *
 * Each entry is `{ file, line, method, path }` with `path` already
 * template-resolved to a `*`-wildcard pattern and already joined to
 * `BASE_PATH`. Entries whose URL is external are dropped here, by shape.
 */
function extractClientRequests() {
  const found = [];

  for (const file of clientSourceFiles()) {
    const source = readFileSync(file, 'utf8');
    const relative = path.relative(REPO_ROOT, file);
    const blockPattern = /(?:builder|build)\.(query|mutation)\(\{/g;
    let match;

    while ((match = blockPattern.exec(source)) !== null) {
      const kind = match[1];
      const line = source.slice(0, match.index).split('\n').length;
      const block = blockAt(source, match.index + match[0].length - 1);
      if (block === null) continue;

      // `url:` wins when present; otherwise fall back to the arrow's expression
      // body, then to a `return` inside a block-bodied `query:`. The order
      // matters only in that a `url:` in the same block is the more explicit
      // declaration of the two.
      const urlMatch = block.match(new RegExp(`\\burl:\\s*(${STRING_LITERAL})`));
      const arrowMatch = block.match(new RegExp(`=>\\s*(${STRING_LITERAL})`));
      const returnMatch = block.match(
        new RegExp(`=>\\s*\\{[\\s\\S]*?\\breturn\\s+(${STRING_LITERAL})`),
      );
      const literal = urlMatch?.[1] ?? arrowMatch?.[1] ?? returnMatch?.[1];
      if (literal === undefined) continue;

      // A backtick literal may contain `${…}` holes, which are resolved to the
      // `*` wildcard; a quoted literal cannot, and is taken as written.
      const raw = literalIsTemplate(literal)
        ? templateToPattern(unquote(literal))
        : unquote(literal);
      if (isExternalUrl(raw)) continue;

      // An explicit `method:` wins. A `query` defaults to GET and a `mutation`
      // to POST, which is what `fetchBaseQuery` does when the key is absent.
      const methodMatch = block.match(
        /\bmethod:\s*['"](GET|POST|PUT|PATCH|DELETE)['"]/,
      );
      const method = methodMatch
        ? methodMatch[1]
        : kind === 'query'
          ? 'GET'
          : 'POST';

      found.push({
        file: relative,
        line,
        method,
        path: joinToBase(raw),
      });
    }
  }

  return found;
}

/**
 * Resolve a declared URL against `BASE_PATH`, reproducing what RTK Query's
 * `joinUrls` does before handing the path to `fetch`.
 *
 * TWO BEHAVIOURS ARE COPIED ON PURPOSE, and BOTH MATTER:
 *
 *   1. A MISSING LEADING SLASH IS NORMALISED, NOT REJECTED. Five URLs in this
 *      tree are written without one — `users/userInfo-update`,
 *      `users/user/upload-image/${key}`, `users/job-pipeline-request` (twice) in
 *      `src/features/users/userApi.js`, and `users/member` in
 *      `src/features/members/memberApi.js`. `joinUrls` concatenates the base
 *      and the path with a slash-joining step, so those all reach
 *      `${BASE_PATH}/users/userInfo-update` and work today. THIS TEST
 *      DELIBERATELY DOES NOT "FIX" THEM: they are not broken, and rewriting
 *      five working URLs to satisfy a test would be churn that hides the real
 *      point of the file. Rejecting them here would produce a false failure on
 *      correct code, which is worse than no test at all.
 *   2. A QUERY STRING IS NOT PART OF THE ROUTE. `verifyCertificate` returns
 *      `` `/certificates/verify?${params.toString()}` ``, so the `?` and
 *      everything after it is dropped before the lookup — a `?` in a directory
 *      path would make every certificate query miss.
 */
function joinToBase(declared) {
  // The query string is not part of the route: `verifyCertificate` returns
  // `` `/certificates/verify?${params.toString()}` ``, and a `?` inside a
  // directory path would make every certificate query miss.
  const withoutQuery = declared.split('?')[0];
  // Trailing slashes are normalised away, as `joinUrls` does before the request
  // is made, so `/projects/` and `/projects` are one path.
  const trimmed = withoutQuery.replace(/\/+$/, '');
  return `${BASE_PATH}/${trimmed.replace(/^\/+/, '')}`;
}

/** True when the raw literal was written with backticks (i.e. it may hold `${}`). */
function literalIsTemplate(literal) {
  return literal.startsWith('`');
}

/**
 * The set of methods each route file under `src/app/api` exports, keyed by its
 * API path (`/api/v1/users/user`, `/api/v1/certificates/verify/[certificateId]`, …).
 *
 * Read off the `export const GET` / `export const POST` lines rather than off
 * the `defineRoute(...)` call, because the export name is what Next.js actually
 * binds to the HTTP verb. `test/route-method-declaration.test.js` separately
 * asserts that each file's `defineRoute` method agrees with its export name, so
 * the two cannot disagree without one of the two files failing.
 */
function exportedRouteMethods() {
  const routes = new Map();
  const routeFiles = walk(path.join(REPO_ROOT, 'src/app/api'), '.js').filter(
    (file) => path.basename(file) === 'route.js',
  );

  for (const file of routeFiles) {
    const source = readFileSync(file, 'utf8');
    const methods = [
      ...source.matchAll(
        /^export const (GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/gm,
      ),
    ].map((entry) => entry[1]);

    const apiPath =
      '/' +
      path
        .relative(path.join(REPO_ROOT, 'src/app'), file)
        .replace(/\\/g, '/')
        .replace(/\/route\.js$/, '');

    routes.set(apiPath, { methods, file: path.relative(REPO_ROOT, file) });
  }

  return routes;
}

/**
 * Split a `*`-wildcard pattern into segments, and return every route path whose
 * segments line up — a `*` matching exactly one dynamic `[param]` segment.
 *
 * A `*` deliberately does NOT match a literal segment, so a client calling
 * `/admin/members/42` is only satisfied by `…/admin/members/[id]` and never by
 * `…/admin/members`. Getting that backwards would let a hard-coded collection
 * URL pass as a per-item one.
 */
function matchingRoutes(routes, pattern) {
  const wanted = pattern.replace(/^\/+|\/+$/g, '').split('/');
  const matches = [];

  for (const [apiPath, entry] of routes) {
    const actual = apiPath.replace(/^\/+/, '').split('/');
    if (actual.length !== wanted.length) continue;
    const ok = actual.every(
      (segment, index) =>
        wanted[index] === '*' ? segment.startsWith('[') : segment === wanted[index],
    );
    if (ok) matches.push({ apiPath, ...entry });
  }

  return matches;
}

/**
 * True when `method` is served by a route exporting it.
 *
 * The `HEAD`-on-`GET` exception is Next's, not this codebase's: when a route
 * exports only `GET`, Next also answers `HEAD` on it. The reverse is NOT true —
 * a route exporting only `HEAD` does not answer `GET` — so only that one
 * direction is honoured here. No client declaration uses `HEAD` today; this
 * exists so that adding one does not produce a confusing false failure.
 */
function routeAnswers(route, method) {
  return (
    route.methods.includes(method) ||
    (method === 'HEAD' && route.methods.includes('GET'))
  );
}

const clientRequests = extractClientRequests();
const routes = exportedRouteMethods();

describe('every client URL resolves to a real route.js with a matching method', () => {
  test('the extractor still finds the endpoints it is supposed to', () => {
    // A GUARD ON THE GUARD. The extraction is a text scan; if a refactor
    // renamed `builder.query`/`build.mutation` or moved the `url:` out of the
    // block, the scan would return [] and every other test in this file would
    // pass vacuously. This pins the count to a floor close to the real one, so
    // that failure mode is loud. The floor is deliberately below the actual
    // count (it is not exact) so that adding or removing a legitimate endpoint
    // does not need this number edited.
    assert.ok(
      clientRequests.length >= 40,
      `only ${clientRequests.length} client URLs were extracted; the extractor has stopped seeing the endpoints it is meant to check`,
    );
  });

  test('every declared client URL resolves to a route.js', () => {
    const unresolved = [];

    for (const request of clientRequests) {
      const matches = matchingRoutes(routes, request.path);
      if (matches.length === 0) {
        unresolved.push(
          `${request.file}:${request.line}  ${request.method} ${request.path}`,
        );
      }
    }

    assert.deepEqual(
      unresolved,
      [],
      `these client URLs have no route.js under src/app/api:\n${unresolved.join('\n')}`,
    );
  });

  test('every declared client URL is served with the method it declares', () => {
    const wrongMethod = [];

    for (const request of clientRequests) {
      const matches = matchingRoutes(routes, request.path);
      // A path with no route at all is the previous test's failure and is
      // reported there; repeating it here would produce two failures for one
      // break and bury the real one.
      if (matches.length === 0) continue;

      if (!matches.some((route) => routeAnswers(route, request.method))) {
        wrongMethod.push(
          `${request.file}:${request.line}  ${request.method} ${request.path}` +
            ` -> matched ${matches
              .map((route) => `${route.apiPath} [${route.methods.join(', ')}]`)
              .join(' | ')}`,
        );
      }
    }

    assert.deepEqual(
      wrongMethod,
      [],
      `these client URLs name a method their route does not export:\n${wrongMethod.join('\n')}`,
    );
  });

  test('the base path in baseApi.js is this exact literal', () => {
    // The one place `BASE_PATH` above is allowed to be duplicated. Without this
    // assertion the two copies could drift and every other test in this file
    // would still pass — while checking a base path nothing actually uses.
    const baseApi = readFileSync(
      path.join(REPO_ROOT, 'src/services/baseApi.js'),
      'utf8',
    );
    const declared = baseApi.match(/const baseUrl\s*=\s*'([^']+)'/);

    assert.ok(
      declared,
      'baseApi.js no longer declares `const baseUrl = \'…\'`; update BASE_PATH in this test to match whatever replaced it',
    );
    assert.equal(declared[1], BASE_PATH);
  });

  test('baseApi.js reads no environment variable at all', () => {
    // The cutover DELETED the env read rather than repointing it, because a
    // blank `NEXT_PUBLIC_API_BASE_URL=` used to fall through `||` to a
    // hard-coded cross-origin `localhost:5000` in production, and `??` would
    // have kept the empty string instead. If any `process.env` read ever comes
    // back into this file, this fails — and the comment block above `baseUrl`
    // says why that is not allowed.
    //
    // Asserted on `process.env` rather than on the variable NAME, because this
    // file's own comment block names the variable in order to explain the
    // failure. A name-substring check would be testing a string in prose.
    const baseApi = readFileSync(
      path.join(REPO_ROOT, 'src/services/baseApi.js'),
      'utf8',
    );
    assert.ok(
      !/process\.env/.test(baseApi),
      'baseApi.js must not read process.env: NEXT_PUBLIC_* is inlined at build time, and the old `||` fallback shipped a cross-origin localhost:5000 to production',
    );
  });
});

describe('the retired backend origins are gone from src/', () => {
  for (const origin of RETIRED_ORIGINS) {
    test(`no file under src/ contains "${origin}"`, () => {
      // Scanned across EVERY file type under `src/`, not just the `.js` files
      // the URL extraction reads. A stale origin surviving in a `.jsx`, a
      // comment or a docblock is the exact failure mode: the migration notes
      // recorded the string in prose in several places, and prose is how it
      // gets pasted back into code.
      const offenders = [];
      const files = walk(path.join(REPO_ROOT, 'src'), '');

      for (const file of files) {
        // Binary or unreadable files are skipped rather than crashing the run;
        // `src/` is source, so this is defensive only.
        let contents;
        try {
          contents = readFileSync(file, 'utf8');
        } catch {
          continue;
        }
        if (contents.includes(origin)) {
          offenders.push(path.relative(REPO_ROOT, file));
        }
      }

      assert.deepEqual(
        offenders,
        [],
        `these files still reference the retired origin "${origin}":\n${offenders.join('\n')}`,
      );
    });
  }
});

describe('the not-client-facing skip list is stated and still valid', () => {
  test('every skip-list entry names a route that still exists', () => {
    // Without this, `SKIPPED_NOT_CLIENT_FACING` is a list that can only ever
    // grow: an entry added for a route that is later renamed would keep
    // excluding nothing while still reading as an approved exemption.
    const stale = SKIPPED_NOT_CLIENT_FACING.filter((entry) => {
      const route = routes.get(entry.path);
      return !route || !routeAnswers(route, entry.method);
    });

    assert.deepEqual(
      stale.map((entry) => `${entry.method} ${entry.path}`),
      [],
      'these skip-list entries no longer name a route that exists; delete them or re-point them',
    );
  });

  test('every skip-list entry states a reason', () => {
    const unreasoned = SKIPPED_NOT_CLIENT_FACING.filter(
      (entry) => typeof entry.reason !== 'string' || entry.reason.length < 20,
    );

    assert.deepEqual(
      unreasoned.map((entry) => `${entry.method} ${entry.path}`),
      [],
      'every entry in SKIPPED_NOT_CLIENT_FACING must carry a written reason',
    );
  });

  test('no extracted client URL is exempted by the skip list', () => {
    // The skip list is a list of ROUTES, not a list of client URLs, so a client
    // declaration that resolves to one of them is still asserted. This test
    // states that explicitly so that a future edit which starts honouring the
    // list against client URLs cannot pass unnoticed.
    const exempt = clientRequests.filter((request) =>
      SKIPPED_NOT_CLIENT_FACING.some(
        (entry) => entry.path === request.path && entry.method === request.method,
      ),
    );

    assert.deepEqual(
      exempt.map((request) => `${request.file}:${request.line}`),
      [],
      'the skip list must not exempt a URL the client actually declares',
    );
  });
});

describe('joinToBase reproduces the joinUrls behaviour the client relies on', () => {
  // Pinned directly rather than inferred, because the leading-slash tolerance
  // in `joinToBase` is the one place this file deliberately tolerates a style
  // the rest of the tree does not use. If that tolerance were dropped, these
  // five would start failing as "unresolved" and the obvious but WRONG fix
  // would be to edit the URLs; this test is what makes the reason visible.
  test('a URL without a leading slash still resolves, as joinUrls makes it', () => {
    assert.equal(joinToBase('users/member'), '/api/v1/users/member');
    assert.equal(joinToBase('users/userInfo-update'), '/api/v1/users/userInfo-update');
  });

  test('a URL with a leading slash resolves unchanged', () => {
    assert.equal(joinToBase('/users/user'), '/api/v1/users/user');
  });

  test('a query string is not part of the resolved path', () => {
    assert.equal(
      joinToBase('/certificates/verify?certificateId=abc'),
      '/api/v1/certificates/verify',
    );
  });

  test('a trailing slash is normalised away', () => {
    assert.equal(joinToBase('/projects/'), '/api/v1/projects');
  });
});
