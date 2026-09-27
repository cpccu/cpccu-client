import 'server-only';

import { ApiError } from '@/lib/server/errors';
import { ApiResponse } from '@/lib/server/response';

/**
 * Port of `cpccu-server/src/controllers/bootcampLeaderboard.controller.js`.
 *
 * The only handler in this migration that talks to a THIRD PARTY: it reads a
 * public Google Sheet through the Sheets v4 REST API and reshapes it. Two
 * properties of that follow from the API's shape rather than from choice, and
 * both are load-bearing, so read them before editing the parsing below.
 */

/**
 * Coerces a spreadsheet cell to a number, defaulting to `0`.
 *
 * `Number(value) || 0` is doing TWO jobs with one expression, and the second is
 * a consequence worth stating: a cell containing an empty string, a stray
 * space, or a non-numeric note all become `0`, so one malformed row cannot turn
 * a column into `NaN` and blank out the whole leaderboard. It also means a
 * genuinely negative score becomes `0` — there is no negative scoring in this
 * competition, so that is harmless here.
 */
const toNumber = (value) => Number(value) || 0;

/**
 * Turns the raw `values` matrix into leaderboard entries.
 *
 * `rows.slice(1)` DROPS ROW 0 unconditionally: Sheets returns the sheet's
 * first row as data, and this sheet's row 0 is the header. There is no
 * header detection — if a row were ever inserted above the header, that row
 * would be silently rendered as a participant named after a column label.
 *
 * `.filter((row) => row[0])` drops rows with an empty name, which is how
 * trailing blank rows (Sheets trims them, but a row with formatting and no
 * values still comes back as `['']`) are skipped.
 *
 * `rank: toNumber(row[6]) || index + 1` — THE COLUMN WINS, THE POSITION IS THE
 * FALLBACK. The sheet carries its own ranking in column G, computed by the
 * competition organiser, and that is authoritative: it encodes the tie-breaking
 * rules. `index + 1` is only used when column G is empty or unparseable, and
 * because `index` is the index WITHIN THE FILTERED, HEADER-STRIPPED array, it
 * produces a 1-based position in display order. Note the consequence: if the
 * sheet's own ranks were sparse (1, 2, 5), the fallback for a row missing a
 * rank would count from 1 and could duplicate a rank already in use.
 */
const normalizeRows = (rows) => {
  if (rows.length < 2) {
    return [];
  }

  return rows
    .slice(1)
    .filter((row) => row[0])
    .map((row, index) => ({
      name: row[0] ?? '',
      batch: toNumber(row[1]),
      attendance: toNumber(row[2]),
      task: toNumber(row[3]),
      contest: toNumber(row[4]),
      total: toNumber(row[5]),
      rank: toNumber(row[6]) || index + 1,
    }));
};

/**
 * Per-request outbound budget for ONE Google Sheets call, in milliseconds.
 *
 * WHY A TIMEOUT IS NEEDED AT ALL. `src/app/api/v1/bootcamp-leaderboard/route.js`
 * is `public: true` and has NO rate limiter, and this handler makes TWO SEQUENTIAL
 * Sheets calls. `undici`'s defaults are `headersTimeout: 300e3` and
 * `bodyTimeout: 300e3` (5 MINUTES), and `next.config.mjs` configures no
 * `maxDuration`, so the effective ceiling is whatever the hosting platform
 * allows. A peer that completes the TCP/TLS handshake and then simply STOPS
 * writing therefore holds a function invocation open for that entire budget —
 * and holds TWO of them, because the second call only starts once the first
 * returns. Unauthenticated, repeatable, that is a cheap primitive for pinning
 * invocations; the fix is to refuse to be stalled, not to hope the platform
 * notices.
 *
 * WHY 8 SECONDS. It is far more than a Sheets `values` read of a sub-100-row
 * range needs on a healthy path — that is single-digit hundreds of milliseconds —
 * and it is 37x below the 300s it replaces. The number is deliberately NOT
 * derived from an observed p99: what is being bounded is not "how long Sheets
 * usually takes" but "how long one UNAUTHENTICATED caller can occupy a function
 * invocation", and the honest tradeoff is an occasional 502 on a slow mobile
 * link in exchange for never being stallable. `AbortSignal.timeout` is a
 * Node/undici GLOBAL (no dependency added) and it aborts the underlying request,
 * not just the awaiting promise, so the socket is actually released rather than
 * left for undici to reap later.
 *
 * PER-CALL, NOT PER-REQUEST: the two calls are bounded independently, so the
 * worst case for one request is 2 × this value. That is the intended shape — a
 * single shared budget would let the first (cheap metadata) call starve the
 * second (the actual data) call, and the two have very different latencies.
 */
const SHEETS_REQUEST_TIMEOUT_MS = 8000;

