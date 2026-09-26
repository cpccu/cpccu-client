import 'server-only';

import { COLORS } from './theme';
import { EmailLayout } from './layout';
import { escapeHtml } from './escapeHtml';
import { OTP_TIME } from '@/lib/server/constants';

// Registration OTP email. OTP generation, expiration, and verification
// logic is untouched; only the presentation uses the shared layout.
//
// `import 'server-only'` IS PRESENT AND MEANS SOMETHING. The template half is
// pure string building, but it imports `OTP_TIME` from `@/lib/server/constants`,
// which carries its own `server-only` guard — so this module was NEVER
// client-importable regardless of what this comment said, and a Client Component
// importing it would already have failed the build. (An earlier revision of this
// comment claimed the opposite: that omitting the guard kept the template
// "importable from a Client Component for previews". That was false, and the
// failure mode it described is the exact confusing wrong-file build error
// `email/index.js`'s own barrel guard exists to prevent.)
//
// The guard is kept deliberately anyway, and the reason is that a template whose
// only purpose is to be rendered into a mail body sent through Resend is a
// SERVER-ONLY artefact: shipping it to a browser would put the OTP and the
// user's name in the client bundle for no benefit, and `sendEmail` (which needs
// `RESEND_API_KEY`) is the other half of the same path. An explicit guard turns
// "why is this in my client graph?" into a correct, immediate build error naming
// this file, instead of a dependency-chain error naming some leaf module. If
// client-side template previewing is ever genuinely required, split the pure
// half into a separate, deliberately client-safe module — do not remove the
// guard from this one.
//
// ESCAPING AUDIT — two interpolations carry data:
//  - `username` (the user's `fullName`, i.e. ATTACKER-CONTROLLED input) was
//    already routed through `escapeHtml` in the original and still is.
//  - `otp` was interpolated RAW in the original. It is not user input in the
//    current data flow — it is a 6-digit value from `crypto.randomInt` — so
//    escaping it is a no-op today. It is escaped anyway because this is a
//    single-factor authentication CREDENTIAL rendered into HTML, and the cost
//    of being wrong if a future caller ever passes something else is a reset of
//    a live account. No rendered output changes. (DECLARED DIVERGENCE — see the
//    block at the top of `src/lib/server/http.js`.)
export const registrationEmailTemplate = ({ username = 'User', otp }) => {
  const subject = 'Complete Your Registration - CPCCU';

  const safeName = escapeHtml(username);

  const content = `
    <h2
      style="margin: 0 0 16px 0; font-size: 22px; line-height: 1.3; color: ${COLORS.text};"
    >
      Hello <span style="color: ${COLORS.primary}; font-weight: bold;">${safeName}</span>!
    </h2>

    <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.6; color: ${COLORS.textMuted};">
      Thank you for registering with CPCCU. To complete your registration,
      use the verification code below:
    </p>

    <table
      role="presentation"
      width="100%"
      cellpadding="0"
      cellspacing="0"
      border="0"
      style="margin: 24px 0;"
    >
      <tr>
        <td
          align="center"
          style="background-color: ${COLORS.cardBackground}; border: 2px dashed ${COLORS.primary}; border-radius: 8px; padding: 20px;"
        >
          <p
            style="margin: 0; font-size: 32px; letter-spacing: 5px; font-weight: bold; color: ${COLORS.primary};"
          >
            ${escapeHtml(otp)}
          </p>
          <p style="margin: 10px 0 0 0; font-size: 14px; color: ${COLORS.textFaint};">
            Verification Code
          </p>
        </td>
      </tr>
    </table>

    <p style="margin: 0 0 16px 0; font-size: 16px; line-height: 1.6; color: ${COLORS.textMuted};">
      This OTP will expire in ${OTP_TIME} minutes.
    </p>

    <p style="margin: 0; font-size: 16px; line-height: 1.6; color: ${COLORS.textMuted};">
      If you didn't create an account, please ignore this email.
    </p>
  `;

  return {
    subject,
    html: EmailLayout({
      title: 'Complete Your Registration',
      subtitle: 'Competitive Programming Camp City University',
      previewText: 'Use this code to complete your CPCCU registration.',
      content,
    }),
  };
};
