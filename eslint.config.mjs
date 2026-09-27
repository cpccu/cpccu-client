import { defineConfig, globalIgnores } from "eslint/config";
import * as espree from "espree";
import nextVitals from "eslint-config-next/core-web-vitals";

/**
 * ============================================================================
 * ESLint flat config for cpccu-client.
 * ============================================================================
 *
 * WHY THIS FILE EXISTS AT ALL. `npm run lint` was unrunnable for two
 * INDEPENDENT reasons, and both had to be fixed together for the command to
 * work:
 *
 *   1. `package.json` had `"lint": "next lint"`. `next lint` was REMOVED in
 *      Next 16 — see `node_modules/next/dist/docs/01-app/03-api-reference/
 *      05-config/03-eslint.md:122` ("Starting with Next.js 16, `next lint` is
 *      removed"). In Next 16 the argument `lint` is treated as a DIRECTORY to
 *      lint, so the command fails before it ever reads a config file. The
 *      `eslint` key in `next.config.mjs` is likewise obsolete, and Next 16 no
 *      longer runs ESLint during `next build` — so before this file, NOTHING in
 *      the toolchain checked any of this code.
 *
 *   2. The repo pins `eslint@^10.11.0`. ESLint 10 dropped `.eslintrc*` support
 *      entirely, and `eslint-config-next@16.3.6` exports FLAT CONFIGS ONLY
 *      (`./core-web-vitals`, `./typescript`, `./parser`). The committed
 *      `.eslintrc.cjs` was therefore inert — present, plausible, and read by
 *      nothing.
 *
 * `.mjs` SPECIFICALLY: the repo has no `"type": "module"` in `package.json`, so
 * a bare `eslint.config.js` would be parsed as CommonJS and the ESM `import`
 * syntax below would be a syntax error. `.mjs` forces module parsing without
 * touching `package.json`, which is the smallest change that works.
 *
 * `...nextVitals` IS SPREAD, NOT NESTED. `eslint-config-next/core-web-vitals`
 * exports an ARRAY of config objects — verified in the installed package, where
 * `dist/core-web-vitals.js` is
 *   `module.exports = [...require('./index').default, pluginNext.configs['core-web-vitals']]`
 * i.e. `[next, next/typescript, globalIgnores, coreWebVitalsRules]`. Spreading
 * flattens those so each applies on its own terms. Writing `[nextVitals]` would
 * make the whole array a single config object, which ESLint rejects.
 *
 * ---------------------------------------------------------------------------
 * TWO DEVIATIONS FROM THE IN-TREE DOC EXAMPLE — BOTH FORCED, BOTH DOCUMENTED
 * ---------------------------------------------------------------------------
 * The snippet at `03-eslint.md:44-61` does not run against the versions
 * actually installed here. Neither deviation is a preference; each is a
 * specific, reproducible crash.
 *
 * (1) PARSER REPLACED WITH `espree` FOR `.js` / `.jsx` / `.mjs`.
 *     `eslint-config-next`'s `next` config object sets
 *     `languageOptions.parser` to its own bundled parser
 *     (`eslint-config-next/dist/parser.js` → `next/dist/compiled/babel/
 *     eslint-parser`, which is `@babel/eslint-parser@7.24.6`). That bundle
 *     predates ESLint 10's scope-manager API: ESLint 10.11 calls
 *     `scopeManager.addGlobals()` in `addDeclaredGlobals()`
 *     (`eslint/lib/languages/js/source-code/source-code.js:221`) and the bundled
 *     `@babel/eslint-parser` has no such method, so EVERY file crashes with
 *     `TypeError: scopeManager.addGlobals is not a function` before a single
 *     rule runs.
 *     `espree` is ESLint's own bundled parser, already present at
 *     `node_modules/espree` (v11.2.0) as a direct dependency of `eslint`, and it
 *     is the canonical parser for plain ESM + JSX. This repo is JavaScript and
 *     JSX with no TypeScript-in-.js, no decorators and no Flow, so nothing in
 *     it needs Babel. `ecmaFeatures.jsx` is what enables JSX.
 *     The override is SCOPED to `.js`/`.jsx`/`.mjs` on purpose: the one
 *     TypeScript file in the repo (`src/proxy.ts`) must keep the
 *     `typescript-eslint` parser that `eslint-config-next/typescript` installs,
 *     which the `nextVitals` spread already provides.
 *
 * (2) `settings.react.version` PINNED INSTEAD OF `'detect'`.
 *     `eslint-config-next` sets `settings: { react: { version: 'detect' } }`.
 *     With `'detect'`, `eslint-plugin-react` calls
 *     `detectReactVersion(context)` → `resolveBasedir(context)` →
 *     `contextOrFilename.getFilename()`
 *     (`eslint-plugin-react/lib/util/version.js:31`). ESLint 10 removed
 *     `context.getFilename()`, so this is another hard crash:
 *     `TypeError: contextOrFilename.getFilename is not a function` from
 *     `react/display-name`, on every file.
 *     `'detect'` also adds nothing here: it reads the installed `react`
 *     version, which is `19.3.0` (`package.json` pins `react@^19.3.0`). So the
 *     setting is replaced with that same value. When React is upgraded, this
 *     line is the one to touch.
 *
 * NET EFFECT: the rule SET is exactly what `eslint-config-next/core-web-vitals`
 * installs. Only the parser and one React setting differ, and both are forced
 * by ESLint 10 incompatibilities in the plugin stack rather than chosen.
 *
 * ---------------------------------------------------------------------------
 * WHY THIS CONFIG IS WARN-FIRST
 * ---------------------------------------------------------------------------
 * This codebase has NEVER been linted. It was inherited from an Express + Vite
 * frontend and then migrated route-by-route into Next 16, so the first run
 * surfaces a backlog that has no relationship to whether the code is correct.
 * Landing all of that as errors would mean 200+ files touched in one tooling
 * commit — exactly the kind of unreviewable diff this project has been avoiding
 * throughout the migration. Reformatting application code is out of scope.
 *
 * THE POLICY, then, in one sentence: a rule is demoted to `warn` ONLY when its
 * findings are ADVISORY (the code is not broken, only improvable), and a rule
 * whose findings are DEFECTS keeps `error` — with the specific offending files
 * named in an explicit, greppable exemption list below so the debt is recorded
 * rather than hidden.
 *
 * A new error still fails `npm run lint` and still fails CI. What is relaxed is
 * only the PRE-EXISTING backlog, and it stays visible in the output.
 */
