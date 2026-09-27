import 'server-only';

import jwt from 'jsonwebtoken';

import {
  COOKIE_OPTIONS,
  OTP_TIME,
  PUBLIC_ITEM,
  RESET_TIME,
  TOKEN_TIME,
} from '@/lib/server/constants';
import { ApiError } from '@/lib/server/errors';
import { sendWelcomeEmail } from '@/lib/server/email';
import { User } from '@/lib/server/models/user.model';
import {
  passwordPolicyMessage,
  validatePasswordStrength,
} from '@/lib/server/passwordPolicy';
import { ApiResponse } from '@/lib/server/response';
import { generateOTP, sendOTP } from '@/lib/server/sentOtp';

/**
 * Port of `cpccu-server/src/controllers/auth.controller.js`.
 *
 * The bodies below are UNCHANGED from the Express original, including their
 * bugs. `asyncHandler` is gone (the route awaits the handler directly and
 * `apiRoute` does the error shaping), every `res.*` call is served by the shim
 * in `shim.js`, and the only edits are the documented divergences at the points
 * where they are made. The one item that is NOT a port at all — the Google
 * sign-in endpoints, which are deliberately not migrated — is recorded in the
 * NOT-MIGRATED note below.
 */

/**
 * Maximum wrong OTP guesses allowed against a single pending code. Reaching
 * this limit destroys the code so it can never be brute forced; the account
 * owner must request a fresh one (POST /auth/send-otp).
 */
const MAX_OTP_ATTEMPTS = 5;

/* ============================================================================
 * NOT MIGRATED — GOOGLE SIGN-IN. A DELIBERATE, PERMANENT SCOPE REDUCTION.
 * ============================================================================
 *
 * `POST /api/v1/auth/google-signin` and `POST /api/v1/auth/google-signup` are
 * NOT migrated. The Express backend had both — `cpccu-server/src/routes/auth.route.js:51-52`
 * wired `googleLoginHandler` and `googleRegiHandler` from
 * `cpccu-server/src/controllers/auth.controller.js:500,561` — and neither is
 * reachable here. Two independent reasons, both deliberate:
 *
 *   1. THE CLIENT NEVER CALLED THEM. There is no reference to `google-signin`
 *      or `google-signup` anywhere under `src/`; `authApi.js` has seven
 *      endpoints and none of them are Google. The feature was dead on arrival,
 *      and the Express handlers were reachable only by hand-crafting a request.
 *   2. `firebase-admin` HAS NO PORTED EQUIVALENT AND WAS UNINSTALLED. The
 *      original verified Google's ID tokens with `auth.verifyIdToken`;
 *      `next.config.mjs` records that `firebase-admin` was removed from
 *      `serverExternalPackages` along with it.
 *
 * THIS IS NOT A PORTING OMISSION AND NOT PENDING WORK. An earlier pass at this
 * file kept the two handlers and substituted a hand-rolled ID-token verifier
 * (`node:crypto` + `fetch`, a JWKS certificate cache, `RS256` pinning, an
 * audience check) for the `firebase-admin` call. That substitution has been
 * reverted and deleted. Inventing new security-critical authentication code for
 * a feature nothing calls is the wrong trade in a migration whose entire premise
 * is behavioural fidelity: it creates behaviour no dependency is being asked to
 * preserve, and it makes an identity provider's token validation correct only
 * to the extent that untested hand-written crypto happens to be.
 *
 * IF GOOGLE SIGN-IN IS EVER REQUIRED, REIMPLEMENT IT DELIBERATELY: re-add
 * `firebase-admin` to `serverExternalPackages` in `next.config.mjs` (the WARNING
 * in that file already says so) and route verification back through
 * `auth.verifyIdToken`. NEVER with a hand-rolled JWT/JWKS verifier. Verifying a
 * Google ID token correctly means checking the issuer, checking the audience
 * against this application's OWN OAuth client id, verifying the signature
 * against Google's ROTATING certificates, and deciding what to do about
 * `email_verified`. Every one of those is a security control with a known
 * failure mode — which is exactly why a battle-tested library owns them, and
 * why hand-rolling one is a reliable way to ship a forgery oracle.
 *
 * The `googleID` field deliberately REMAINS on `user.model.js`. Existing Mongo
 * documents carry `googleID` values, so dropping the field would orphan real
 * data, and the three `!this.googleID` conditional validators still correctly
 * govern credential-based signups ("batch / uniID / password are required for
 * non-Google users"). Do not remove it as part of this cut.
 * ============================================================================ */

