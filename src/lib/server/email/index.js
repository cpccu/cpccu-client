import 'server-only';

// Email module entry point. Import templates and shared pieces from here.
//
// WHY THIS BARREL IS `server-only` EVEN THOUGH IT MOSTLY RE-EXPORTS PURE
// TEMPLATE HELPERS: it re-exports `sendWelcomeEmail`, which reaches
// `sendEmail.js`, which reads `RESEND_API_KEY`. Without the guard, a client
// component could import `EmailLayout` from here "for a preview", the barrel
// would pull `sendEmail.js` into the client graph, and the build would fail on
// `sendEmail.js`'s own `server-only` guard with a confusing error pointing at
// the wrong file. The guard turns that into an immediate, correct failure at the
// barrel.
//
// If previewing templates from the client is ever genuinely needed, split the
// pure half into a second barrel without `server-only` — do not remove the
// guard from this one.
//
// NOTE: the two OTP/reset templates now carry `import 'server-only'` themselves
// (each pulls `OTP_TIME` / `RESET_TIME` from `@/lib/server/constants`, which is
// guarded anyway). They are server-only because the MAIL PATH is server-only —
// they exist to be handed to Resend, and one of them renders a live
// password-reset credential. The guard on each file is deliberate: it makes an
// accidental client import fail with an error naming the right file instead of a
// dependency-chain error pointing at `constants.js`.

export { EmailLayout } from './layout';
export { EmailButton } from './components/button';
export { EmailHeader } from './components/header';
export { EmailFooter } from './components/footer';
export { BRAND, COLORS, TYPOGRAPHY, CARD_WIDTH } from './theme';

export { registrationEmailTemplate } from './registrationEmail';
export { passwordResetEmailTemplate } from './passwordResetEmail';
export { welcomeEmailTemplate, sendWelcomeEmail } from './welcomeEmail';

// To add a future email (certificate issued, job pipeline, event/bootcamp
// announcement, newsletter, account notifications, ...):
//   1. Create src/lib/server/email/<name>Email.js exporting a template
//      function that returns { subject, html: EmailLayout({ title, subtitle,
//      content, button, previewText }) }.
//   2. Re-export it here.
//   3. Consume it from any controller/service via sendEmail()/sendOTP().
//   4. Escape EVERY user-supplied value inside `content` with `escapeHtml`.
//      `EmailLayout` escapes title/subtitle/previewText and `EmailButton`
//      escapes its text/url, but `content` is injected raw by design.
