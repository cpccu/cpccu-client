// =============================================================================
// TEST STUB — the `resend` mail transport.
//
// WHY THIS EXISTS. `forgottenPasswordHandler` on its SUCCESS path calls
// `sendOTP` -> `sendEmail` -> `new Resend(...).emails.send(...)`. That last call
// is a live HTTPS request to a third-party API, and it is the reason the "email
// was sent" branch of `POST /auth/reset-link` could not previously be exercised
// by any test — the endpoint's whole job is to send mail, so the branch that
// proves it is safe to expose anonymously was the one branch nothing could reach
// without a real API key and a real network call.
//
// WHAT IT STANDS IN FOR, PRECISELY: the network call. Nothing above it is
// stubbed. `sendEmail` constructs the real `Resend` client, `sendOTP` builds the
// real `WEB_DOMAIN`-based reset URL and renders the real `passwordResetEmail`
// template, and the controller really does persist the OTP with a real `save()`.
// Only the transport is replaced, which is the same boundary the other tests in
// this suite substitute (the Mongoose model statics, `next/headers`' `cookies()`).
//
// WHY IT RECORDS RATHER THAN SILENTLY SUCCEEDING. A stub that just returns
// `{ data: {} }` would let a test pass without proving anything about the mail
// path. This one records every call in `__resendStub.calls`, so a test can assert
// that the KNOWN-account branch really did attempt a send AND that the
// unknown-account branch did not — which is the observable form of the property
// that the identical 200 is not masking an extra round trip.
//
// WHY IT LIVES IN A STUB FILE RATHER THAN BEING INJECTED IN THE TEST. `resend`
// is an ESM-first package (its `exports` map routes `import` to
// `dist/index.mjs`), so `require.cache` cannot intercept it the way it
// intercepts the CommonJS `next/headers`. It is substituted at RESOLUTION time
// instead, from `test/loader.mjs`, behind an environment variable so it is
// inert for every other test file and for anything that is not this suite.
// =============================================================================

/**
 * A stand-in for the `Resend` client, shaped like the parts of the SDK
 * `sendEmail.js` actually uses: `new Resend(key)` and `resend.emails.send({…})`.
 *
 * The RESOLVED SHAPE MATTERS. `sendEmail` does not treat a resolved promise as
 * success on its own: it inspects `response?.error` and throws when that is
 * truthy, precisely because the SDK reports API-level failures (rate limits,
 * quota exhaustion, unverified sender) in the resolved value rather than by
 * rejecting. So the stub must resolve `{ data, error: null }` and NOT reject —
 * a stub that rejected, or that omitted `error`, would take a path through
 * `sendEmail` that the real SDK does not take, and the test would be measuring
 * the stub.
 */
class Resend {
  constructor(apiKey) {
    // Recorded so a test can assert the real `sendEmail` did read the key at
    // call time rather than at module load — the property its own comment
    // describes as load-bearing on a serverless platform.
    this.apiKey = apiKey;
  }

  emails = {
    send: async (payload) => {
      __resendStub.calls.push({ apiKey: this.apiKey, payload });

      return { data: { id: "test-only-message-id" }, error: null };
    },
  };
}

/**
 * The recording surface, on `globalThis` rather than as a module export.
 *
 * `globalThis` because the stub is resolved in place of a THIRD-PARTY package
 * by the loader: the module graph has no other handle on it, and the test file
 * that wants to assert on the calls has no statically-importable reference to it
 * either (importing `resend` from the test would itself be substituted). A
 * global is the one channel both sides can name.
 */
const __resendStub = { calls: [] };

globalThis.__resendStub = __resendStub;

export { Resend };
