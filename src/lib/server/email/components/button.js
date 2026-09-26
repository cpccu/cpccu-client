import { COLORS } from '../theme';
import { escapeHtml } from '../escapeHtml';

// Shared call-to-action button. Future emails only need to pass { text, url }.
//
// NO `import 'server-only'` HERE: pure string building, no server-only
// dependency, must stay importable from a Client Component.
//
// ESCAPING AUDIT — `text` AND `url` are escaped HERE, at this function's own
// entry, which is the only place either value is escaped on its way to the
// markup.
//
// Why the `url` matters: it lands inside an `href="..."` attribute. Escaping
// stops attribute injection (a `"` in the value closing the attribute and
// adding an `onclick=` handler to the link), but it does NOT validate the
// scheme — a `javascript:` URL would still pass through and be a live XSS in
// clients that honour it. The scheme is therefore a CALLER obligation: the only
// current caller builds the URL from `WEB_DOMAIN` plus server-generated values
// (see `sentOtp.js`), so the origin is trusted. Do not pass a user-supplied URL
// to this component without validating the scheme first.
export const EmailButton = ({ text, url }) => `
  <table
    role="presentation"
    cellpadding="0"
    cellspacing="0"
    border="0"
    align="center"
    style="margin: 30px auto 0 auto;"
  >
    <tr>
      <td bgcolor="${COLORS.primary}" style="border-radius: 6px;">
        <a
          href="${escapeHtml(url)}"
          style="display: inline-block; padding: 14px 32px; font-size: 16px; font-weight: bold; line-height: 1.4; color: #ffffff; text-decoration: none; border-radius: 6px;"
        >
          ${escapeHtml(text)}
        </a>
      </td>
    </tr>
  </table>
`;
