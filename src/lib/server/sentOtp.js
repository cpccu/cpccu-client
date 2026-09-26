import 'server-only';

import crypto from 'node:crypto';

import { ApiError } from '@/lib/server/errors';
import {
  passwordResetEmailTemplate,
  registrationEmailTemplate,
} from '@/lib/server/email';
import { sendEmail } from '@/lib/server/email/sendEmail';

/**
 * Port of `cpccu-server/src/utils/sentOtp.js`.
 *
 * `crypto` is Node's BUILT-IN module, imported as `node:crypto` (the explicit
 * specifier makes the intent unambiguous and is what Next's bundler expects for
 * server-only code). It is NOT the npm `crypto` package and no dependency was
 * added for it.
 */

/**
 * Generates a one-time password.
 *
 * CSPRNG REQUIRED, NOT COSMETIC. An OTP is a SINGLE-FACTOR credential: the
 * endpoints that accept it are unauthenticated, and the only thing standing
 * between an attacker and a full account is guessing 6 digits (with a per-OTP
 * attempt counter and a short expiry on top). `Math.random()` is a
 * non-cryptographic PRNG whose internal state is recoverable from a handful of
 * observed outputs, so an attacker who can trigger a few OTPs for their own
 * account could predict the codes issued to other users. `crypto.randomInt` is
 * backed by the OS CSPRNG and gives no such handle.
 *
 * `crypto.randomInt(0, 1000000)` is REJECTION-SAMPLING from a uniform range —
 * inclusive of 0, exclusive of 1000000 — so it produces exactly 0..999999
 * uniformly. Do not replace it with `randomBytes` + modulo, which introduces a
 * modulo bias and, for a 6-digit range off a small byte buffer, a large class
 * of values that never come up.
 *
 * `padStart(6, '0')` is required: without it a code such as 1234 is produced
 * as the 4-character string `'1234'`, which shortens the search space by an
 * order of magnitude and confuses users copying the code off the screen.
 *
 * @param time OTP lifetime in MINUTES (callers pass `OTP_TIME` / `RESET_TIME`
 *             from `@/lib/server/constants`). Converted with `time * 60 * 1000`
 *             — there is no unit on the parameter itself, which is why both call
 *             sites are minutes-valued constants and nothing else.
 * @returns `[otp, code]` — the object to persist on the user document, and the
 *          PLAINTEXT code to email. Only `code` is usable; the persisted copy is
 *          bcrypt hashed by the `pre('save')` hook in the user model, so the
 *          plaintext returned here is the LAST chance to read it.
 */
const generateOTP = (time) => {
  // Exactly 6 numeric digits (0-9) from the CSPRNG. crypto.randomInt is backed
  // by the same secure randomness as randomBytes; padStart keeps codes with
  // leading zeros (e.g. "000123") at exactly 6 digits.
  const code = crypto.randomInt(0, 1000000).toString().padStart(6, '0');

  const expires = new Date(Date.now() + time * 60 * 1000);

  const otp = {
    code,
    expire: expires,
  };

  return [otp, code];
};

/**
 * Sends the OTP email for the given purpose, and returns `true` on success.
 *
 * `purpose` selects the template. The two purposes are security-DISTINCT
 * (a registration code and a password-reset code authorise different things) and
 * an unrecognised purpose THROWS rather than defaulting, so a typo in a call
 * site fails loudly instead of mailing a user a reset link that does not match
 * the operation being performed.
 *
 * `data` is the caller-supplied bag the templates read from: `fullName` for
 * registration, `code` + `token` for reset. Both are interpolated into the email
 * HTML through `escapeHtml` / a template that does so — see the escaping audit
 * in `passwordResetEmail.js` and `email/components/button.js`.
 *
 * Throws whatever `sendEmail` throws (Resend rejects are converted to a thrown
 * `Error` there). The Express original wrapped some of these calls in a 500
 * `ApiError` at the call site; that decision belongs to the caller, not here.
 */
const sendOTP = async (email, otp, purpose, data = {}) => {
  let subject;
  let html;
  if (purpose === 'registration') {
    const template = registrationEmailTemplate({
      username: data.fullName || 'User',
      otp,
    });

    subject = template.subject;
    html = template.html;
  } else if (purpose === 'reset') {
    // `WEB_DOMAIN` is read LAZILY, here, rather than captured at module load.
    // That is deliberate: on a serverless platform the module graph is evaluated
    // at build/cold-start time, and an env lookup hoisted to module scope can be
    // evaluated before the runtime environment is populated.
    //
    // THE TRAP: when `WEB_DOMAIN` is unset, template-literal interpolation of
    // `undefined` does NOT throw — it silently produces the literal string
    // "undefined/reset-password/<code>/<token>". The email is then sent
    // successfully, looks entirely normal to the recipient, and the link is
    // dead. There is no error anywhere to trace it from, so the failure only
    // shows up as users reporting "the link does nothing". Guard explicitly
    // rather than relying on the string.
    const webDomain = process.env.WEB_DOMAIN;

    if (!webDomain) {
      throw new ApiError(
        500,
        'WEB_DOMAIN is not configured; cannot build a password reset link.',
      );
    }

    // Trailing slashes are stripped from the domain so the concatenation below
    // cannot produce a double slash (`https://host//reset-password/...`), which
    // some mail clients and link-previewers normalise inconsistently.
    const resetUrl = `${webDomain.replace(/\/+$/, '')}/reset-password/${data.code}/${data.token}`;

    const template = passwordResetEmailTemplate({ resetUrl });

    subject = template.subject;
    html = template.html;
  } else {
    throw new Error('Invalid purpose specified.');
  }

  await sendEmail({ to: email, subject, html });

  return true;
};

export { generateOTP, sendOTP };