// Atomically record a failed verification attempt. The update is guarded on
// the exact code the attempt was checked against, so a concurrent resend
// (which rotates the code) is never penalised for guesses at the old one.
const recordFailedOtpAttempt = async (userId, storedCode) => {
  const updatedUser = await User.findOneAndUpdate(
    {
      _id: userId,
      'otp.code': storedCode,
      'otp.attempts': { $lt: MAX_OTP_ATTEMPTS },
    },
    { $inc: { 'otp.attempts': 1 } },
    { new: true },
  );

  if (!updatedUser || updatedUser.otp?.attempts >= MAX_OTP_ATTEMPTS) {
    // Budget exhausted: invalidate the code so even the correct value can no
    // longer complete verification.
    await User.updateOne(
      { _id: userId, 'otp.code': storedCode },
      { $set: { otp: {} } },
    );
  }
};

// ========================= REGISTER =========================
// when user registers account manually
const registrationHandler = async (req, res) => {
  const { email, fullName, batch, password, confirm_password, uniID } =
    req.body;

  const trimmedEmail = (email || '').trim().toLowerCase();
  const trimmedUniID = (uniID || '').trim();

  if (
    !trimmedEmail ||
    !fullName?.trim() ||
    !batch ||
    !password ||
    !trimmedUniID
  ) {
    throw new ApiError(
      400,
      'All fields (Email, Name, Batch, Password, University ID) are required.',
    );
  }

  if (!/^\d+$/.test(trimmedUniID)) {
    throw new ApiError(400, 'University ID must be digits only.', [
      {
        field: 'uniID',
        message:
          'University ID must contain digits only (no symbols or spaces).',
      },
    ]);
  }

  if (password !== confirm_password) {
    throw new ApiError(400, 'Passwords do not match.');
  }

  const passwordValidation = validatePasswordStrength(password);

  if (!passwordValidation.isValid) {
    throw new ApiError(400, passwordPolicyMessage(passwordValidation.errors));
  }

  // Both lookups run CONCURRENTLY (`Promise.all`) rather than sequentially, and
  // both execute even though the result is only used when a field error is
  // actually pushed. That is not an oversight: the two `User.findOne` calls are
  // the endpoint's only database round trips, they are independent, and running
  // them in parallel halves the latency of the slowest registration in the
  // system. It also means the `emailUser` document is loaded BEFORE the write,
  // which the takeover-safe branch below depends on.
  const duplicateChecks = await Promise.all([
    User.findOne({ email: trimmedEmail }),
    trimmedUniID
      ? User.findOne({ uniID: trimmedUniID })
      : Promise.resolve(null),
  ]);

  const emailUser = duplicateChecks[0];
  const uniIDUser = duplicateChecks[1];

  const fieldErrors = [];
  if (emailUser?.isValid) {
    fieldErrors.push({
      field: 'email',
      message:
        'This email address is already registered. Please sign in or use a different email.',
    });
  }
  // The `emailUser._id !== uniIDUser._id` guard is what stops a user who
  // re-registers with BOTH their own email and their own uniID from being told
  // "that Student ID is already registered" about themselves.
  if (
    uniIDUser &&
    (!emailUser || emailUser._id.toString() !== uniIDUser._id.toString())
  ) {
    fieldErrors.push({
      field: 'uniID',
      message:
        'This Student ID is already registered. Please contact an administrator if you believe this is a mistake.',
    });
  }
  if (fieldErrors.length > 0) {
    throw new ApiError(409, 'Validation failed', fieldErrors);
  }

  const [otp, code] = generateOTP(OTP_TIME);

  let user;

  if (emailUser) {
    // An account already exists for this email but the owner has not verified
    // it yet. Never let a re-registration replace the pending account's
    // credentials or identity: otherwise anyone could pre-register a victim's
    // email, choose a password, and own the account once the victim completes
    // OTP verification. Preserve the existing account and only issue a fresh
    // OTP (with the failed-attempt budget reset).
    emailUser.otp = { ...otp, attempts: 0 };
    user = await emailUser.save();
  } else {
    user = await User.create({
      email: trimmedEmail,
      fullName,
      batch,
      password,
      uniID: trimmedUniID,
      otp: { ...otp, attempts: 0 },
      isValid: false,
    });
  }
  // 3. Send OTP
  try {
    // The 4th parameter is `sendOTP`'s `data` bag, and the USER DOCUMENT is
    // passed deliberately: `sentOtp.js` reads `data.fullName` to address the
    // email, and a Mongoose document exposes `fullName` as a plain property, so
    // the call works without a `{ fullName: user.fullName }` wrapper. Preserved
    // as-is — it also keeps the whole document out of the template's hands only
    // because the template reads one field, which is a coincidence, not a
    // guarantee.
    await sendOTP(email, code, 'registration', user);
  } catch (error) {
    console.error('Registration OTP Error:', error);

    throw new ApiError(500, 'Failed to send registration OTP');
  }
  // ============================ RESPONSE PROJECTION (L4) ============================
  // THE PICKED VERSION WAS `toObject()` + `delete password` + `delete otp`, a
  // DENY-LIST. A deny-list is only as good as the set of fields somebody
  // remembered to delete, and this document carries two more secrets: the
  // `refreshTokens` array (a live, signed session token per device — reading one
  // is reading a session) and `resetOTP` (a live password-reset code). Both are
  // empty for a pending account only by INVARIANT, not by construction: a
  // re-registration of an existing pending address takes the
  // `emailUser.save()` branch above, and nothing in that branch clears them.
  // The moment a future change reuses a document that has been through a login
  // or a reset request, the same three-line deny-list starts serialising a
  // refresh token to an anonymous caller.
  //
  // An ALLOW-LIST FIXES THAT BY CONSTRUCTION: a field is in the response because
  // it is named, and adding a secret to the schema cannot leak by omission. It
  // is a deliberate widening of the deny-list's effect and a narrowing of its
  // surface, so the two are not equivalent — the reason a projection query is
  // used rather than filtering `toObject()` in JS is that `PUBLIC_ITEM` is then
  // the SAME string every other user-returning read uses (`loginHandler`,
  // `getUserInfo`, …) and the two cannot drift apart.
  //
  // THE EXTRA ROUND TRIP IS THE PRICE and is accepted deliberately: a fresh
  // `.select(PUBLIC_ITEM)` read rather than filtering the already-loaded
  // document in memory, because the in-memory version would need its own copy of
  // the field list and that copy is exactly the thing that drifts. This endpoint
  // runs once per human registration.
  //
  // CLIENT IMPACT: NONE. `Signup.jsx:88` reads `response?.data?.user?._id ??
  // response?.data?._id ?? response?._id` and nothing else off the returned
  // document, and `_id` is the first field in `PUBLIC_ITEM`. The error path
  // reads `data.errors` / `data.message` from the ENVELOPE, which is unchanged.
  const userResponse = await User.findById(user._id).select(PUBLIC_ITEM);

  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        userResponse,
        'Registration successful. Please verify the OTP sent to your email.',
      ),
    );
};

