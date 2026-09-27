// =============================================================================
// TEST LOADER — makes the server-only application modules importable by
// `node --test`.
//
// WHY THIS FILE IS NEEDED. The modules under test (`src/lib/server/*.js`) are
// ESM `.js` that cannot be loaded by a bare `node --test` for TWO independent
// reasons:
//
//   1. THEY IMPORT `@/…`. The `@/` prefix is a PATH ALIAS declared in
//      `jsconfig.json` — `"@/*": ["./src/*"]`, `"@/lib/*": ["./src/lib/*"]`,
//      `"@/data/*": ["./data/*"]`. It is resolved by the Next.js
//      webpack/turbopack build, and by nothing else: `node` has no concept of
//      it, so `import { ApiError } from '@/lib/server/errors'` fails with
//      `ERR_MODULE_NOT_FOUND`.
//
//   2. THEY `import 'server-only'`. That package's `index.js` is a single
//      `throw new Error("This module cannot be imported from a Client Component
//      module…")`. It is only neutralised under the `react-server` export
//      condition, which the Next RSC runtime sets. Plain `node` resolves the
//      `default` condition, so the throw fires at IMPORT time and takes the
//      whole test file down before a single assertion runs.
//
//   Neither is a defect in the application code, and NEITHER is something a
//   test should work around by editing the module under test. Both are build /
//   runtime environment concerns, so they are solved HERE, in the loader, once.
//
// HOW IT WORKS. `module.registerHooks` (synchronous, in-thread — no worker
// thread, so a thrown error still carries a usable stack and `--test` output
// stays readable) installs a `resolve` hook that rewrites exactly THREE things
// and delegates everything else to Node's own resolver:
//
//   1. `server-only`   -> `test/stubs/server-only.mjs`, a no-op module.
//   2. `@/…`           -> a real absolute file URL, chosen by the SAME three
//                        alias rules `jsconfig.json` declares, and with the same
//      extension resolution the Next resolver performs (the exact file, then the
//      file plus each of `.js` / `.jsx` / `.mjs` / `.cjs`, then the directory's
//      `index.*`).
//   3. `next/<x>`      -> `next/<x>.js`, because the `next` package ships no
//      `exports` map and Node's ESM resolver will not guess the extension for
//      an extensionless subpath of an exports-less package (the Next bundler
//      does guess, which is why the app builds and a bare `node` does not). The
//      same retry applies to a RELATIVE specifier inside this repo, because the
//      email templates under `src/lib/server/email/` import their siblings as
//      `./layout` and `./theme`; without it `auth.controller.js` — which imports
//      the email module — could not be loaded by ANY test, and the in-repo-only
//      restriction is what keeps a mistyped BARE package name from being
//      silently redirected (see the detailed note at the retry itself).
//
//   4. Additionally, `format: 'module'` is asserted for in-repo `.js` files, to
//      suppress Node's `MODULE_TYPELESS_PACKAGE_JSON` re-parse warning. Each of
//      these four is commented in place below.
//
// WHAT THIS STUB DOES *NOT* DO, DELIBERATELY. The stub makes `server-only` a
// no-op; it does not make the imported module's own side effects go away. So a
// test still genuinely executes the module's real top-level code. If a module
// tried to connect to MongoDB at import time, this loader would not hide that.
// The `test/` directory is a gate over PURE logic — authorisation matrices,
// error envelopes, CSRF decisions, IP derivation — never over database access.
//
// ADDING A NEW TEST FILE requires no change here. Any file that imports via a
// relative path, or via `@/…`, or that pulls in `server-only` transitively,
// just works. `npm test` always loads this file first via `--import`.
// =============================================================================

import { registerHooks } from "node:module";
import { existsSync, statSync } from "node:fs";
import { pathToFileURL } from "node:url";
import path from "node:path";

// `import.meta.dirname` is the directory holding THIS file, i.e. `<repo>/test`.
// Resolving the repo root from it keeps the loader correct regardless of the
// process CWD, so `npm test`, `node --test` from the repo root, and an IDE
// runner all behave identically.
const REPO_ROOT = path.resolve(import.meta.dirname, "..");
const SERVER_ONLY_STUB = pathToFileURL(
  path.join(import.meta.dirname, "stubs", "server-only.mjs"),
).href;