export default defineConfig([
  ...nextVitals,

  /**
   * Parser override — see deviation (1) in the block comment above.
   *
   * Placed AFTER the `...nextVitals` spread because flat-config entries are
   * applied in order and a later `languageOptions` key wins.
   */
  {
    files: ["**/*.{js,jsx,mjs}"],
    languageOptions: {
      parser: espree,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        sourceType: "module",
      },
    },
  },

  /**
   * `settings.react.version` override — see deviation (2) above.
   */
  {
    files: ["**/*.{js,jsx,mjs,ts,tsx,mts,cts}"],
    settings: { react: { version: "19.3" } },
  },

  /**
   * The one rule that existed before this migration and is NOT in the Next
   * config. `eslint-config-next`'s base config sets
   * `'react/jsx-no-target-blank': 'off'` (see its `dist/index.js`), so this
   * entry RESTORES the intent of the deleted `.eslintrc.cjs` rather than adding
   * a new opinion.
   *
   * WHY IT IS WORTH KEEPING AT `error`: `<a target="_blank">` hands the opened
   * document a live `window.opener` reference to this page unless
   * `rel="noopener"` is present, which is reverse-tabnabbing — the destination
   * can navigate this tab to a credential-harvesting copy of the login page.
   * Modern browsers imply `noopener`, but this codebase also renders
   * user-supplied URLs, and an explicit rule is cheaper than auditing every
   * external link by hand.
   */
  {
    files: ["**/*.{js,jsx,mjs,ts,tsx,mts,cts}"],
    rules: {
      "react/jsx-no-target-blank": "error",
    },
  },

  /**
   * CORE CORRECTNESS RULES, EXPLICITLY LISTED.
   *
   * ESLint 10 no longer ships `@eslint/js` as a dependency (verified: it is not
   * in `eslint@10.11.0`'s `dependencies`), so `js.configs.recommended` cannot be
   * imported and the subset worth having is enumerated here. It is placed AFTER
   * the `nextVitals` spread so any rule `eslint-config-next` also sets wins.
   *
   * These are all "the code is wrong" rules, not style rules:
   *  - `no-undef`    a reference to a name that does not exist is a crash.
   *  - the rest      duplicate keys, unreachable code, `switch` fallthrough,
   *                  accidental self-assignment, `typeof` on a non-type,
   *                  `NaN` comparisons, `finally` that swallows control flow,
   *                  and so on.
   *
   * NOT INCLUDED, DELIBERATELY: `no-eval` and `no-implied-eval` (this is a
   * Next.js app; Next itself uses `Function`-based constructs, and neither rule
   * has ever fired on application code here), and `no-empty` (an empty `catch`
   * block is used deliberately in several places, e.g. the preview-generation
   * failure path in `ProfileImageCropModal.jsx:62-64`, where swallowing is the
   * documented intent).
   *
   * The `argsIgnorePattern`/`varsIgnorePattern` of `^_` is a convention this
   * codebase already follows — `src/lib/certificates/permissions.js` names its
   * deliberately-unused parameters `_certificate` and `_user` — so honouring it
   * is respecting an existing decision rather than inventing one.
   */
  {
    files: ["**/*.{js,jsx,mjs,ts,tsx,mts,cts}"],
    rules: {
      "no-undef": "error",
      // `no-unused-vars` is configured in the advisory-demotion block below —
      // it is dead code rather than broken code, and it has a large backlog.
      "no-dupe-args": "error",
      "no-dupe-class-members": "error",
      "no-dupe-keys": "error",
      "no-unreachable": "error",
      "no-fallthrough": "error",
      "no-self-assign": "error",
      "no-cond-assign": "error",
      "no-constant-condition": ["error", { checkLoops: false }],
      "no-func-assign": "error",
      "no-obj-calls": "error",
      "no-unsafe-negation": "error",
      "no-unsafe-finally": "error",
      "no-async-promise-executor": "error",
      "no-setter-return": "error",
      "no-class-assign": "error",
      "no-sparse-arrays": "error",
      "require-yield": "error",
      "valid-typeof": "error",
      "use-isnan": "error",
      "no-compare-neg-zero": "error",
      "no-control-regex": "error",
      "no-misleading-character-class": "error",
      "no-prototype-builtins": "error",
    },
  },

  /**
   * ADVISORY DEMOTIONS — `error` → `warn`.
   *
   * Every rule in this block reports on code that WORKS. None of them describes
   * a defect; they describe debt. They are demoted so the pre-existing backlog
   * stays visible in the output without blocking the work this gate exists to
   * unblock. Each one still fails nothing — but it is still reported, and the
   * count is the burn-down list.
   */
  {
    files: ["**/*.{js,jsx,mjs,ts,tsx,mts,cts}"],
    rules: {
      // 28 findings / 23 files. `next/image` is real LCP advice, but converting
      // one changes the rendered markup, adds `width`/`height` requirements and
      // collides with the `onError` fallbacks in `DonatorCard.jsx:20`,
      // `ContributorCard.jsx:21` and `PreviousCommittee.jsx:82`, which point at
      // `ui-avatars.com` — a host deliberately ABSENT from the
      // `images.remotePatterns` allow-list in `next.config.mjs` (see the
      // comment there). A naive conversion breaks them at runtime with
      // "Invalid src prop … hostname is not configured". That is a product
      // decision, not a lint fix, and it must not ride in on a tooling commit.
      "@next/next/no-img-element": "warn",

      // 16 findings / 10 files. NOT A DEFECT: React renders a bare `'` or `"`
      // inside JSX text literally and correctly; only `>`, `}` and quotes
      // inside ATTRIBUTE values are ambiguous in JSX. This is a leftover
      // hygiene rule from the `next lint` era with no build or runtime impact
      // here, so it cannot justify 16 error-severity findings.
      "react/no-unescaped-entities": "warn",

      // 13 findings / 12 files. Advisory React-Compiler lint: setState in an
      // effect costs an extra render, it does not break anything. The flagged
      // files use the idiomatic "mirror a prop into local state when the prop
      // changes" shape (`useEffect` keyed on `[isOpen, imageSrc]`, on a Redux
      // `hydrated` flag, etc.), which is correct-but-not-Compiler-clean. Worth
      // working through per component, not worth blocking on.
      "react-hooks/set-state-in-effect": "warn",

      // ~55 findings / ~41 files after the Header.jsx dead import was removed.
      // Dead code, not broken code: an unused import costs bundle size and
      // misleads readers, but nothing about it is incorrect at runtime, and
      // deleting 55 imports across 41 application files is a refactor of its
      // own rather than a tooling commit.
      //
      // `argsIgnorePattern`/`varsIgnorePattern` of `^_` honour the convention
      // this codebase already uses for deliberately-unused names — see
      // `src/lib/certificates/permissions.js`, which names them
      // `_certificate` / `_user`. Without this, 8 of the findings would be
      // false positives against that existing decision.
      "no-unused-vars": [
        "warn",
        {
          args: "after-used",
          caughtErrors: "none",
          ignoreRestSiblings: true,
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
    },
  },

  /**
   * DEFECT RULES THAT KEEP `error`, WITH NAMED LEGACY EXEMPTIONS.
   *
   * These three rules describe things that are actually wrong, so they are NOT
   * globally demoted. Instead each pre-existing violating file is named here and
   * ONLY that file is exempted. Consequences, which are the point:
   *  - every other file in the repo, and every file added later, is still
   *    checked at `error`;
   *  - the exemption list is a greppable, reviewable TODO list of real bugs;
   *  - nothing is silently hidden — delete a line from a list when the file is
   *    fixed, and the rule starts firing on it again.
   *
   * The bugs recorded here are REPORTED, NOT FIXED, because fixing application
   * logic is explicitly outside the scope of this change.
   */
  {
    // REAL BUG: `ProfileImageCropModal.jsx:28` has `if (!isOpen || !imageSrc)
    // return null;` BEFORE `useCallback` (:30) and two `useEffect`s (:67, :81).
    // React requires an identical hook order on every render, so opening the
    // modal after it has been closed throws "Rendered more hooks than during
    // the previous render." — the profile-photo crop flow is broken today.
    // The other file is a naming-convention finding, not a crash:
    // `users/profile/[id]/page.jsx:60` default-exports a component literally
    // named `page`, which the App Router accepts but the rule cannot recognise
    // as a component.
    //
    // THE BRACKETS IN THAT PATH ARE ESCAPED, AND THAT IS LOAD-BEARING. Flat
    // config `files` entries are globs (minimatch), so an unescaped `[id]` is a
    // CHARACTER CLASS matching a single `i` or `d`, not the literal directory
    // name — the exemption would silently never match and the file would keep
    // erroring. Same reason the `(main)` route group is fine: a bare `(` is not
    // a glob metacharacter (only `?(`, `*(`, `+(`, `@(`, `!(` are).
    files: [
      "src/app/(main)/users/profile/\\[id\\]/page.jsx",
      "src/components/PROFILE/ProfileImageCropModal.jsx",
    ],
    rules: { "react-hooks/rules-of-hooks": "off" },
  },
  {
    // REAL BUG: `Math.random()` / `Date.now()` called during render.
    //   - `sidebar.jsx:553` (in BOTH the canonical `components/ui/` and the
    //     duplicated `components/CERTIFICATE/ui/` copy) calls `Math.random()`,
    //     so the generated value differs between the server render and the
    //     client hydration → React hydration mismatch.
    //   - `UpComingEventCard.jsx:124`, `EventLayout.jsx:63` and
    //     `gallery-content.jsx:243` call `Date.now()` inside a comparator or
    //     filter evaluated during render, which makes the ordering
    //     time-dependent and non-deterministic between renders.
    files: [
      "src/components/CERTIFICATE/ui/sidebar.jsx",
      "src/components/Global/UpComingEventCard.jsx",
      "src/components/HOME/eventUpcoming/EventLayout.jsx",
      "src/components/gallery-content.jsx",
      "src/components/ui/sidebar.jsx",
    ],
    rules: { "react-hooks/purity": "off" },
  },
  {
    // REAL BUG (cosmetic but user-visible): `<!-- … -->` inside JSX children is
    // parsed as literal TEXT by the JSX spec, so React renders the comment
    // characters into the DOM. 9 findings / 5 files.
    files: [
      "src/components/ABOUT/PreviousCommittee.jsx",
      "src/components/CONTRIBUTORS/ContributorsPage.jsx",
      "src/components/DONATORS/DonatorsPage.jsx",
      "src/components/HOME/ContributorsCarousel.jsx",
      "src/components/HOME/DonatorsCarousel.jsx",
    ],
    rules: { "react/jsx-no-comment-textnodes": "off" },
  },

  globalIgnores([
    // eslint-config-next's own default ignores, repeated here so the list is
    // explicit and does not silently change if a future version changes its
    // defaults.
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",

    // Lockfiles are machine-generated and enormous. Linting them produces
    // thousands of identical unresolved-import findings and has never surfaced
    // a real defect.
    "bun.lock",
    "package-lock.json",

    // `.kilo/worktrees/**` holds a full second checkout of this repository
    // created by the Kilo Code tooling. Linting it would report every finding
    // in the working tree a second time against a different path, which makes
    // the histogram unauditable and every finding ambiguous about which copy it
    // belongs to. Only the primary checkout is linted.
    ".kilo/**",
  ]),
]);