// ========================= VERIFY OTP =========================

const verifyOTPHandler = async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    throw new ApiError(400, 'Email and OTP are required');
  }

  const user = await User.findOne({ email });

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  // Check OTP validity and expiration
  const storedCode = user.otp?.code;
  const isOtpCorrect = await user.isOTPcorrect(otp);
  const isOtpExpired = user.isOTPExpired();

  if (!isOtpCorrect) {
    // Count the failure before rejecting so repeated guesses against the same
    // pending code are capped, and the code is destroyed once the budget runs
    // out. The increment is a single atomic $inc guarded on the stored code,
    // so simultaneous requests cannot reset or undershoot the count.
    if (storedCode) {
      await recordFailedOtpAttempt(user._id, storedCode);
    }
    throw new ApiError(401, 'Invalid OTP');
  }

  if (isOtpExpired) {
    // 419 is the non-standard "OTP expired" status this codebase uses; it is
    // preserved because the client branches on it to offer a resend instead of
    // the generic "invalid code" message.
    throw new ApiError(419, 'OTP has expired');
  }

  // Update user to set OTP as verified
  user.isValid = true;
  user.otp = {}; // Clear OTP field

  // `validateBeforeSave: false` is REQUIRED, not an optimisation. Setting
  // `otp = {}` violates the schema's requirement that a pending OTP carry a
  // code, and without this flag the save would fail — leaving the account
  // permanently stuck in the unverified state.
  await user.save({ validateBeforeSave: false });

  // Send the welcome email once registration is complete (fire-and-forget).
  // An email failure must never block OTP verification.
  //
  // ================== WHY THE TWO FIELDS ARE SNAPSHOTTED FIRST (L7) ==================
  // This promise is DETACHED — it is not awaited — and a detached promise
  // INHERITS the ambient `AsyncLocalStorage` context. `handler.js` opens that
  // store with `{ request, routeContext }`, so holding the store holds a
  // reference to the `Request` (and, for a route that read a body, whatever the
  // body cache memoised against it) for as long as the email send takes —
  // seconds to tens of seconds of outbound Resend latency, and minutes if the
  // provider is slow. On a 2 GB instance that is avoidable retention created
  // after the response has already been produced.
  //
  // Reading the two values into locals BEFORE the call is what breaks the
  // reference: what the `.catch` closure captures is two strings, not a
  // `this`-bound Mongoose document reached through the request. The email is
  // then fired from a code path that touches nothing ALS-dependent, so there is
  // nothing for the store to keep alive.
  //
  // THE CONTRACT IS UNCHANGED AND MUST STAY THIS WAY: the promise is NOT
  // awaited. Registration verification must not be able to fail because a
  // transactional email provider is down, and the `.catch` stays so a rejection
  // is logged rather than becoming an unhandled rejection. Do not "tidy" this
  // into an `await` without treating the availability change as a product
  // decision.
  const welcomeEmail = user.email;
  const welcomeName = user.fullName;

  sendWelcomeEmail({ email: welcomeEmail, fullName: welcomeName }).catch(
    (error) => {
      console.error('Welcome Email Error:', error);
    },
  );

  return res
    .status(201)
    .json(new ApiResponse(201, null, 'OTP verified successfully'));
};

