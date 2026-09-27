import 'server-only';

import { cookies } from 'next/headers';
import jwt from 'jsonwebtoken';
import { COOKIE_OPTIONS } from '@/lib/server/constants';
import { validateEnv } from '@/lib/server/env';
import { ApiError, resolveVerboseErrors } from '@/lib/server/errors';
import { parseCookies } from '@/lib/server/request';
import { User } from '@/lib/server/models/user.model';

/**
 * Resolves the signing secrets, validating the environment on FIRST USE.
 *
 * `validateEnv()` must not run at module scope: a top-level throw in a
 * transitively-imported module fails `next build` for every route, including
 * ones that never authenticate anyone. Called here instead, a missing secret
 * fails exactly the one request that needs it, with a message naming the
 * variable rather than the `secretOrPublicKey must have a value` text that
 * `jwt.verify` raises and that this module's catch block would otherwise
 * flatten into an indistinguishable `401 Invalid access token` for every user.
 */
function signingSecrets() {
  validateEnv();
  return {
    access: process.env.ACCESS_TOKEN_SECRET,
    refresh: process.env.REFRESH_TOKEN_SECRET,
  };
}

/**
 * Port of `cpccu-server/src/middlewares/Auth.middleware.js` (`verifyToken`).
 * The Express plumbing is gone (`next()`, `res.cookie()`); the caller receives
 * a value describing what the response should do instead.
 *
 * Returns `{ user, refreshCookie }`:
 *  - `user`         — the authenticated Mongoose document.
 *  - `refreshCookie`— `null`, or `{ name, value, options }` describing an
 *                     `accessToken` cookie that the caller MUST attach to its
 *                     outgoing response. It is returned rather than written
 *                     because a route handler has no `res`.
 *
 * @returns `{ user, refreshCookie }`
 * @warning `user` is the raw Mongoose document and MUST NOT be serialised
 *   directly into a response body without an explicit field projection. Both
 *   projections below are projection STRINGS that exclude `password` and
 *   `refreshTokens`, but a document also carries every other schema field —
 *   including internal operational fields added by a later schema change. A
 *   controller that does `NextResponse.json({ data: user })` publishes whatever
 *   the schema happens to contain today and silently widens the response
 *   surface tomorrow. Always project the fields the endpoint actually returns
 *   (see `PUBLIC_ITEM` in `constants.js` for the list the frontend reads).
 *
 * The refresh side effect is the whole point of this function. See the
 * `TokenExpiredError` branch below before touching it.
 */
