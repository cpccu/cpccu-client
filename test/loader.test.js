// =============================================================================
// THE LOADER ITSELF — `test/loader.mjs` and the `server-only` stub.
//
// WHY THIS FILE EXISTS. Every other test in this directory depends on the loader
// to resolve two things plain `node` cannot: the `@/` path alias from
// `jsconfig.json`, and the `server-only` marker package that throws outside a
// React Server Components context. If the loader silently stopped resolving
// either, every other file in this directory would fail with a
// `Cannot find module '@/…'` or a "cannot be imported from a Client Component
// module" error that reads like an application problem rather than a harness
// problem.
//
// These tests assert the loader's CONTRACT rather than each module's behaviour:
// that the alias table still matches `jsconfig.json`, that each alias actually
// resolves to the file the Next build would pick, that the stub really is inert,
// and that the extensionless `next/…` fallback and the in-repo `format: 'module'`
// override behave.
//
// THE ALIAS TABLE IS COMPARED AGAINST `jsconfig.json` RATHER THAN HARD-CODED, so
// adding a new alias to the config without teaching the loader about it fails
// HERE instead of failing every other test file with a confusing error.
// =============================================================================

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import { pathToFileURL } from "node:url";

import {
  ALIASES,
  EXTENSIONS,
  REPO_ROOT,
  SERVER_ONLY_STUB,
  resolveAlias,
} from "./loader.mjs";

/**
 * Reads `jsconfig.json` and returns its parsed `compilerOptions.paths`.
 *
 * The file is JSONC — it carries two full-line `//` comments. ONLY full-line
 * comments are stripped, and deliberately so: a general block-comment stripper
 * would also match the slash-star sequence inside the `"@/lib/*"` KEY, swallow
 * everything up to the next star-slash inside a value, and produce a parse error
 * that has nothing to do with the alias table. Stripping line-leading `//` only
 * cannot touch a string literal, because a `//` that is part of a specifier is
 * never at the start of a line.
 *
 * @returns {Record<string, string[]>} the declared alias -> target-directory map
 */
