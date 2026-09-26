// Escape user-provided values before interpolating them into email HTML
// to prevent broken markup and HTML injection in sent emails.
//
// NO `import 'server-only'` HERE, deliberately: this module is pure string
// handling with no server-only dependency, and it must stay importable from a
// Client Component (e.g. to render a preview of a template).
//
// THE REPLACEMENT ORDER IS LOAD-BEARING. `&` is replaced FIRST, on purpose. If
// `&` were replaced last, the `&` inside the `&amp;` produced for the earlier
// `<` / `>` / `"` / `'` replacements would itself be escaped, yielding the
// visible-but-wrong `&amp;lt;` and a double-escaped result. In this order each
// input character is touched exactly once and no output is ever re-escaped.
export const escapeHtml = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
