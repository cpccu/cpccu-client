import 'server-only';

import { COLORS } from './theme';
import { EmailLayout } from './layout';
import { RESET_TIME } from '@/lib/server/constants';

// Password reset email. The reset URL, token, and expiry behavior are
// untouched; only the presentation uses the shared layout (with the logo).
//
// `import 'server-only'` IS PRESENT AND MEANS SOMETHING. This template is pure
// string building, but it imports `RESET_TIME` from `@/lib/server/constants`,
// which carries its own `server-only` guard — so the module was NEVER
// client-importable no matter what this comment used to claim, and a Client
// Component importing it would already have failed the build. The guard is kept
// deliberately because this template renders a live password-reset CREDENTIAL
// into a mail body sent through Resend: it has no business in a client bundle,
// and the explicit guard makes an accidental client import fail with a correct,
// immediate error naming THIS file rather than a dependency-chain error naming
// `constants.js`. If client-side previewing is ever genuinely required, split
// the pure half into a separate, deliberately client-safe module — do not remove
// the guard from this one.
//
// ESCAPING AUDIT — this template interpolates NO user input directly. `title`,
// `subtitle` and `previewText` are hardcoded literals, and `RESET_TIME` is a
// number constant; `EmailLayout` escapes the three strings at its own entry.
//
// The one value that DOES carry data — `resetUrl`, a live password-reset
// credential — is not interpolated here. It is passed as
// `button: { text, url }` and escaped inside `EmailButton` at the point it is
// written into the `href` attribute. Keep it that way: an unescaped
// interpolation of `resetUrl` into this template's markup would be a
// single-quote/attribute break-out in an email whose whole purpose is to be
// trusted and clicked.
export const passwordResetEmailTemplate = ({ resetUrl }) => {
  const subject = 'Password Reset - CPCCU';

  const content = `
    <h2
      style="margin: 0 0 16px 0; font-size: 22px; line-height: 1.3; color: ${COLORS.text};"
    >
      Reset Your Password
    </h2>

    <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.6; color: ${COLORS.textMuted};">
      We received a password reset request for your account.
    </p>

    <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.6; color: ${COLORS.textMuted};">
      This link will expire in ${RESET_TIME} minutes.
    </p>

    <p style="margin: 0; font-size: 16px; line-height: 1.6; color: ${COLORS.textMuted};">
      If you didn't request this, please ignore this email.
    </p>
  `;

  return {
    subject,
    html: EmailLayout({
      title: 'Password Reset',
      subtitle: 'CPCCU Account Security',
      previewText: 'Use this link to reset your CPCCU password.',
      content,
      button: { text: 'Reset Password', url: resetUrl },
    }),
  };
};
