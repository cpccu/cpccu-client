import 'server-only';

/**
 * Lazy environment validation for the server foundation.
 *
 * WHY THIS EXISTS — a missing secret otherwise produces a SILENT TOTAL OUTAGE
 * rather than a diagnosable error. `jsonwebtoken` does not throw "no secret
 * configured"; it throws `secretOrPublicKey must have a value` from inside
 * `jwt.verify`, and `auth.js` catches EVERY error out of `jwt.verify` and
 * converts it to a generic `401 Invalid access token`. So with
 * `ACCESS_TOKEN_SECRET` unset, every user on the site is signed out, every login
 * returns the same unauthenticated-looking 401, the browser shows an ordinary
 * "please log in" state, and nothing anywhere says "your environment variable is
 * missing". The same applies to `MONGODB_URI`, which otherwise string-concatenates
 * into the nonsense host `"undefined/CPCCU"` and surfaces as a DNS failure.
 *
 * WHY IT IS NOT CALLED AT MODULE IMPORT — `cpccu-server/src/config/…` and the
 * original Firebase/Cloudinary config modules all validated at top level, and
 * that is precisely the bug this migration is fixing. A top-level throw in
 * `constants.js` (transitively imported by nearly every server module) fails
 * `next build` for EVERY route, including ones that never touch auth or the
 * database, and makes the project impossible to build without production
 * secrets present. The error is raised on FIRST USE of the secret instead, which
 * fails the single request that needs it, with a message that names the
 * variable.
 */

/**
 * The variables required before a server module may be used. Every entry is
 * load-bearing for authentication or persistence; none of them have a safe
 * default that could be invented at runtime.
 */
const REQUIRED_ENV_VARS = [
  'ACCESS_TOKEN_SECRET',
  'REFRESH_TOKEN_SECRET',
  'PASSWORD_TOKEN_SECRET',
  'MONGODB_URI'
];

/**
 * Throws a single, aggregated, SECRET-FREE error naming every missing variable.
 *
 * The message lists variable NAMES only — never values, never a length or a
 * prefix. A thrown error is frequently logged verbatim and sometimes reaches a
 * client through the non-production branch of `toErrorResponse`, so anything
 * interpolated here must be safe to publish.
 *
 * Aggregating (rather than failing on the first missing name) is deliberate:
 * a developer setting up a fresh checkout otherwise fixes one variable, rebuilds,
 * and discovers the next one, one deploy at a time.
 *
 * @returns {void} throws when anything required is absent
 */
function validateEnv() {
  const missing = REQUIRED_ENV_VARS.filter((name) => !process.env[name]);

  if (missing.length) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(', ')}. ` +
        'Set them in your environment before using the server foundation.'
    );
  }
}

export { REQUIRED_ENV_VARS, validateEnv };