async function verifyToken(request) {
  const secrets = signingSecrets();
  const cookiesFromRequest = parseCookies(request);
  const authorization = request?.headers?.get('authorization');

  // COOKIE FIRST, header second — this precedence is preserved from
  // `Auth.middleware.js:7-9`.
  //
  // DO NOT "FIX" THIS INTO A PROPER PREFIX CHECK. `String.prototype.replace`
  // with a STRING first argument replaces the FIRST OCCURRENCE ANYWHERE IN THE
  // VALUE, not a leading one, so `authorization?.replace('Bearer ', '')` turns
  // `XBearer eyJ…` into `X eyJ…`. That is a bug in the strict sense, and it is
  // preserved deliberately because it FAILS CLOSED: the mangled string is not a
  // valid JWT, `jwt.verify` rejects it, and the request is 401'd. A "corrected"
  // version that accepts a token found anywhere in the header would be a
  // WEAKENING — it would start accepting values a strict client never sends.
  // The correct fix, if one is ever wanted, is a `^Bearer\s+` anchored match,
  // which preserves fail-closed behaviour; it must not become a `.split()`,
  // a `.includes('Bearer')` guard, or an `authorization.slice(7)`.
  const accessToken =
    cookiesFromRequest?.accessToken || authorization?.replace('Bearer ', '');

  if (
    !accessToken ||
    typeof accessToken !== 'string' ||
    accessToken.trim() === ''
  ) {
    throw new ApiError(401, 'Unauthorized request');
  }

  try {
    const verifiedToken = jwt.verify(accessToken, secrets.access, {
      // The algorithm is PINNED rather than left to jsonwebtoken's default. v9
      // currently defaults to the HS family, so this is not exploitable today —
      // but a default is not a decision, and it is the kind of thing a future
      // major version of the library (or a switch to a JWKS-based verifier)
      // changes silently. Pinning makes "HMAC, and only HMAC" an explicit,
      // reviewable property of this call site.
      algorithms: ['HS256'],
    });

    const existedUser = await User.findById(verifiedToken._id).select(
      '-password -refreshTokens',
    );

    // `isValid: false` is a soft-disable flag. A user with a still-unexpired,
    // still-correctly-signed token must be rejected anyway — this is the
    // account-disable switch, so it is checked separately from existence.
    if (!existedUser || !existedUser.isValid) {
      throw new ApiError(401, 'Unauthorized request');
    }

    return { user: existedUser, refreshCookie: null };
  } catch (error) {
    console.error('Token verification error:', error);

    // An `ApiError` here is one WE threw from inside the try above (the
    // `!user || !user.isValid` guard), not a `jsonwebtoken` failure. The Express
    // original let it fall through to `throw new ApiError(401, error.message)`,
    // which round-tripped the message 'Unauthorized request' back to the client
    // — so the observable behaviour for a missing or soft-disabled account is
    // 401 'Unauthorized request'. Rethrowing as-is preserves that exactly, and
    // keeps 'Invalid access token' meaning "the token itself was bad" rather
    // than overloading it for "your account is not active".
    if (error instanceof ApiError) throw error;

    if (error.name === 'TokenExpiredError') {
      // DO NOT DROP THIS BRANCH. `ACCESS_TOKEN_EXPIRE=15m`, so without the
      // transparent refresh below every single user is hard-logged-out roughly
      // every 15 minutes — with no visible failure, no error banner, and no
      // server-side signal beyond one 401. The symptom is users being "randomly
      // logged out" in the middle of a form, and it looks like a frontend bug.
      const refreshToken = cookiesFromRequest?.refreshToken;

      if (!refreshToken) {
        throw new ApiError(401, 'Unauthorized request');
      }

      try {
        const verifiedRefreshToken = jwt.verify(
          refreshToken,
          secrets.refresh,
          // Pinned for the same reason as the access token above.
          { algorithms: ['HS256'] },
        );

        // `-refreshTokens` is excluded HERE as well as on the access path. The
        // Express original selected only `-password` on this branch, so the
        // returned document carried EVERY LIVE 7-day refresh token string, and
        // any controller that serialises the authenticated user handed all of
        // them to the browser — a credential leak, and a self-inflicted one,
        // since the browser then holds a live session token for every device that
        // account has ever signed in from. Reproducing a credential leak into
        // new architecture is not acceptable, so this is a DELIBERATE DIVERGENCE
        // from the original.
        //
        // The consequence is that the live-token revocation check CANNOT be run
        // on this document: `select('-refreshTokens')` removes the field
        // entirely, so `user.refreshTokens` is `undefined` and calling `.some`
        // on it would throw a `TypeError` — which the catch below turns into a
        // blanket 401 and thereby logs EVERY user out every 15 minutes. The
        // check is therefore performed against a second, tightly-projected query
        // whose result never leaves this function.
        const user = await User.findById(verifiedRefreshToken._id).select(
          '-password -refreshTokens',
        );

        if (!user || !user.isValid) {
          throw new ApiError(401, 'Invalid refresh token');
        }

        // The refresh token must match a LIVE entry on the user document, not
        // merely verify cryptographically. That indirection is what allows a
        // token to be revoked server-side (logout-all, password change) without
        // rotating the signing secret. Projecting to `refreshTokens` alone and
        // reading it as a lean object keeps every token string inside this
        // function — it is never attached to the document handed back to the
        // route handler. One extra query on this path is the right trade: it
        // runs at most once per user per access-token lifetime, and the
        // alternative is publishing the tokens themselves.
        const liveTokens = await User.findById(user._id)
          .select('refreshTokens')
          .lean();

        if (
          !liveTokens?.refreshTokens?.some(
            (rt) => rt.token === refreshToken && rt.expire > Date.now(),
          )
        ) {
          throw new ApiError(401, 'Invalid refresh token');
        }

        const newAccessToken = user.generateAccessToken();

        // The Express original called `res.cookie(...)` here. In App Router the
        // caller has no response object at auth time, so the instruction to
        // re-issue the cookie is returned and applied by the route handler via
        // `applyAuthCookie()`.
        return {
          user,
          refreshCookie: {
            name: 'accessToken',
            value: newAccessToken,
            options: COOKIE_OPTIONS,
          },
        };
      } catch (refreshTokenError) {
        // `?.message` is REQUIRED, not defensive tidiness. A `throw` of a
        // non-Error (a string, a number, a rejected promise from third-party
        // code) has no `.message`, and reading the property inside this catch
        // would throw a `TypeError` that ESCAPES the catch entirely — replacing
        // a clean 401 with an unhandled error and losing the whole request.
        console.error(
          'Error verifying refresh token:',
          refreshTokenError?.message ?? refreshTokenError,
        );
        throw new ApiError(401, 'Invalid refresh token');
      }
    }

    // SECURITY — deliberate divergence from the Express original.
    // The original returned `error.message` verbatim, which is raw
    // `jsonwebtoken` text such as "jwt malformed", "invalid signature" or
    // "jwt expired" (this is the non-expiry path, so not "expired"). That is a
    // free oracle for an attacker probing token forgery: the difference between
    // "malformed" and "invalid signature" tells them whether their forged token
    // was structurally well-formed. The 401 and the response SHAPE are
    // unchanged; only the message is generalised.
    //
    // THE GATE IS `resolveVerboseErrors()`, NOT `NODE_ENV` — CHANGED 2026-09.
    // This branch used to test `process.env.NODE_ENV === 'production'` on its
    // own, and that is not a safe gate: `NODE_ENV` is set by the build and by
    // the platform, neither of which is under the application's control, so a
    // real host configured to build with it unset — or to `development`, or to a
    // staging value — serves a PRODUCTION database while taking the
    // non-redacting branch here and returning "jwt malformed" / "invalid
    // signature" verbatim. That is precisely the forgery oracle the paragraph
    // above exists to prevent, re-enabled through a mis-set build variable, and
    // it is invisible: the only symptom is that some 401 bodies get more
    // interesting.
    //
    // `errors.js` introduced `VERBOSE_ERRORS` for exactly this reason, and its
    // own comment states that `NODE_ENV` "is not under the application's
    // control" — but the fix was never applied here, so the two redactions in
    // this codebase disagreed about when they applied and this one was the
    // unsafe half. Both now call the same shared resolution, so the rule cannot
    // drift apart again.
    //
    // THE BEHAVIOURAL DELTA, stated exactly so it can be reviewed as one: with
    // `VERBOSE_ERRORS` UNSET — the case for every existing deployment — this is
    // unchanged, because `resolveVerboseErrors()` reduces to
    // `NODE_ENV !== 'production'`, which is the complement of the test that was
    // here. The change is in the two overridden directions: `VERBOSE_ERRORS=false`
    // now REDACTS on a non-production host (closing the finding), and
    // `VERBOSE_ERRORS=true` now RETURNS the raw text on a production host, which
    // is the documented escape hatch for debugging a live deployment.
    //
    // THE GATE IS NEGATED, AND THAT IS THE WHOLE POINT OF THE CHANGE. The
    // original condition was `NODE_ENV === 'production'` — i.e. "redact when
    // production" — and `resolveVerboseErrors()` answers the OPPOSITE question
    // ("may I be verbose?"). Negating it is the only correct translation: the
    // redacting branch is the one taken when the answer is NO.
    //
    // Getting this backwards is a silent, total opening of the oracle in the
    // exact configuration the change was made to protect — a production host
    // that has never set `VERBOSE_ERRORS` would return raw `jsonwebtoken` text.
    // It shipped inverted in the first draft of this change and was caught by
    // `test/error-redaction.test.js`, which asserts the four
    // (NODE_ENV × VERBOSE_ERRORS) combinations against what a client would
    // actually receive. `NODE_ENV=production` with the override ABSENT is
    // asserted to be the REDACTED case precisely because that is the default
    // every real deployment runs, and it is the one a sign-inverted gate gets
    // wrong.
    if (!resolveVerboseErrors()) {
      console.error('Non-expiry JWT error:', error.name, error.message);
      throw new ApiError(401, 'Invalid access token');
    }

    // The developer-facing branch. It is reachable ONLY when
    // `resolveVerboseErrors()` is true, which now means an explicit
    // `VERBOSE_ERRORS=true` OR a genuinely non-production host — never a
    // production one, which the test above handles. A developer debugging an
    // expired or malformed token still gets the actual `jsonwebtoken` message,
    // because the single most useful diagnostic is otherwise discarded with no
    // trace: the raw text is logged on the redacted path above and nowhere else.
    throw new ApiError(401, error.message || 'Unauthorized request');
  }
}

