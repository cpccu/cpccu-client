// =============================================================================
// STUB for the `server-only` package. Registered by `test/loader.mjs`.
//
// The real `server-only/index.js` is:
//
//     throw new Error(
//       "This module cannot be imported from a Client Component module. " +
//         "It should only be used from a Server Component."
//     );
//
// It is neutralised only under the `react-server` export condition, which the
// Next.js RSC runtime supplies and plain `node` does not. Every module under
// test in `src/lib/server/**` opens with `import 'server-only'`, so without
// this stub a test file dies on its FIRST import — before any assertion runs
// and before any failure message can explain why.
//
// This file is intentionally EMPTY of behaviour. `import 'server-only'` is a
// MARKER import: it carries no API, exports nothing, and its only job is to
// fail the build when a server module leaks into a client bundle. Asserting
// "the module under test is only ever imported from a Server Component" is a
// BUILD-TIME property of the Next bundler, not a runtime one, so there is
// nothing for a unit test to assert about it. An empty module is therefore the
// complete and correct stub — not a simplification of one.
//
// WHAT THIS DOES NOT MASK: this stub only neutralises the import of the
// marker. It does not neutralise the module under test itself, whose real
// top-level code still executes. If `src/lib/server/**` ever grew a
// connect-to-MongoDB side effect at import time, these tests would still fail
// loudly rather than pass against a hollowed-out module.
// =============================================================================

// Intentionally no exports and no statements. See the block comment above.
export {};
