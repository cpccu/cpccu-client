/**
 * Verifies `getParticipationErrorMessage` against the four error shapes RTK Query
 * can actually produce, read out of the bundled `fetchBaseQuery` itself.
 *
 *   node scripts/verify-participation-error-guard.mjs
 *
 * ⚠️ WHY THIS RUNS IN NODE RATHER THAN IN A TEST RUNNER.
 *
 * 1. This codebase has no client test runner at all — `package.json` has no
 *    vitest/jest and `npm run lint` cannot even execute (`next lint` was removed
 *    in Next 16). Introducing one to assert nine object literals would be a much
 *    larger change than the function it guards.
 *
 * 2. ⚠️ `src/lib/participation.js` CANNOT BE IMPORTED DIRECTLY. It does
 *    `import { toSafeHref } from './hackathon'` — extensionless, resolved by
 *    Turbopack and by `jsconfig.json`'s `@/*` alias — which Node's ESM loader
 *    rejects with `ERR_MODULE_NOT_FOUND`. The function under test is also pure
 *    and depends on nothing, so it is EXTRACTED below by slicing the source
 *    between its own markers and evaluating just that.
 *
 *    That extraction is the reason this file asserts on a slice rather than
 *    importing: if the markers or the body ever move, this file fails loudly with
 *    a specific message instead of silently testing nothing. It is the lesser
 *    evil versus either (a) silently testing `undefined`, or (b) adding a bundler
 *    or a test runner to the repo.
 *
 * ⚠️ WHY THE FOUR SHAPES ARE HARDCODED RATHER THAN BUILT AT RUNTIME.
 * They are transcribed from `node_modules/@reduxjs/toolkit/dist/query/cjs/
 * rtk-query.development.cjs` (the installed 2.12.0), lines ~271-316:
 *
 *   fetch throws          → { status: 'FETCH_ERROR', error: String(e) }
 *   body is not JSON      → { status: 'PARSING_ERROR', originalStatus, data: text }
 *   response not ok       → { status: response.status, data: resultData }
 *
 * and from `cpccu-server/src/app.js`'s two 500 branches, read off the real source:
 * the `ApiError` branch sends `{ status: err.statusCode, message: err.message,
 * errors: err.error }` — and `ApiError`'s constructor defaults `error` to `[]`,
 * so the key is ALWAYS present. The catch-all sends `{ status: 500, message:
 * err.message || 'Internal Server Error' }` with NO `errors` key, where the
 * message is whatever Mongoose or the Mongo driver threw.
 *
 * The distinction this file exists to prove is that ONLY the catch-all shape is
 * suppressed — because only it can carry a collection name, a schema path or a
 * CastError to a public page.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const SOURCE_PATH = resolve(HERE, '../src/lib/participation.js');

const BEGIN = 'export const getParticipationErrorMessage = (error, fallback) => {';
const END = '\n};';

/**
 * Pulls the function body out of the source file and evaluates it.
 *
 * The slice runs from the declaration to the first line that is exactly `};` at
 * column 0. Inside the function every line is indented, so a column-0 `};` can
 * only be the function's own terminator — which is why this is safe rather than
 * a regex guess that could stop at a nested early return.
 */
const extract = () => {
  const source = readFileSync(SOURCE_PATH, 'utf8');

  const start = source.indexOf(BEGIN);
  if (start === -1) {
    throw new Error(
      `Could not find the marker line in ${SOURCE_PATH}. The function's ` +
        'declaration was renamed or reformatted; update this script to match.'
    );
  }

  const end = source.indexOf(END, start);
  if (end === -1) {
    throw new Error(
      `Could not find the function's closing "\n};" in ${SOURCE_PATH}. Its body ` +
        'was refactored into a helper; update this script to extract that instead.'
    );
  }

  // Strip the `export` so the slice evaluates as a plain expression assignment.
  const body = source.slice(start, end + END.length).replace('export const', 'const');

  // eslint-disable-next-line no-new-func -- deliberate: this is the whole point.
  return new Function(`${body}\nreturn getParticipationErrorMessage;`)();
};

const getParticipationErrorMessage = extract();

// ── The fixtures ────────────────────────────────────────────────────────────

