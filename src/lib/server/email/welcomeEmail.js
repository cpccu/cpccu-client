import { EmailLayout } from './layout';
import { sendEmail } from './sendEmail';
import { BRAND, COLORS } from './theme';
import { escapeHtml } from './escapeHtml';

// NO `import 'server-only'` ON THIS FILE, but it is NOT client-safe and that is
// a deliberate split worth stating plainly:
//
// `welcomeEmailTemplate` is pure string building and stays importable from a
// Client Component (e.g. to render a preview). `sendWelcomeEmail` is the send
// path, and it reaches `sendEmail.js`, which DOES carry `import 'server-only'`
// because it reads `RESEND_API_KEY`.
//
// The two were kept in one file because that is how the Express original had
// them, and because splitting them would change the module's public shape for no
// behavioural gain. The practical consequence: importing anything from THIS file
// into a Client Component pulls `sendEmail.js` in with it and will fail the
// client build on the `server-only` guard. Import the sibling templates
// (`registrationEmail`, `passwordResetEmail`) for anything client-side.

const communityLinks = [
  { name: 'Website', url: BRAND.website },
  { name: 'Facebook Group', url: 'https://www.facebook.com/groups/cpccu' },
  { name: 'Facebook Page', url: 'https://www.facebook.com/cpccu2022' },
  {
    name: 'WhatsApp Community',
    url: 'https://chat.whatsapp.com/IBeuGCXQQBT1jQSBK4SuUS',
  },
  {
    name: 'WhatsApp Group',
    url: 'https://chat.whatsapp.com/BxznCy84PILHEcUBxE8orM',
  },
];

const sectionTitleStyle = `
  margin: 0 0 12px 0; font-size: 18px; line-height: 1.4; font-weight: bold; color: ${COLORS.text};
`;
const paragraphStyle = `
  margin: 0 0 14px 0; font-size: 16px; line-height: 1.6; color: ${COLORS.textMuted};
`;
const listItemStyle = `
  margin: 0 0 8px 0; font-size: 16px; line-height: 1.5; color: ${COLORS.textMuted};
`;

// Welcome email for newly registered users.
//
// ESCAPING AUDIT — two interpolations carry data:
//  - `fullName` (the user's name, i.e. ATTACKER-CONTROLLED input) was already
//    routed through `escapeHtml` in the original and still is.
//  - `link.name` / `link.url` come from the `communityLinks` constant declared
//    directly above: hardcoded, so nothing to escape. They are emitted in BOTH
//    the `href` and as visible text; if a future change makes this list
//    dynamic (e.g. admin-configurable community links), it MUST start escaping
//    both — that array is a URL rendered into a link.
export const welcomeEmailTemplate = ({ fullName = 'there' }) => {
  const subject = 'Welcome to CPCCU 🎉';

  const safeName = escapeHtml(fullName);

  const content = `
    <h2
      style="margin: 0 0 16px 0; font-size: 22px; line-height: 1.3; color: ${COLORS.text};"
    >
      Welcome, ${safeName}!
    </h2>

    <p style="${paragraphStyle}">
      <strong>Congratulations!</strong> Your CPCCU account has been successfully
      created.
    </p>

    <p style="${paragraphStyle}">
      We're excited to welcome you to Competitive Programming Camp City
      University (CPCCU)—a community dedicated to helping students improve their
      programming skills, prepare for programming contests, and grow as software
      developers.
    </p>

    <p style="${paragraphStyle}">
      We hope your journey with CPCCU will be full of learning, achievements,
      and opportunities.
    </p>

    <div style="margin: 28px 0; padding: 22px 24px; background-color: ${COLORS.cardBackground}; border: 1px solid ${COLORS.border}; border-radius: 8px;">
      <h3 style="${sectionTitleStyle}">What You Can Do Now</h3>
      <ul style="margin: 0; padding-left: 20px;">
        <li style="${listItemStyle}">✔ Complete your profile</li>
        <li style="${listItemStyle}">✔ Add your GitHub, LinkedIn &amp; Portfolio</li>
        <li style="${listItemStyle}">✔ Track your certificates</li>
        <li style="${listItemStyle}">✔ Showcase your projects</li>
        <li style="${listItemStyle}">✔ Participate in contests &amp; bootcamps</li>
      </ul>
    </div>

    <h3 style="${sectionTitleStyle}">Join the Community</h3>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 0 0 8px 0;">
      ${communityLinks
        .map(
          (link) => `
        <tr>
          <td style="padding: 3px 0; font-size: 16px; line-height: 1.5; color: ${COLORS.textMuted};">
            ${link.name} — <a href="${link.url}" style="color: ${COLORS.primary}; text-decoration: underline;">${link.url}</a>
          </td>
        </tr>`,
        )
        .join('')}
    </table>
    <p style="${paragraphStyle}">
      For GitHub, LinkedIn, Discord, Instagram, Telegram, YouTube, and other
      official platforms, please check the website footer.
    </p>

    <h3 style="${sectionTitleStyle}">Earn Certificates</h3>
    <p style="${paragraphStyle}">
      Participate in CPCCU events, bootcamps, contests, and workshops. Every
      certificate you earn will automatically appear on your CPCCU profile.
    </p>
  `;

  return {
    subject,
    html: EmailLayout({
      title: 'Welcome to CPCCU',
      subtitle: 'Competitive Programming Camp City University',
      previewText: 'Your CPCCU journey starts today.',
      content,
      button: { text: 'Visit CPCCU', url: BRAND.website },
    }),
  };
};

/**
 * Sends the welcome email to a newly registered user.
 *
 * FIRE-AND-FORGET, AND IT MUST STAY THAT WAY. The caller is expected to invoke
 * this WITHOUT `await` and with a `.catch()` attached, for two reasons:
 *
 *  1. Correctness — a welcome email is a courtesy, not part of the
 *     registration transaction. A Resend outage, a quota error or an invalid
 *     recipient must not turn a successful registration into a 500. The user
 *     has an account; the account is what the endpoint promises.
 *  2. Latency — the send is a third-party HTTP round trip. Awaiting it would
 *     add that latency to every registration response for a message nobody is
 *     waiting on.
 *
 * Do not `await` this in a route handler, and do not let a rejection go
 * unhandled: an unhandled rejection in a serverless function can terminate the
 * invocation and take the registration response with it.
 */
export const sendWelcomeEmail = async ({ email, fullName }) => {
  const { subject, html } = welcomeEmailTemplate({ fullName });

  return sendEmail({ to: email, subject, html });
};