/**
 * The `resend` stub, resolved in place of the real mail SDK.
 *
 * OPT-IN VIA AN ENVIRONMENT VARIABLE, and that gating is the point rather than a
 * convenience. A stub that were always active would mean no test in this suite
 * could ever exercise a real `Resend` construction, and — more importantly — a
 * future test that legitimately wanted the real SDK would have no way to ask for
 * it. `test/auth-reset-link.test.js` sets `CPCCU_TEST_STUB_RESEND=1` before its
 * dynamic imports; nothing else does, so every other test resolves the real
 * package exactly as production does.
 *
 * WHY SUBSTITUTION HAPPENS HERE AND NOT IN THE TEST FILE. `resend` is an
 * ESM-first package: its `exports` map routes `import` to `dist/index.mjs`, so it
 * is loaded as real ESM and `require.cache` — the mechanism the `next/headers`
 * stub below relies on — cannot touch it. Resolution is the only interception
 * point available, and the loader already exists to provide one.
 */
const RESEND_STUB = pathToFileURL(
  path.join(import.meta.dirname, "stubs", "resend.mjs"),
).href;

/**
 * Extensions tried, in order, when an import has no extension.
 *
 * The order is load-bearing in one respect: a specifier that resolves to a
 * DIRECTORY must not be satisfied by a same-named sibling file, and a
 * specifier that resolves to a FILE must be taken before any `index.*` lookup.
 * `.js` first matches the overwhelming majority of `src/lib/server/**` and is
 * what the Next resolver effectively does for this codebase; `.jsx` is included
 * because `src/components/**` is JSX and a test may legitimately reach into
 * it.
 */
const EXTENSIONS = [".js", ".jsx", ".mjs", ".cjs"];

/**
 * The `@/` alias rules, transcribed from `jsconfig.json`.
 *
 * `pattern` IS THE KEY VERBATIM FROM `jsconfig.json` — `"@/lib/*"`, not
 * `"@/lib/"` — and `test/loader.test.js` asserts that this list and
 * `jsconfig.json`'s `compilerOptions.paths` have IDENTICAL key sets. That is the
 * whole point: an alias added to the config but not implemented here would
 * otherwise fail every test file with a bare `Cannot find module '@/…'`, which
 * reads like an application problem. A `pattern` of `"@/*"` also has to be
 * checked LAST, and the list order below is what makes that true, because
 * `"@/*"` is a prefix of `"@/lib/*"`.
 *
 * ORDER MATTERS: `@/lib/x` must be tried against `src/lib/x` before the generic
 * `@/ -> src/` rule is considered, because the generic rule would also produce
 * `src/lib/x` and make the more specific rule unreachable. Keeping the list
 * ordered lets the resolution loop below simply take the first candidate that
 * exists on disk — the same "first match wins" semantics the Next resolver uses
 * for a `paths` array.
 *
 * `@/lib/*` IS SINGLE-VALUED. It used to declare a second candidate, the
 * top-level `lib/`, and that directory held a duplicate `cn` (default export,
 * backed by `@gpfunk/tailwindcss-clsx`) which four components imported instead
 * of the canonical named `cn` in `src/lib/utils.js`. Two live implementations of
 * one helper resolved apart only by filename, and a later `src/lib/cn.js` would
 * have silently re-pointed those four imports at a different library. The
 * duplicate and the directory are gone, and `jsconfig.json` now maps `@/lib/*` to
 * `src/lib/*` alone, so there is exactly one `cn` in the project. `ALIASES` is
 * transcribed from that config and `loader.test.js` asserts the two agree.
 */
const ALIASES = [
  { pattern: "@/lib/*", candidates: ["src/lib/"] },
  { pattern: "@/data/*", candidates: ["data/"] },
  { pattern: "@/*", candidates: ["src/"] },
];