// ========================= RESEND OTP =========================

const sendOtpHandler = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    throw new ApiError(400, 'Email is required');
  }

  const user = await User.findOne({ email });

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  const [otp, code] = generateOTP(OTP_TIME);

  // A freshly issued code always resets the failed-attempt budget.
  user.otp = { ...otp, attempts: 0 };

  await user.save();

  try {
    await sendOTP(email, code, 'registration', user);
  } catch (error) {
    console.error('Resend OTP Error:', error);

    throw new ApiError(500, 'Failed to resend OTP');
  }

  return res
    .status(200)
    .json(new ApiResponse(200, null, 'OTP resent successfully'));
};

// ========================= LOGIN =========================

const loginHandler = async (req, res) => {
  const { email, password } = req.body;

  if ([email, password].some((field) => field?.trim() === '' || !field)) {
    throw new ApiError(400, 'All fields are required');
  }

  const user = await User.findOne({ email });

  // `!user.password` is a second guard for accounts created through a path that
  // set no password (e.g. a Google account later matched by email): there is
  // nothing to compare against, and reporting "Invalid credentials" rather than
  // "no such method" keeps the endpoint from confirming which accounts exist.
  if (!user || !user.password) {
    throw new ApiError(401, 'Invalid credentials');
  }

  const isPasswordCorrect = await user.isPasswordCorrect(password);

  if (!isPasswordCorrect) {
    throw new ApiError(401, 'Invalid credentials');
  }

  // An account that has not completed email/OTP verification must never
  // receive an authenticated session, regardless of what the frontend does.
  if (!user.isValid) {
    throw new ApiError(403, 'Please verify your email to continue.', [
      { field: 'email', code: 'EMAIL_NOT_VERIFIED' },
    ]);
  }

  const accessToken = user.generateAccessToken();
  const refreshToken = user.generateRefreshToken();

  // 7 days, from `TOKEN_TIME`. Each login APPENDS a new refresh token rather
  // than replacing the list, which is what makes multi-device sign-in work and
  // what makes server-side revocation of a single device possible.
  const expire = new Date(Date.now() + TOKEN_TIME * 24 * 60 * 60 * 1000);

  user.refreshTokens.push({
    token: refreshToken,
    expire,
  });

  await user.save({ validateBeforeSave: false });

  const loggedInUser = await User.findOne({ email }).select(PUBLIC_ITEM);

  return res
    .status(200)
    .cookie('accessToken', accessToken, COOKIE_OPTIONS)
    .cookie('refreshToken', refreshToken, COOKIE_OPTIONS)
    .json(
      new ApiResponse(
        200,
        // NO `token` IN THE BODY. It used to be `{ user, token: accessToken }`.
        // The same JWT is set, one line above, as an `httpOnly` cookie, and
        // returning a second copy in readable JSON defeats the entire purpose of
        // `httpOnly`: any XSS on this origin can read `response.data.token` out
        // of memory and exfiltrate it, whereas the cookie is unreachable from
        // JavaScript by construction. The credential is the cookie; the body
        // carries only who the user is, which is not a secret.
        //
        // The client was changed with this in the same pass — `localStorage` no
        // longer holds a token, and `baseApi.js` no longer attaches an
        // `Authorization` header — so the two halves cannot drift back apart
        // without the client visibly breaking (a 401 on every authenticated
        // query if the body token were relied on and missing).
        { user: loggedInUser },
        'Login successfully',
      ),
    );
};

