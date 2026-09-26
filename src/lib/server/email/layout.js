import { EmailButton } from './components/button';
import { EmailFooter } from './components/footer';
import { EmailHeader } from './components/header';
import { escapeHtml } from './escapeHtml';
import { CARD_WIDTH, COLORS, TYPOGRAPHY } from './theme';

// Shared email layout. Every template renders through this so that all
// emails share the same width, spacing, typography, colors, branding,
// header, and footer.
//
// NO `import 'server-only'` HERE: pure string building, no server-only
// dependency, must stay importable from a Client Component (e.g. to render a
// template preview).
//
// Usage:
//   return EmailLayout({ title, subtitle, content, button, previewText });
//
// ESCAPING AUDIT — this is the single escape point for `title`, `subtitle` and
// `previewText`. All three are escaped ONCE here and the escaped values are
// used both for the `<title>` element and for the values handed to
// `EmailHeader` / `EmailButton`. Escaping again downstream would double-escape.
//
// `content` is DELIBERATELY NOT ESCAPED: it is a block of markup assembled by
// the template, and the template is what escapes the user-supplied parts before
// handing them over. Passing unescaped user input in `content` is the one way
// to reintroduce injection into these emails, so any interpolation inside a
// template's `content` string must go through `escapeHtml`.
//
// `?? ''` (rather than relying on `escapeHtml`'s own `= ''` default) so a caller
// that passes an explicit `null` renders nothing instead of the visible text
// "null".
export const EmailLayout = ({
  title,
  subtitle,
  content,
  button,
  previewText,
}) => {
  const safeTitle = escapeHtml(title ?? '');
  const safeSubtitle = escapeHtml(subtitle ?? '');
  const safePreviewText = escapeHtml(previewText ?? '');

  return `
  <!DOCTYPE html>
  <html lang="en" xmlns="http://www.w3.org/1999/xhtml">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta http-equiv="X-UA-Compatible" content="IE=edge" />
      <title>${safeTitle}</title>
    </head>
    <body
      style="margin: 0; padding: 0; background-color: ${COLORS.pageBackground}; font-family: ${TYPOGRAPHY.fontFamily}; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%;"
    >
      ${
        previewText
          ? `<div style="display: none; max-height: 0; overflow: hidden; mso-hide: all;">${safePreviewText}</div>`
          : ''
      }

      <table
        role="presentation"
        width="100%"
        cellpadding="0"
        cellspacing="0"
        border="0"
        style="background-color: ${COLORS.pageBackground};"
      >
        <tr>
          <td align="center" style="padding: 24px 16px;">
            <table
              role="presentation"
              width="${CARD_WIDTH}"
              cellpadding="0"
              cellspacing="0"
              border="0"
              style="width: ${CARD_WIDTH}px; max-width: 100%; background-color: ${COLORS.cardBackground}; border-radius: 10px; box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);"
            >
              <tr>
                <td>
                  ${EmailHeader({ title: safeTitle, subtitle: safeSubtitle })}

                  <table
                    role="presentation"
                    width="100%"
                    cellpadding="0"
                    cellspacing="0"
                    border="0"
                    style="background-color: ${COLORS.contentBackground}; border-left: 1px solid ${COLORS.border}; border-right: 1px solid ${COLORS.border};"
                  >
                    <tr>
                      <td style="padding: 32px 30px;">
                        ${content}
                        ${button ? EmailButton(button) : ''}
                      </td>
                    </tr>
                    ${EmailFooter()}
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
  </html>
`;
};
