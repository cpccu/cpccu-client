import { BRAND, COLORS } from '../theme';

// Shared rich footer with support contact and branding, used by every email.
// Returns a <tr> row meant to be embedded as the last row of the layout's
// content table (see layout.js) — not a standalone document.
//
// NO `import 'server-only'` HERE: pure string building, no server-only
// dependency, must stay importable from a Client Component.
//
// ESCAPING AUDIT — nothing here is escaped, and nothing needs to be: every
// interpolation is a `BRAND.*` constant declared in `theme.js`. There is no
// parameter and therefore no path by which user input can reach this markup.
// `BRAND.supportEmail` and `BRAND.website` are emitted in BOTH an `href` and as
// visible text, so they would need escaping if they were ever templated — if a
// future change makes them dynamic, escape at the point they are read.
export const EmailFooter = () => `
  <tr>
    <td
      style="padding: 24px 30px; background-color: ${COLORS.cardBackground}; border-top: 1px solid ${COLORS.border}; border-radius: 0 0 10px 10px;"
    >
      <p
        style="margin: 0 0 6px 0; font-size: 14px; line-height: 1.5; font-weight: bold; color: ${COLORS.text};"
      >
        Need help?
      </p>
      <p style="margin: 0 0 14px 0; font-size: 14px; line-height: 1.6; color: ${COLORS.textMuted};">
        <a
          href="mailto:${BRAND.supportEmail}"
          style="color: ${COLORS.primary}; text-decoration: none;"
        >${BRAND.supportEmail}</a><br />
        <a
          href="${BRAND.website}"
          style="color: ${COLORS.primary}; text-decoration: none;"
        >${BRAND.website}</a>
      </p>
      <p
        style="margin: 0 0 16px 0; font-size: 14px; line-height: 1.6; color: ${COLORS.textMuted};"
      >
        We're excited to have you in our community. Happy Coding! 🚀
      </p>
      <p style="margin: 0; font-size: 12px; line-height: 1.6; color: ${COLORS.textFaint};">
        Best regards,<br />
        The CPCCU Team<br />
        ${BRAND.fullName}
      </p>
    </td>
  </tr>
`;