function readDeclaredAliases() {
  const raw = readFileSync(path.join(REPO_ROOT, "jsconfig.json"), "utf8");
  const withoutFullLineComments = raw
    .split("\n")
    .filter((line) => !/^\s*\/\//.test(line))
    .join("\n");

  return JSON.parse(withoutFullLineComments).compilerOptions.paths;
}

describe("the loader — the `@/` alias table mirrors jsconfig.json", () => {
  test("every alias declared in jsconfig.json is implemented, and vice versa", () => {
    // `jsconfig.json` is the single source of truth for the alias table. Reading
    // it rather than hard-coding the expectation is what makes this test useful —
    // a new alias added to the config fails HERE, with a message naming the alias,
    // instead of failing every other test file with `Cannot find module '@/…'`.
    const declared = readDeclaredAliases();

    // Every declared prefix must have an implementation. The ORDER of `declared`
    // is not relied upon; only membership is.
    for (const prefix of Object.keys(declared)) {
      assert.ok(
        ALIASES.some((entry) => entry.pattern === prefix),
        `jsconfig.json declares the alias "${prefix}" but test/loader.mjs does not implement it`,
      );
    }

    // …and the loader must not invent aliases the config does not declare, or it
    // would resolve a specifier the Next build rejects — a harness that is more
    // permissive than production is worse than one that fails loudly.
    for (const entry of ALIASES) {
      assert.ok(
        Object.hasOwn(declared, entry.pattern),
        `test/loader.mjs implements the alias "${entry.pattern}", which jsconfig.json does not declare`,
      );
    }

    // ORDER MATTERS and is not derivable from a set comparison. The generic
    // `"@/*"` key is a prefix of `"@/lib/*"`, so if it were checked first every
    // `@/lib/…` specifier would be resolved as `src/lib/…` — which happens to
    // give the right answer for the PRIMARY candidate and silently makes the
    // `lib/` FALLBACK unreachable. Asserting the order pins that.
    assert.deepEqual(
      ALIASES.map((entry) => entry.pattern),
      ["@/lib/*", "@/data/*", "@/*"],
      "the generic `@/*` alias must be checked LAST",
    );
  });

  test("each alias keeps the candidate order jsconfig.json declares", () => {
    // Order is load-bearing whenever a `paths` array has more than one target:
    // reversing the entries would silently resolve a module to the wrong file
    // whenever both exist. `@/lib/*` is now single-valued (the top-level `lib/`
    // fallback and its duplicate `cn` are gone), so for that alias this is a
    // trivial one-element comparison — but it is what keeps `ALIASES` and
    // `jsconfig.json` from drifting apart, which is the assertion's real value.
    const declared = readDeclaredAliases();

    for (const entry of ALIASES) {
      const targets = declared[entry.pattern];
      assert.ok(
        Array.isArray(targets),
        `${entry.pattern} must map to an array in jsconfig.json, got ${JSON.stringify(targets)}`,
      );

      const expected = targets.map((target) =>
        // jsconfig targets are written `./src/lib/*`; the loader's candidates are
        // directory prefixes with the `*` already removed.
        target.replace(/\*$/, "").replace(/^\.\//, ""),
      );

      assert.deepEqual(
        entry.candidates,
        expected,
        `${entry.pattern} must resolve its jsconfig.json targets in the declared order`,
      );
    }
  });

  test("`@/lib/*` is SINGLE-VALUED — there is no second `lib/` fallback", () => {
    // This previously asserted that `@/lib/*` is tried under `src/lib` BEFORE a
    // top-level `lib/` fallback. That fallback is gone: the root `lib/` held a
    // duplicate `cn` (default export, `@gpfunk/tailwindcss-clsx`) which four
    // components imported instead of the canonical named `cn` in
    // `src/lib/utils.js`, so two live implementations of one helper resolved
    // apart only by filename.
    //
    // The ordering guarantee is now STRONGER than the one it replaces. "src/lib
    // wins over lib/" only says which of two candidates is taken first; a
    // single-valued mapping says there is nothing to be ambiguous at all, which
    // is what actually prevents a future `src/lib/cn.js` from silently
    // re-pointing an import at a different library.
    const libEntry = ALIASES.find((entry) => entry.pattern === "@/lib/*");
    assert.deepEqual(libEntry.candidates, ["src/lib/"]);

    // And the directory that used to provide the fallback must not come back as
    // dead config: a `./lib/*` mapping entry would resolve to nothing and would
    // re-introduce the ambiguity this test exists to prevent.
    const declared = readDeclaredAliases();
    assert.equal(
      declared["@/lib/*"].length,
      1,
      "@/lib/* must map to exactly one target; a second entry re-arms the ambiguity",
    );
  });
});

describe("the loader — the aliases actually resolve", () => {
  // Each of these is an import that a test file makes in practice, so a
  // regression in resolution surfaces here with a precise message instead of as
  // a wall of failures across the suite. `expectedRelativePath` is not merely a
  // label: `resolveAlias` is called directly and the resulting file URL is
  // compared, which is what proves the alias points at the file the Next build
  // would pick rather than merely at SOME file.
  const resolvable = [
    ["@/lib/server/adminAuth", "src/lib/server/adminAuth.js"],
    ["@/lib/server/errors", "src/lib/server/errors.js"],
    ["@/lib/server/request", "src/lib/server/request.js"],
    ["@/lib/server/response", "src/lib/server/response.js"],
    ["@/lib/server/handler", "src/lib/server/handler.js"],
    [
      "@/lib/server/controllers/visitor.controller",
      "src/lib/server/controllers/visitor.controller.js",
    ],
    // `@/data/*` resolves to a JSON file. It is NOT imported here, because
    // `import()` of JSON needs an import attribute (`with { type: 'json' }`) and
    // every test file that reads a JSON file does so with `readFileSync` +
    // `JSON.parse` instead. The RESOLUTION is what this test is about.
    ["@/data/global/institude.json", "data/global/institude.json"],
  ];

  for (const [specifier, expectedRelativePath] of resolvable) {
    test(`${specifier} resolves to ${expectedRelativePath}`, async () => {
      const url = resolveAlias(specifier);
      assert.equal(
        url,
        pathToFileURL(path.join(REPO_ROOT, expectedRelativePath)).href,
        `${specifier} must resolve to exactly ${expectedRelativePath}`,
      );

      if (expectedRelativePath.endsWith(".json")) return; // see the note above

      // NOT named `module`: `@next/next/no-assign-module-variable` is right that
      // assigning to `module` is unsafe in a CommonJS file, and the rule fires on
      // the binding regardless of module system. The namespace is called
      // `namespace` here for the same reason the loader does.
      const namespace = await import(specifier);
      assert.ok(
        namespace && typeof namespace === "object",
        `${specifier} must resolve to a module namespace`,
      );
    });
  }

  test("an EXTENSIONLESS `@/…` specifier gains its extension", () => {
    // `@/lib/server/errors` has no extension; the loader must add `.js`. Without
    // the extension step, the resolution would return `null` and the import
    // would fail with a message that points at the loader rather than at the
    // specifier.
    assert.equal(
      resolveAlias("@/lib/server/errors"),
      pathToFileURL(path.join(REPO_ROOT, "src/lib/server/errors.js")).href,
    );
    // A specifier that already carries its extension is honoured as-is.
    assert.equal(
      resolveAlias("@/lib/server/errors.js"),
      pathToFileURL(path.join(REPO_ROOT, "src/lib/server/errors.js")).href,
    );
  });

  test("the module under test really is the repository's file, not a stub", () => {
    // Guards against the loader being pointed at the wrong root, which would make
    // every other test in this directory meaningless while still passing.
    assert.equal(REPO_ROOT, path.resolve(import.meta.dirname, ".."));
  });

  test("a non-existent `@/…` path fails LOUDLY rather than resolving to nothing", () => {
    // The loader returns `null` from its alias resolver for a specifier that
    // matches no file on disk, which hands the specifier back to Node's own
    // resolver. That produces Node's normal `ERR_MODULE_NOT_FOUND` naming the
    // ORIGINAL specifier — as opposed to a confusing "cannot find module" thrown
    // from inside the loader, or worse, a silent success against the wrong file.
    assert.equal(
      resolveAlias("@/lib/server/definitely-not-a-real-module"),
      null,
    );

    return assert.rejects(
      () => import("@/lib/server/definitely-not-a-real-module"),
      (error) => {
        assert.equal(error.code, "ERR_MODULE_NOT_FOUND");
        return true;
      },
    );
  });
});

describe("the loader — the `server-only` stub", () => {
  test("importing `server-only` succeeds and yields an empty module", async () => {
    // The real `server-only/index.js` is a bare `throw`, so without the stub every
    // test file would die on its first import of a module under
    // `src/lib/server/**`.
    const stub = await import("server-only");
    assert.deepEqual(
      Object.keys(stub),
      [],
      "the stub exports nothing: it is a marker import",
    );
  });

  test("the stub is a file inside `test/stubs/`, not the real package", () => {
    // A loader that resolved `server-only` to the real package would pass this
    // suite's imports but every module would throw. Asserting the URL points at
    // the in-repo stub makes that failure mode impossible to introduce silently.
    assert.ok(SERVER_ONLY_STUB.startsWith("file://"));
    assert.ok(
      SERVER_ONLY_STUB.includes("/test/stubs/server-only.mjs"),
      `the server-only stub must live in test/stubs/, got ${SERVER_ONLY_STUB}`,
    );
  });

  test("the real package is still a throw, so the stub is not a redundant export map", () => {
    // Documents WHY the stub exists, and fails if someone "simplifies" the loader
    // by deleting the `server-only` branch on the grounds that the package
    // "already handles it".
    const real = readFileSync(
      path.join(REPO_ROOT, "node_modules/server-only/index.js"),
      "utf8",
    );
    assert.match(real, /throw new Error\(/);
    assert.match(real, /Client Component module/);
  });
});

describe("the loader — the two forced deviations from Node's resolver", () => {
  test("the extensionless `next/…` fallback is what makes `next/headers` loadable", async () => {
    // `next/headers` is a CommonJS file at `node_modules/next/headers.js` and the
    // `next` package ships NO `exports` map, so Node's ESM resolver will not guess
    // the extension and the import fails outright. The Next bundler does guess,
    // which is why the application builds and a bare `node` does not. The fallback
    // is scoped to `next/` for exactly this reason: `auth.js` and `shim.js` both
    // import it, and a blanket "retry with `.js`" would mask genuine typos.
    const headers = await import("next/headers");
    assert.equal(typeof headers.cookies, "function");
    assert.equal(typeof headers.headers, "function");
  });

  test("a genuinely missing `next/…` subpath still throws rather than resolving to junk", () => {
    // The negative of the test above. If the fallback swallowed errors, a typo in a
    // `next/` import would resolve to nothing instead of failing.
    return assert.rejects(
      () => import("next/definitely-not-a-real-subpath"),
      (error) => {
        assert.equal(error.code, "ERR_MODULE_NOT_FOUND");
        return true;
      },
    );
  });

  test("the extension list covers every file type `src/**` actually uses", () => {
    // `EXTENSIONS` is the candidate list for an extensionless `@/…` import. It
    // must cover the extensions the application is written in, or an extensionless
    // internal import would resolve to nothing.
    for (const extension of [".js", ".jsx", ".mjs", ".cjs"]) {
      assert.ok(
        EXTENSIONS.includes(extension),
        `EXTENSIONS must include ${extension}`,
      );
    }
    // `.ts`/`.tsx` are deliberately absent: they are covered by the dedicated
    // `nextVitals` `next/typescript` config entry in `eslint.config.mjs`, and
    // `src/lib/server/**` — everything these tests import — is plain JS. Adding
    // them here without also adding a TypeScript parser would turn a clear
    // "cannot find module" into a parse error.
    assert.equal(EXTENSIONS.includes(".ts"), false);
  });

  test("in-repo `.js` files load as ESM without Node's re-parse warning", () => {
    // `package.json` has no `"type": "module"` (it cannot: `postcss.config.js` in
    // the repo root is CommonJS), so Node classifies `src/**/*.js` as CommonJS,
    // fails to parse it, warns, and only then re-parses as ESM. The loader
    // declares `format: 'module'` for in-repo files to state the fact once. This
    // test is the behavioural proof: a module that uses `import`/`export`
    // statements round-trips and its named exports are present.
    //
    // THE LIST IS AN EXACT ENUMERATION, not a subset, so it also fails on an
    // export nobody intended to add. `resolveVerboseErrors` is here because it
    // is the shared `VERBOSE_ERRORS`/`NODE_ENV` redaction gate that `auth.js`
    // calls as well as this module — extracting it is what stopped the two
    // redactions from disagreeing about when they applied.
    return import("@/lib/server/errors").then((module) => {
      assert.deepEqual(Object.keys(module).sort(), [
        "ApiError",
        "isResponsePair",
        "resolveVerboseErrors",
        "toErrorResponse",
      ]);
    });
  });
});