/**
 * Runs one Google Sheets request under `SHEETS_REQUEST_TIMEOUT_MS` and maps a
 * FAILURE — network error OR timeout/abort — to the caller's `ApiError(502, …)`.
 *
 * WHY THE ABORT IS FOLDED INTO THE 502 BRANCH RATHER THAN GIVEN ITS OWN. The
 * client already has an error path for "Google did not answer us" and it keys
 * off the status code, so a stall is exactly the same class of event as a
 * non-2xx response: WE are up, upstream is not answering. 502 = bad gateway,
 * which is what this is; 500 would claim the leaderboard itself is broken.
 * Introducing a new status or a new error shape for the timeout would change the
 * API contract the frontend is already written against, for a condition the
 * frontend cannot act on differently anyway — it retries, or it shows the
 * existing error state.
 *
 * WHAT IS DELIBERATELY NOT DONE. This does not retry: the 502 is terminal, and a
 * retry here would multiply the very hold-time this function exists to bound.
 * This also does not distinguish the timeout in the message, because the message
 * is what the client displays and "the sheet service did not respond in time" is
 * not a more actionable thing to show a user than "failed to read the
 * leaderboard". The `console.error` below is where the distinction lives, for the
 * operator reading the logs.
 *
 * @param {string} url         absolute Sheets URL to fetch
 * @param {string} message     the 502 message to use for a non-2xx response
 * @returns {Promise<Response>} the ok `Response`; the caller does the parsing
 */
const fetchSheets = async (url, message) => {
  let response;

  try {
    response = await fetch(url, { signal: AbortSignal.timeout(SHEETS_REQUEST_TIMEOUT_MS) });
  } catch (error) {
    // `AbortSignal.timeout` rejects with a `TimeoutError`-named DOMException, and
    // a peer reset raises a `TypeError`; both land here. Both mean the same thing
    // to the caller, so they are not distinguished. `error.name` is logged rather
    // than the error object alone because a raw `DOMException` stringifies to
    // an empty message and would log as a bare blank.
    console.error(
      `[bootcamp-leaderboard] outbound Sheets request failed: ${error?.name || 'Error'}`,
    );
    throw new ApiError(502, message);
  }

  // The existing 502 branch, unchanged: a non-2xx is still "upstream said no".
  if (!response.ok) {
    throw new ApiError(502, message);
  }

  return response;
};

/**
 * Fetches and reshapes the bootcamp leaderboard.
 *
 * `res.set('Cache-Control', 'no-store')` — the shim QUEUES this header rather
 * than writing it, and in practice it is redundant: `http.js`'s
 * `finalizeResponse` unconditionally overwrites `Cache-Control` with `no-store`
 * on every response, so the value the wrapper writes is the value this line
 * asks for. It is preserved because the request for it is the intent, and
 * because the moment `http.js` ever stops forcing `no-store` this line is what
 * documents that a leaderboard must not be cached. (It also would not be cached
 * anyway — `http.js` never emits an `ETag` or a `Last-Modified`.)
 */
export const getBootcampLeaderboard = async (req, res) => {
  const apiKey = process.env.GOOGLE_SHEETS_API_KEY;
  const sheetId = process.env.BOOTCAMP_SHEET_ID;

  // 500, not 503 and not 404. This is a SERVER CONFIGURATION problem, not a
  // client mistake, and the distinction matters: a 4xx here would be the
  // frontend retrying or reporting a user error for something only a deploy can
  // fix. It is also why both variables are tested together — a half-configured
  // deploy fails the same way as an unconfigured one rather than producing a
  // confusing "invalid key" 502 from Google.
  if (!apiKey || !sheetId) {
    throw new ApiError(500, 'Bootcamp leaderboard is not configured');
  }

  // TWO REQUESTS, NOT ONE. The first fetches only `sheets.properties` — a
  // metadata call — to discover the FIRST TAB's title. The range in the second
  // request has to name a tab, and the Sheets API requires the title rather
  // than an index, so the tab name genuinely cannot be guessed. `fields=` keeps
  // the first response tiny.
  const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?key=${apiKey}&fields=sheets.properties`;
  // Through `fetchSheets`, not a bare `fetch`: this is the first of the two
  // SEQUENTIAL calls, so an unbounded one here is what lets an unauthenticated
  // caller pin an invocation. The 502 message here is the metadata-specific one
  // so the operator can tell which of the two calls failed.
  const metaRes = await fetchSheets(metaUrl, 'Failed to read bootcamp sheet metadata');

  const meta = await metaRes.json();
  const firstSheet = meta.sheets?.[0]?.properties?.title;

  // A sheet with no readable tabs is a 502 rather than an empty 200, so the
  // client can tell "the organiser has not published a tab yet" apart from
  // "the competition is over and the tab has no rows".
  if (!firstSheet) {
    throw new ApiError(502, 'Bootcamp sheet has no readable tabs');
  }

  // A1:G100 — seven columns, matching the `row[0]`..`row[6]` reads in
  // `normalizeRows`. The cap at row 100 is a bound on a public endpoint's
  // outbound request; the competition is far smaller than that.
  const range = encodeURIComponent(`${firstSheet}!A1:G100`);
  const valuesUrl = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}?key=${apiKey}`;
  // Second and last of the SEQUENTIAL calls. Budgeted independently of the
  // metadata call above — see `SHEETS_REQUEST_TIMEOUT_MS` for why per-call
  // rather than per-request.
  const valuesRes = await fetchSheets(valuesUrl, 'Failed to read bootcamp leaderboard data');

  const json = await valuesRes.json();
  // `?? []` rather than `|| []`: `normalizeRows` reads `.length`, and a
  // successful Sheets response with an entirely empty range OMITS `values`
  // rather than returning `[]`, so without this the handler would throw a
  // TypeError and 500 instead of returning an empty leaderboard.
  const leaderboard = normalizeRows(json.values ?? []);

  return res
    .set('Cache-Control', 'no-store')
    .status(200)
    .json(new ApiResponse(200, leaderboard, 'Leaderboard fetched'));
};