// ========================= REFRESH TOKEN =========================

const refreshAccessToken = async (req, res) => {
  const incomingRefreshToken = req.cookies?.refreshToken;

  if (!incomingRefreshToken) {
    throw new ApiError(401, 'Unauthorized request');
  }

  // ---------------------------------------------------------------------
  // DIVERGENCE 1 OF 3 (security-mandated): the Express original called
  // `jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET)`
  // UNWRAPPED, so a forged, truncated, expired or non-JWT cookie threw a raw
  // `jsonwebtoken` error which the Express error handler shaped as a 500 whose
  // MESSAGE WAS THE LIBRARY'S OWN TEXT — "jwt malformed", "invalid signature",
  // "jwt expired". Two problems, both real:
  //   1. It is a free forgery oracle. The difference between "malformed" and
  //      "invalid signature" tells an attacker whether their forged token was
  //      even structurally well-formed, which is the first question they need
  //      answered.
  //   2. A failed refresh is a CLIENT condition — the cookie is expired or the
  //      session was revoked — and reporting it as a 500 is a lie that sends
  //      the frontend looking for a server problem, and a malformed cookie on
  //      the auto-refresh path is the single most common occurrence of it.
  // The 401 and the response SHAPE are unchanged; only the status and the
  // message are. The redaction is gated on NODE_ENV to match the identical
  // pattern in `auth.js:235-240`, so a developer can still see the library
  // error locally.
  // ---------------------------------------------------------------------
  let decodedToken;

  try {
    decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET,
    );
  } catch (error) {
    console.error('Refresh token verification failed:', error?.name);

    if (process.env.NODE_ENV === 'production') {
      throw new ApiError(401, 'Invalid refresh token');
    }

    throw new ApiError(401, error?.message || 'Invalid refresh token');
  }

  // `-password` only (NOT `-refreshTokens`), and that is LOAD-BEARING rather
  // than a leak: the next check reads `user.refreshTokens` to confirm the
  // presented token is still a LIVE session entry. Projecting it away would
  // make `.some` throw a TypeError and 401 every refresh. Nothing serialises
  // this document — the response body below is `{ success: true }` only.
  const user = await User.findById(decodedToken._id).select('-password');

  if (!user) {
    throw new ApiError(401, 'Invalid credentials');
  }

  // The account must still be verified, and the presented refresh token must
  // belong to an active session (logout removes the token from refreshTokens,
  // so a token missing from the list can never mint a new access token).
  if (!user.isValid) {
    throw new ApiError(401, 'Unauthorized request');
  }

  if (
    !user.refreshTokens.some(
      (rt) => rt.token === incomingRefreshToken && rt.expire > Date.now(),
    )
  ) {
    throw new ApiError(401, 'Invalid refresh token');
  }

  const renewToken = user.generateAccessToken();

  res
    .status(200)
    .cookie('accessToken', renewToken, COOKIE_OPTIONS)
    .json(
      new ApiResponse(
        200,
        // `{ success: true }`, NOT `{ accessToken }`. The renewed token is the
        // cookie set one line above and is `httpOnly`, so a body copy of it
        // could only ever be read by whatever XSS is already on the page. An
        // explicit `success` flag is kept rather than an empty `{}` so a client
        // can branch on "the refresh worked" without inspecting a shape — the
        // envelope's own `success` is not always in the payload slice, and the
        // `accessToken` key's absence is a much subtler signal to code against
        // than an affirmative one.
        { success: true },
        'Access token renewed successfully',
      ),
    );
};

