// Shared brand + design tokens for every CPCCU email template.
// Centralizing these here keeps all current and future emails consistent.
//
// NO `import 'server-only'` HERE: this module is a frozen set of string/number
// constants with no server-only dependency, and it must stay importable from a
// Client Component (e.g. to render a template preview).

export const BRAND = {
  name: 'CPCCU',
  fullName: 'Competitive Programming Camp City University',
  // Absolute https URL on purpose: email clients do NOT resolve relative asset
  // paths, and a blocked-image fallback is how a logo usually disappears. This
  // is a Cloudinary delivery URL with `f_auto,q_auto` so the client is served
  // the format it can actually display.
  logoUrl:
    'https://res.cloudinary.com/dua4uga2s/image/upload/f_auto,q_auto/alxvgtkggfbv1e3y5fsy',
  website: 'https://www.cpccu.club/',
  supportEmail: 'cpccu.club@gmail.com',
};

// Named colour tokens. The gradient is a CSS shorthand string and is emitted
// into an inline `style` attribute alongside the flat `primaryDark` colour,
// because Outlook and several webmail clients ignore `background` gradients and
// fall back to the solid colour — the flat value is the real fallback, not an
// accident.
export const COLORS = {
  primary: '#007bff',
  primaryDark: '#0047ab',
  gradient: 'linear-gradient(135deg, #007bff 0%, #0047ab 100%)',
  pageBackground: '#f4f6f8',
  cardBackground: '#ffffff',
  contentBackground: '#f8f9fa',
  border: '#e9ecef',
  text: '#333333',
  textMuted: '#666666',
  textFaint: '#999999',
};

// `font-family` only. NO webfont is loaded: remote font files are blocked by
// most default email clients, so a webfont would only add a round trip while
// still rendering in the system fallback. Body size lives in the templates
// rather than here.
export const TYPOGRAPHY = {
  fontFamily: 'Arial, Helvetica, sans-serif',
  bodySize: '16px',
};

// Email cards are constrained to 600px for consistent rendering on
// desktop and mobile clients. Use the outer wrapper for fluid scaling.
export const CARD_WIDTH = 600;
