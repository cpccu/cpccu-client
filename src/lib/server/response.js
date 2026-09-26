import 'server-only';

/**
 * Port of `cpccu-server/src/utils/ApiResponse.js`.
 *
 * `success` is derived, not passed: any status below 400 is a success. That means
 * a 3xx redirect produced through this class is flagged `success: true`, which is
 * almost certainly not what a caller intends — do not "fix" the comparison
 * without auditing every call site.
 */
class ApiResponse {
  constructor(statusCode, data, message = 'Success') {
    this.statusCode = statusCode;
    this.data = data;
    this.message = message;
    this.success = statusCode < 400;
  }
}

/**
 * FOUR distinct response envelopes coexist in this codebase. They are NOT
 * interchangeable and must NOT be normalised in this migration:
 *
 *  1. `ApiResponse`        -> { statusCode, data, message, success }
 *  2. errors (`ApiError`) -> { status,      message, errors? }
 *  3. certificate handlers -> { success, data } on success,
 *                             { success: false, message } on failure
 *  4. visitor handlers     -> { count } or { success, count }
 *
 * Note that (1) and (2) use DIFFERENT status keys (`statusCode` vs `status`) and
 * (2) is the only one with `errors`. Any unification is an API-breaking change
 * that the frontend must be migrated against in the same commit; collapsing them
 * "while porting" would silently break whichever client branch reads the
 * removed key. Port each handler faithfully and leave the shape it had.
 */
export { ApiResponse };