// ========================= LOGOUT =========================

const logoutHandler = async (req, res) => {
  const user = await User.findById(req.user._id);

  if (!user) {
    throw new ApiError(401, 'Invalid credentials');
  }

  const refreshToken = req.cookies?.refreshToken;

  if (!refreshToken) {
    throw new ApiError(400, 'Refresh token not provided');
  }

  // Revokes THIS device's session by removing its token from the list; other
  // devices' entries survive, which is the whole point of storing a list rather
  // than a single token. The access-token cookie is simply cleared client-side
  // — access tokens are stateless and cannot be revoked, so the browser is the
  // only place they can be invalidated.
  user.refreshTokens = user.refreshTokens.filter(
    (item) => item.token !== refreshToken,
  );

  await user.save({ validateBeforeSave: false });

  res
    .status(200)
    .clearCookie('accessToken', COOKIE_OPTIONS)
    .clearCookie('refreshToken', COOKIE_OPTIONS)
    .json(new ApiResponse(200, {}, 'User logged out successfully'));
};

// ========================= FORGOT PASSWORD =========================

const forgottenPasswordHandler = async (req, res) => {
  // READ FROM THE BODY, NOT FROM `req.params` — CHANGED 2026-09 ALONGSIDE THE
  // `GET` -> `POST` MIGRATION of `POST /api/v1/auth/reset-link`.
  //
  // WHY, AND IT IS THE WHOLE POINT OF THE MIGRATION. The address used to be a
  // PATH SEGMENT (`reset-link/[email]/route.js` served
  // `req.params.email`), which combined with a `GET` verb — and `GET` is in
  // `SAFE_METHODS`, so `assertSameOrigin` was a no-op on the route — meant a
  // bare cross-site `<img src>` or a top-level navigation was enough to make the
  // server send a real CPCCU-branded password-reset mail to an address an
  // attacker chose. That is a mail-bomb and sender-quota-burn primitive, and a
  // phishing lure, and it needed no credential, no script on the page and no
  // CORS. `authEmailRateLimiter` does not cover it: its store is per-INSTANCE,
  // so on Vercel every warm lambda keeps its own counter.
  //
  // A `POST` body cannot be produced by an image tag, a link, or a cross-site
  // navigation, and a cross-origin `POST` of `application/json` is preflighted —
  // so the same-origin check is armed and can refuse the request before any mail
  // goes out. Reading the address from the body is what makes that true; a `GET`
  // route could only read it from the path, which is the exploitable half of the
  // old design. DO NOT REVERT THIS TO `req.params` without also reverting the
  // route back to `GET`, and see that route's docblock for why that is not a
  // change to make.
  //
  // `req.body` may be `null` — the shim passes `null` through for a request with
  // no parseable body rather than coercing it to `{}`, so the destructuring is
  // guarded and the handler raises its own 400 below rather than throwing a
  // `TypeError` that `toErrorResponse` would turn into a 500.
  const email = req.body?.email;

  if (!email || typeof email !== 'string' || email.trim() === '') {
    throw new ApiError(400, 'Email is required');
  }

  const user = await User.findOne({
    email,
    isValid: true,
  });

  // The SUCCESS response is returned IDENTICALLY for "no such account" and
  // "email sent", and the 404 for a missing user is deliberately NOT raised.
  // Answering differently would turn this unauthenticated endpoint into an
  // account-existence oracle: anyone could enumerate registered addresses by
  // watching which ones came back 200-with-mail versus 200-without.
  //
  // THIS IS THE PROPERTY THE `GET` -> `POST` MIGRATION HAD TO PRESERVE, and the
  // migration did not weaken it — the verb changed, the address moved from the
  // path into the body, and both responses are still the same
  // `ApiResponse(200, null, 'Reset link sent successfully!')` below. Asserted in
  // `test/auth-reset-link.test.js` on both paths, so a future change that
  // differentiates them fails a test rather than shipping an enumeration oracle.
  //
  // NOTE THE CORRECTION to the rationale that used to sit here. The old comment
  // justified keeping the address out of the body because "the `email` is in the
  // URL path, so this also keeps it out of a request body that might be logged".
  // That was true when it was written and is no longer a reason for anything: a
  // path segment is logged by every proxy, CDN and access log on the way in, and
  // a body is not — so the original arrangement leaked the address MORE, not
  // less. The property worth preserving is the identical response, which is what
  // the two branches below actually do.
  if (!user) {
    return res
      .status(200)
      .json(new ApiResponse(200, null, 'Reset link sent successfully!'));
  }

  const token = user.generatePasswordToken();

  // `RESET_TIME` (5 minutes) rather than `OTP_TIME` (2): the reset code is
  // paired with a signed token in the email link, so it is two factors and can
  // afford a slightly longer window than a bare registration code.
  const [otp, code] = generateOTP(RESET_TIME);

  const data = {
    fullName: user.fullName,
    token,
    code,
  };

  try {
    await sendOTP(email.trim(), code, 'reset', data);
  } catch (error) {
    console.error('Reset Email Error:', error);

    throw new ApiError(500, 'Failed to send reset email');
  }

  user.resetOTP = otp;

  await user.save();

  return res
    .status(200)
    .json(new ApiResponse(200, null, 'Reset link sent successfully!'));
};

