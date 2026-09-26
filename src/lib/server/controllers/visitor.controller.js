import 'server-only';

import { Visitor } from '@/lib/server/models/visitor.model';
import { VISITOR_RECORD_NAME } from '@/lib/server/constants';

/**
 * Port of `cpccu-server/src/controllers/visitor.controller.js`.
 *
 * ============================ THE ODD ONE OUT (2 of 4) ============================
 * Like the certificate handlers and unlike everything else, these two do NOT
 * use `ApiResponse`. Their envelope is envelope #4 of the four documented in
 * `response.js`:
 *
 *     getVisitorCount      ->  { count }                      (success AND failure)
 *     incrementVisitor     ->  { success, count }
 *
 * Note the asymmetry inside `getVisitorCount`: the 500 branch returns
 * `{ count: 0 }` with NO `success` key, so a client cannot distinguish "zero
 * visitors so far" from "the database was unreachable" by the presence of a
 * flag — only by the status code. That is preserved exactly.
 *
 * `VISITOR_RECORD_NAME` moved to `constants.js` in Phase 2 to break a circular
 * import (`services/statistics.service.js` needs it and this controller is
 * imported by that service's consumers). It is re-exported below under its
 * original name so anything that imported it from here still resolves; the
 * value itself is unchanged.
 */

/**
 * The cumulative visitor count.
 *
 * `visitor?.count || 0` covers BOTH "no counter document yet" and "the counter
 * document exists but its count is 0". The `?.` is what keeps a first-ever
 * request from throwing on `null.count` — `getVisitorCount` is mounted on the
 * site root path in the original (`app.use('/api', visitorRoutes)`), so it is
 * the highest-traffic endpoint in the API and the most likely to be the one
 * that hits a cold database.
 */
export const getVisitorCount = async (req, res) => {
  try {
    const visitor = await Visitor.findOne({ name: VISITOR_RECORD_NAME });

    res.status(200).json({ count: visitor?.count || 0 });
  } catch (error) {
    console.error('Visitor Error:', error);
    // Returns 200-shaped data on a 500 rather than throwing. Deliberate: this
    // handler is called on page load, and a visitor counter is decoration —
    // failing the whole page render because a count could not be read is the
    // wrong trade. The 500 status still reaches monitoring, and the `console.error`
    // is the only server-side signal.
    res.status(500).json({ count: 0 });
  }
};

/**
 * Increments the counter and returns the new total.
 *
 * `findOneAndUpdate` with `$inc` + `upsert: true` is a SINGLE ATOMIC DOCUMENT
 * OPERATION, and that is the whole reason this is not the naive
 * `getVisitorCount` + `set` sequence. On a site with concurrent requests the
 * read-then-write version loses updates: two simultaneous page loads both read
 * `count: 100`, both write `101`, and one increment vanishes. `$inc` is applied
 * by MongoDB under a document lock, so both land and the returned value is the
 * true post-increment total. `upsert` creates the singleton document on the very
 * first call instead of requiring a seed.
 *
 * `new: true` returns the document AFTER the increment — without it the
 * response would report the pre-increment count and the displayed total would
 * always be one behind.
 */
export const incrementVisitor = async (req, res) => {
  try {
    const visitor = await Visitor.findOneAndUpdate(
      { name: VISITOR_RECORD_NAME },
      { $inc: { count: 1 } },
      {
        new: true,
        upsert: true,
      },
    );

    res.status(200).json({ success: true, count: visitor.count });
  } catch (error) {
    console.error('Visitor Error:', error);
    // `success: false` here but NO `success` key in `getVisitorCount`'s 500 —
    // see the module docblock. Both are the original's behaviour.
    res.status(500).json({ success: false, count: 0 });
  }
};

// Re-exported under its original name so an import of
// `@/lib/server/controllers/visitor.controller` for the constant keeps working.
// The value lives in `constants.js` now; see the note there about the import
// cycle this broke.
export { VISITOR_RECORD_NAME };
