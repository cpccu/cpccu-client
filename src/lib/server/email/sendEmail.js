import 'server-only';

import { Resend } from 'resend';

// Single shared Resend send path used by every CPCCU email.
// Returns the Resend response and throws on failure so callers can decide
// whether to surface or swallow the error.
//
// `server-only` IS REQUIRED HERE (unlike the templates alongside it): this is
// the one module in the email tree that reads `RESEND_API_KEY` from the
// environment. Without the guard, nothing at build time stops this file — and
// therefore the API key reference — from being pulled into a client bundle.
export const sendEmail = async ({ to, subject, html }) => {
  // The client is constructed PER CALL rather than hoisted to module scope.
  // That is intentional: `new Resend(process.env.RESEND_API_KEY)` at module
  // scope would capture the key at module-evaluation time, and on a serverless
  // platform the module graph can be evaluated during the build (or on a cold
  // start before the runtime environment is fully populated), which would
  // capture `undefined` and fail every send for the lifetime of the warm
  // instance. Constructing here reads the environment at the moment of use.
  // The cost is a trivial object allocation per email — not on a hot path.
  const resend = new Resend(process.env.RESEND_API_KEY);

  let response;
  try {
    response = await resend.emails.send({
      // Hardcoded verified sender. It is NOT taken from an env var because the
      // Resend account only permits this exact From for the domain; making it
      // configurable would let a misconfiguration turn every send into a 403
      // at send time instead of at deploy time.
      from: 'CPCCU <noreply@cpccu.club>',
      to,
      subject,
      html,
    });

    // The Resend SDK resolves with `{ data, error }` on API-level failures
    // (rate limits, quota exhaustion, unverified sender, invalid recipient,
    // ...) instead of throwing. Treat those as failures too so callers can
    // see and handle them — otherwise rejected emails are silently swallowed
    // (the promise resolves, so a fire-and-forget `.catch()` never fires).
    if (response?.error) {
      const { statusCode, name, message } = response.error;

      // Rebuilt as a real `Error` with the status code and the raw response
      // attached, so a caller can branch on `error.statusCode` (e.g. treat 429
      // as retryable) and still has the full payload for logging.
      const error = new Error(`Resend API error (${statusCode}): ${message}`);
      error.name = name || 'ResendError';
      error.statusCode = statusCode;
      error.response = response;

      throw error;
    }
  } catch (error) {
    // Network/transport-level failures throw directly.
    console.error('Error sending email:', error);

    throw error;
  }

  console.log('Email sent successfully:', response);

  return response;
};