/**
 * The string a bare specifier is actually tested against, derived from the
 * `jsconfig.json` key by dropping its trailing `*`: `"@/lib/*"` -> `"@/lib/"`.
 *
 * Deriving it rather than writing a second literal is what keeps `pattern` and
 * the matcher from drifting apart, which would produce a resolver that matches a
 * prefix the config does not declare.
 *
 * @param {{ pattern: string }} entry
 * @returns {string}
 */
function matchPrefix(entry) {
  return entry.pattern.replace(/\*$/, "");
}

/**
 * True when `candidate` is an existing FILE (not a directory).
 */
function isFile(candidate) {
  return existsSync(candidate) && statSync(candidate).isFile();
}

/**
 * Resolves an extensionless or extensioned path against a list of relative
 * prefixes, returning the first existing file.
 *
 * The candidate order is: exact path, then path + each extension, then
 * path + `/index` + each extension. The `/index` step is what makes a bare
 * `@/lib/server/controllers` resolve to `controllers/index.js` if such a
 * directory ever exists; without it a directory import would throw.
 */
function firstExistingFile(prefixes, relative) {
  for (const prefix of prefixes) {
    const base = path.join(REPO_ROOT, prefix, relative);

    if (isFile(base)) return base;

    for (const extension of EXTENSIONS) {
      const withExtension = `${base}${extension}`;
      if (isFile(withExtension)) return withExtension;
    }

    for (const extension of EXTENSIONS) {
      const asIndex = path.join(base, `index${extension}`);
      if (isFile(asIndex)) return asIndex;
    }
  }

  return null;
}

/**
 * Maps a bare `@/…` specifier to an absolute file URL, or returns `null` when
 * the specifier is not an alias import or matches nothing on disk.
 *
 * Returning `null` is important: it hands the specifier back to Node's own
 * resolver so an unresolvable `@/…` import produces Node's normal
 * `ERR_MODULE_NOT_FOUND` naming the original specifier, rather than a
 * confusing "cannot find module @/lib/..." from inside this file.
 */
