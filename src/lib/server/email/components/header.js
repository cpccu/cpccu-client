import { BRAND, COLORS } from '../theme';

// Shared gradient header with the CPCCU logo, used by every email.
//
// NO `import 'server-only'` HERE: pure string building, no server-only
// dependency, must stay importable from a Client Component.
//
// ESCAPING AUDIT — `title` and `subtitle` are interpolated AS-IS here, on
// purpose, and that is a CONTRACT rather than an oversight: `EmailLayout` (the
// only caller in this codebase) escapes both ONCE at its own entry and passes
// the already-escaped values down. Escaping again in this component would
// double-escape — a name containing `&` would render literally as `&amp;`.
//
// The consequence is that `EmailHeader` is not safe to call directly with raw
// user input. It is re-exported from the module entry point for future
// standalone use; a future template that renders it outside `EmailLayout` is
// responsible for escaping its own values first.
export const EmailHeader = ({ title, subtitle }) => `
  <table
    role="presentation"
    width="100%"
    cellpadding="0"
    cellspacing="0"
    border="0"
    bgcolor="${COLORS.primaryDark}"
    style="background: ${COLORS.gradient}; background-color: ${COLORS.primaryDark}; border-radius: 10px 10px 0 0;"
  >
    <tr>
      <td align="center" style="padding: 32px 30px;">
        <img
          src="${BRAND.logoUrl}"
          alt="${BRAND.name} Logo"
          width="100"
          style="display: inline-block; width: 100px; max-width: 100%; height: auto; margin-bottom: 15px; border: 0; outline: none; text-decoration: none;"
        />
        <h1
          style="margin: 0; font-size: 28px; line-height: 1.3; font-weight: bold; color: #ffffff;"
        >
          ${title}
        </h1>
        ${
          subtitle
            ? `<p style="margin: 10px 0 0 0; font-size: 16px; line-height: 1.5; color: #dbe6ff;">${subtitle}</p>`
            : ''
        }
      </td>
    </tr>
  </table>
`;