// ========================= RESET PASSWORD =========================

const resetPasswordHandler = async (req, res) => {
  const { code, token, password, retype } = req.body;

  if (password !== retype) {
    throw new ApiError(400, 'Passwords do not match.');
  }

  const passwordValidation = validatePasswordStrength(password);

  if (!passwordValidation.isValid) {
    throw new ApiError(400, passwordPolicyMessage(passwordValidation.errors));
  }

  let decodedToken;

  // NOTE the contrast with `refreshAccessToken` above, which this was changed
  // to MATCH: the original already wrapped this `jwt.verify` and flattened the
  // library error to a bare 'Invalid credentials', so no divergence is needed
  // here. The asymmetry in the source is exactly the bug DIVERGENCE 1 fixes.
  try {
    decodedToken = jwt.verify(token, process.env.PASSWORD_TOKEN_SECRET);
  } catch (error) {
    throw new ApiError(401, 'Invalid credentials');
  }

  const user = await User.findById(decodedToken._id);

  if (!user) {
    throw new ApiError(404, 'User not found');
  }

  const isresetOTPcorrect = await user.isresetOTPcorrect(code);
  const isresetOTPExpired = await user.isresetOTPExpired();

  if (!isresetOTPcorrect) {
    throw new ApiError(401, 'Invalid OTP');
  }

  if (isresetOTPExpired) {
    throw new ApiError(401, 'The OTP has expired. Please request a new one');
  }

  user.password = password;
  user.resetOTP = {};

  // Unlike the OTP-verification path above, this save is fully validated: the
  // new password must satisfy the schema, and the assignment happens through
  // the `pre('save')` hook, so the reset is a single atomic write.
  await user.save();

  // `refreshTokens` is deliberately NOT cleared here. The original did not, and
  // it is a real weakness (a stolen refresh token survives a password reset) but
  // changing it would invalidate every other signed-in device as a side effect
  // of a security fix, which is a product decision, not a porting one. Flagged
  // for a follow-up.

  return res
    .status(200)
    .json(new ApiResponse(200, null, 'Password successfully reset'));
};

export {
  forgottenPasswordHandler,
  loginHandler,
  logoutHandler,
  refreshAccessToken,
  registrationHandler,
  resetPasswordHandler,
  sendOtpHandler,
  verifyOTPHandler,
};
