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
  const metaRes = await fetch(metaUrl);

  // 502 = bad gateway, which is what this is: WE are up, Google is not
  // answering us. 500 would claim the leaderboard itself is broken.
  if (!metaRes.ok) {
    throw new ApiError(502, 'Failed to read bootcamp sheet metadata');
  }

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
  const valuesRes = await fetch(valuesUrl);

  if (!valuesRes.ok) {
    throw new ApiError(502, 'Failed to read bootcamp leaderboard data');
  }

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