/**
 * Every deliberate `ApiError`, including 500s.
 *
 * ⚠️ `errors` IS `[]` AND NOT `undefined`, which is the detail this whole
 * discrimination rests on. `ApiError`'s constructor takes `error = []` as its
 * third parameter and `app.js` sends `errors: err.error` verbatim, so the wire
 * body of EVERY ApiError carries an `errors` KEY holding an empty array. A
 * fixture written as `errors: undefined` would look equivalent but is not: it
 * models a key that is absent rather than a key that is present and empty, and
 * the guard distinguishes precisely on that.
 *
 * So `errors: []` ⇒ a message a person wrote for a reader, shown verbatim.
 * Key absent ⇒ the global handler's catch-all, whose `message` is
 * `err.message` from Mongoose or the Mongo driver, suppressed.
 */
const apiErrorEnvelope = (status, message) => ({
  status,
  data: { status, message, errors: [] },
});

/**
 * The global handler's catch-all: `{ status, message }` with NO `errors` key.
 * `message` is `err.message` — a Mongoose or driver string.
 */
const rawInternalEnvelope = (status, rawDriverMessage) => ({
  status,
  data: { status, message: rawDriverMessage },
});

const FALLBACK = 'Something went wrong. Please try again.';

const cases = [
  // ── Messages that MUST be shown, verbatim ───────────────────────────────
  [
    'shows a 409 written for the participant',
    apiErrorEnvelope(409, 'One of the participants is already registered for this event.'),
    'One of the participants is already registered for this event.',
  ],
  [
    'shows a 400 naming the offending student ID',
    apiErrorEnvelope(400, 'No member found for student ID: 22109999.'),
    'No member found for student ID: 22109999.',
  ],
  [
    'shows a 403 explaining the membership gate',
    apiErrorEnvelope(
      403,
      'Your membership is not approved for event registration yet. Please contact a club administrator.'
    ),
    'Your membership is not approved for event registration yet. Please contact a club administrator.',
  ],
  [
    'shows a 429 rate-limit message',
    apiErrorEnvelope(429, 'Too many event requests. Please try again later.'),
    'Too many event requests. Please try again later.',
  ],
  [
    '⚠️ shows a DELIBERATE 500, which has an `errors` key',
    // Keying on `status === 500` would hide this. It is a message a person chose
    // to write for a reader, and hiding it leaves the participant with nothing.
    apiErrorEnvelope(500, 'The registration service is temporarily unavailable.'),
    'The registration service is temporarily unavailable.',
  ],

  // ── Messages that MUST be suppressed ────────────────────────────────────
  [
    '⚠️ SUPPRESSES a raw 500 carrying a Mongoose validation string',
    rawInternalEnvelope(500, 'EventRegistration validation failed: members.0.user: Required'),
    FALLBACK,
  ],
  [
    '⚠️ SUPPRESSES a raw 500 carrying a CastError',
    rawInternalEnvelope(500, 'Cast to ObjectId failed for value "not-an-id"'),
    FALLBACK,
  ],
  [
    'substitutes for a network failure (FETCH_ERROR, no message field)',
    { status: 'FETCH_ERROR', error: 'TypeError: Failed to fetch' },
    FALLBACK,
  ],
  [
    'substitutes for a non-JSON body (PARSING_ERROR, message is a string)',
    { status: 'PARSING_ERROR', originalStatus: 502, data: '<html>502 Bad Gateway</html>' },
    FALLBACK,
  ],
  ['substitutes for undefined', undefined, FALLBACK],
  ['substitutes for an empty object', {}, FALLBACK],
];

let failures = 0;

console.log('getParticipationErrorMessage — error-envelope handling\n');

for (const [name, error, expected] of cases) {
  const actual = getParticipationErrorMessage(error, FALLBACK);

  if (actual === expected) {
    console.log(`  ok    ${name}`);
    continue;
  }

  failures += 1;
  console.log(`  FAIL  ${name}`);
  console.log(`          expected: ${JSON.stringify(expected)}`);
  console.log(`          actual:   ${JSON.stringify(actual)}`);
}

console.log(`\n${cases.length - failures}/${cases.length} passed`);

if (failures > 0) {
  process.exitCode = 1;
}