function resolveAlias(specifier) {
  const alias = ALIASES.find((entry) =>
    specifier.startsWith(matchPrefix(entry)),
  );
  if (!alias) return null;

  // Strip the WHOLE matched prefix, not just `@/`. For the generic `@/*` rule
  // those are the same two characters, but `@/lib/server/errors` must become
  // `server/errors` — slicing only `@/` would yield `lib/server/errors`, which
  // combined with the `src/lib/` candidate would look for
  // `src/lib/lib/server/errors` and silently resolve nothing.
  const resolved = firstExistingFile(
    alias.candidates,
    specifier.slice(matchPrefix(alias).length),
  );
  return resolved ? pathToFileURL(resolved).href : null;
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    // `server-only` is replaced unconditionally, including for a RELATIVE
    // `./server-only` import, because the check is on the resolved bare
    // specifier and no application file imports it relatively anyway. Handling
    // the bare specifier is enough and keeps the hook cheap.
    if (specifier === "server-only") {
      return { url: SERVER_ONLY_STUB, shortCircuit: true };
    }

    // The mail-transport stub. See the `RESEND_STUB` note for why this is
    // opt-in and why it is a resolution-time substitution rather than a
    // `require.cache` entry.
    if (specifier === "resend" && process.env.CPCCU_TEST_STUB_RESEND === "1") {
      return { url: RESEND_STUB, shortCircuit: true, format: "module" };
    }

    if (specifier.startsWith("@/")) {
      const url = resolveAlias(specifier);
      if (url) return { url, shortCircuit: true, format: "module" };
    }

    // Everything else — every npm dependency, every relative import inside
    // `src/**`, every node builtin — is resolved by Node exactly as it would
    // be without this loader. That is the whole point of keeping the hook to
    // two cases: the further this file reaches into module resolution, the more
    // likely it is to diverge from what production actually does.
    let resolved;
    try {
      resolved = nextResolve(specifier, context);
    } catch (error) {
      // EXTENSIONLESS FALLBACK, IN TWO DISJOINT CASES.
      //
      // CASE A — `next/<x>`. `next/headers` (imported by
      // `src/lib/server/auth.js` and `src/lib/server/shim.js`) is a plain
      // CommonJS file at `node_modules/next/headers.js`, and the `next` package
      // ships NO `exports` map. Node's ESM resolver deliberately does not guess
      // extensions for such a package, so `import 'next/headers'` fails with
      // `ERR_MODULE_NOT_FOUND` and a "Did you mean to import next/headers.js?"
      // hint. The Next bundler does guess, which is why the application builds
      // and this test process did not.
      //
      // CASE B — A RELATIVE SPECIFIER INSIDE THIS REPO. The email templates
      // under `src/lib/server/email/` import their siblings extensionlessly
      // (`from './layout'`, `from './theme'`, `from './components/button'`), and
      // so do `src/lib/certificates/index.js` and `src/app/redux/store.js`.
      // Node does not guess there either. The effect was that
      // `auth.controller.js` — which imports the email module — could not be
      // loaded by ANY test, so the whole of the auth controller was untestable
      // even though its sibling controllers are covered.
      //
      // WHY CASE B IS SAFE, AND WHY IT IS NOT EXTENDED TO BARE SPECIFIERS. The
      // obvious hazard of any "retry with `.js`" fallback is that it converts a
      // genuine typo into a different failure, or into a silent success against
      // an unintended file. Two properties keep that from applying here: the
      // retry runs only AFTER Node has already failed, so a real typo still
      // throws (from the second attempt, naming the specifier it retried), and
      // it is restricted to RELATIVE specifiers, never to a bare package name —
      // so a mistyped `@/…` or `lodash-merge` cannot be silently redirected.
      // A blanket bare-specifier retry is still refused, for exactly the reason
      // the original comment gave.
      if (error?.code === "ERR_MODULE_NOT_FOUND") {
        if (specifier.startsWith("next/")) {
          resolved = nextResolve(`${specifier}.js`, context);
        } else if (specifier.startsWith(".") && context.parentURL) {
          // ANCHORED TO `context.parentURL`, THE MODULE THAT ASKED — and never to
          // `error.url`. `error.url` is the ALREADY-RESOLVED absolute path Node
          // failed on, so joining the specifier against it treats a FILE as if it
          // were a directory: `./components/button` imported by
          // `email/layout.js` would resolve against `email/components/button`
          // and produce `email/components/components/button.js`. The importer
          // is the only correct base, and taking it from `context` (rather than
          // `process.cwd()`) is also what keeps the loader CWD-independent.
          const base = new URL(specifier, context.parentURL).href;
          resolved = nextResolve(`${base}.js`, context);
        } else {
          throw error;
        }
      } else {
        throw error;
      }
    }

    // `format: 'module'` FOR IN-REPO `.js` FILES, and this is not optional
    // cosmetics. `package.json` has no `"type": "module"` — it cannot have one,
    // because `postcss.config.js` in the repo root is CommonJS and the Next
    // config is `.mjs` — so Node classifies a bare `src/**/*.js` path as
    // CommonJS, fails to parse it as such, emits a
    // `MODULE_TYPELESS_PACKAGE_JSON` warning, and only then re-parses it as
    // ESM. The import still succeeds, but the warning is emitted once per
    // module loaded, which buries the actual test output.
    // Every `.js` file under this repo's `src/` and `data/` is ESM: the
    // Next build treats them as such and the source uses `import`/`export`
    // exclusively. Declaring the format here states that fact once instead of
    // paying for a speculative CommonJS parse per file. `node_modules` is
    // EXCLUDED so every third-party package keeps its own declared format.
    if (
      resolved.format === undefined &&
      path.extname(resolved.url) === ".js" &&
      resolved.url.startsWith(pathToFileURL(REPO_ROOT).href) &&
      !resolved.url.includes("/node_modules/")
    ) {
      return { ...resolved, format: "module" };
    }

    return resolved;
  },
});

// Exported so a test can assert the alias table has not drifted from
// `jsconfig.json` without re-reading that file by hand, and so a failing
// resolution can be debugged against the same values the hook uses.
export { ALIASES, EXTENSIONS, REPO_ROOT, SERVER_ONLY_STUB, resolveAlias };
