/**
 * The five certificate templates, mirrored from the server registry
 * (`cpccu-server/src/utils/certificateTemplates.js`).
 *
 * ⚠️ THE KEYS AND THE PALETTE MUST MATCH THE SERVER EXACTLY. The key is stored
 * on the certificate record and validated against the server's enum, and the
 * palette is what the browser renderer paints with. A key added here but not
 * there would be rejected on save; a colour changed here but not there would
 * make the admin preview disagree with the issued PDF.
 *
 * Colours are plain hex strings on purpose: the certificates are rasterised by
 * html2canvas, which cannot parse `oklch()`, `color-mix()` or CSS variables.
 */

export const CERTIFICATE_TEMPLATE_KEYS = [
  'classic',
  'modern',
  'tech',
  'elegant',
  'vibrant',
  'platinum',
  'platinum-participation',
  'platinum-achievement',
];

export const DEFAULT_CERTIFICATE_TEMPLATE_KEY = 'classic';

/**
 * The only font stacks a template may use.
 *
 * System fonts only — no web-font loading, because a font that swaps in after
 * html2canvas has painted produces a PDF in the fallback face.
 */
export const CERTIFICATE_FONT_STACKS = {
  serif: "Georgia, 'Times New Roman', serif",
  sans: 'Helvetica, Arial, sans-serif',
  mono: "ui-monospace, 'Courier New', monospace",
};

export const CERTIFICATE_TEMPLATES = [
  {
    key: 'classic',
    label: 'Classic Blue',
    description: 'Ornate royal-blue border on a white page with a serif heading.',
    accent: '#1F4E9C',
    accentSoft: '#DCE7F7',
    ink: '#16305E',
    paper: '#FFFFFF',
    fontDisplay: 'serif',
    fontBody: 'serif',
  },
  {
    key: 'modern',
    label: 'Modern Minimal',
    description: 'Clean sans-serif layout with a single accent rule.',
    accent: '#4F46E5',
    accentSoft: '#E9E7FD',
    ink: '#111827',
    paper: '#FFFFFF',
    fontDisplay: 'sans',
    fontBody: 'sans',
  },
  {
    key: 'tech',
    label: 'Code Grid',
    description: 'Dark technical certificate with a monospaced code-grid motif.',
    accent: '#22D3EE',
    accentSoft: '#0E7490',
    ink: '#E2E8F0',
    paper: '#0B1120',
    fontDisplay: 'mono',
    fontBody: 'sans',
  },
  {
    key: 'elegant',
    label: 'Gold Ornate',
    description: 'Gold ornamental border on a cream page with a serif heading.',
    accent: '#B08D3E',
    accentSoft: '#F6EEDC',
    ink: '#3B2F2A',
    paper: '#FFFDF7',
    fontDisplay: 'serif',
    fontBody: 'serif',
  },
  {
    key: 'vibrant',
    label: 'Vibrant Gradient',
    description: 'Bold gradient header with geometric accents.',
    accent: '#DB2777',
    accentSoft: '#FBCFE8',
    ink: '#18181B',
    paper: '#FFFFFF',
    fontDisplay: 'sans',
    fontBody: 'sans',
  },
  {
    key: 'platinum',
    label: 'Platinum Tech',
    description:
      'Luxury deep-navy and gold border with isometric tech illustration and trophy ribbon.',
    accent: '#0B1B3D',
    accentSoft: '#DCE7F7',
    ink: '#0B1B3D',
    paper: '#F8F8F6',
    fontDisplay: 'serif',
    fontBody: 'sans',
  },
  {
    key: 'platinum-participation',
    label: 'Platinum Participation',
    description:
      'Curved navy wave with CPCCU emblem, quote pill card and QR verification.',
    accent: '#0B1B3D',
    accentSoft: '#EFF6FF',
    ink: '#0B1B3D',
    paper: '#FFFFFF',
    fontDisplay: 'serif',
    fontBody: 'sans',
  },
  {
    key: 'platinum-achievement',
    label: 'Platinum Achievement',
    description:
      'Double gold and navy border with golden laurel medal ribbon position badge.',
    accent: '#C5A059',
    accentSoft: '#FEF3C7',
    ink: '#0B1B3D',
    paper: '#FFFFFF',
    fontDisplay: 'serif',
    fontBody: 'sans',
  },
];

/**
 * Resolves a template key to its definition.
 *
 * Never throws and never returns `undefined`: a record may carry a key that is
 * legal in the schema but missing from this registry (a template removed in a
 * later release), and a preview must still render something.
 */
export const getClientTemplate = (key) =>
  CERTIFICATE_TEMPLATES.find((template) => template.key === key) ||
  CERTIFICATE_TEMPLATES.find(
    (template) => template.key === DEFAULT_CERTIFICATE_TEMPLATE_KEY
  );

export const getTemplateFonts = (template) => ({
  display:
    CERTIFICATE_FONT_STACKS[template?.fontDisplay] ||
    CERTIFICATE_FONT_STACKS.serif,
  body:
    CERTIFICATE_FONT_STACKS[template?.fontBody] || CERTIFICATE_FONT_STACKS.sans,
  mono: CERTIFICATE_FONT_STACKS.mono,
});