/**
 * Applies a `refreshCookie` returned by `verifyToken` to the outgoing response.
 * A no-op when there is nothing to refresh, so a route handler can call it
 * unconditionally after authenticating.
 *
 * USES `cookies()` FROM `next/headers`, NOT `response.cookies`. `response.cookies`
 * only exists on a `NextResponse`, and the natural composition of this module's
 * own helpers produces a bare `Response` — `toErrorResponse` returns a plain
 * `{ status, body }` pair and `rateLimitResponse` returns a plain `new Response`.
 * Reaching for `response.cookies.set(...)` there is
 * `TypeError: Cannot read properties of undefined (reading 'set')`, and because
 * the throw happens AFTER `verifyToken` has already succeeded, a perfectly valid
 * session 500s instead of being refreshed — a large fraction of all traffic,
 * which is exactly the "random ~50% logout rate" the refresh path exists to
 * prevent.
 *
 * `cookies()` is mutable inside a Route Handler, so this needs no `NextResponse`
 * and works whether or not the caller has one.
 *
 * ASYNC BY NECESSITY: from Next 15 onward `cookies()` returns a promise, so it
 * must be awaited before `set`. It is a no-op when there is nothing to refresh,
 * which keeps the common (no-refresh) path allocation-free.
 */
async function applyAuthCookie(response, refreshCookie) {
  if (!refreshCookie) return response;

  const { name, value, options } = refreshCookie;
  const store = await cookies();
  store.set(name, value, options);
  return response;
}

export { applyAuthCookie, verifyToken };
