/**
 * Shared building blocks for the five certificate templates.
 *
 * ⚠️ EVERYTHING HERE RENDERS WITH PLAIN INLINE STYLES AND PLAIN COLOURS.
 * The templates are rasterised by html2canvas for the PDF export, and
 * html2canvas cannot parse `oklch()`, `color-mix()` or CSS custom properties —
 * a colour it cannot parse paints as transparent. That is why this file
 * includes its own tiny hex blender instead of using the app's theme tokens.
 *
 * The layout is authored against a fixed 1056×816 canvas (US Letter landscape at
 * 96dpi (11 × 8.5 in)). Sizes in this file are therefore absolute pixels, not responsive
 * units: the document is scaled down for display with a CSS transform, which
 * leaves the export node at its exact size.
 */

import {
  CERTIFICATE_FONT_STACKS,
  getTemplateFonts,
} from './template-registry';
import { getSignatureImageUrl } from '@/lib/certificate-signatories';

export const CERTIFICATE_WIDTH = 1056;
export const CERTIFICATE_HEIGHT = 816;

export const CERTIFICATE_TYPE_HEADINGS = {
  winner: 'Certificate of Excellence',
  'runner-up': 'Certificate of Achievement',
  '2nd-runner-up': 'Certificate of Achievement',
  participation: 'Certificate of Participation',
};

export const CERTIFICATE_TYPE_LABELS = {
  winner: '1st Place',
  'runner-up': '2nd Place',
  '2nd-runner-up': '3rd Place',
  participation: 'Participant',
};

export const DEFAULT_CERTIFICATE_ISSUER = 'CPCCU - City University';

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

// ── Colour helpers ──────────────────────────────────────────────────────────

const HEX_PATTERN = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

const toRgb = (hex) => {
  const value = String(hex || '').replace('#', '');
  const expanded =
    value.length === 3
      ? value
          .split('')
          .map((char) => char + char)
          .join('')
      : value;

  return {
    r: parseInt(expanded.slice(0, 2), 16),
    g: parseInt(expanded.slice(2, 4), 16),
    b: parseInt(expanded.slice(4, 6), 16),
  };
};

const toHex = (channel) =>
  Math.max(0, Math.min(255, Math.round(channel)))
    .toString(16)
    .padStart(2, '0');

/** Mixes two hex colours. `amount` is how far to move from `from` to `to`. */
export function blendHex(from, to, amount) {
  if (!HEX_PATTERN.test(String(from || '')) || !HEX_PATTERN.test(String(to || ''))) {
    return '#000000';
  }

  const a = toRgb(from);
  const b = toRgb(to);
  const ratio = Math.max(0, Math.min(1, Number(amount) || 0));

  return `#${toHex(a.r + (b.r - a.r) * ratio)}${toHex(
    a.g + (b.g - a.g) * ratio
  )}${toHex(a.b + (b.b - a.b) * ratio)}`;
}

/** Hex colour as an `rgba()` string — html2canvas parses both forms. */
export function withAlpha(hex, alpha) {
  if (!HEX_PATTERN.test(String(hex || ''))) return `rgba(0, 0, 0, ${alpha})`;
  const { r, g, b } = toRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Expands a registry template into the colours and fonts a layout uses.
 *
 * The derived shades are precomputed mixes rather than `opacity` on purpose:
 * a half-transparent text layer rasterises more reliably as a solid blended
 * colour, and it keeps the printed ink predictable.
 */
export function createCertificateTheme(template) {
  const fonts = getTemplateFonts(template);
  const accent = HEX_PATTERN.test(String(template?.accent))
    ? template.accent
    : '#1F4E9C';
  const accentSoft = HEX_PATTERN.test(String(template?.accentSoft))
    ? template.accentSoft
    : '#DCE7F7';
  const ink = HEX_PATTERN.test(String(template?.ink)) ? template.ink : '#16305E';
  const paper = HEX_PATTERN.test(String(template?.paper))
    ? template.paper
    : '#FFFFFF';

  return {
    key: template?.key || 'classic',
    accent,
    accentSoft,
    ink,
    paper,
    display: fonts.display,
    body: fonts.body,
    mono: fonts.mono,
    // Secondary text that still reads at print size on either paper.
    muted: blendHex(ink, paper, 0.45),
    faint: blendHex(ink, paper, 0.7),
    line: blendHex(accent, paper, 0.55),
    wash: blendHex(accentSoft, paper, 0.35),
  };
}

// ── Text helpers ────────────────────────────────────────────────────────────

const clampText = (value, maxLength) => {
  const text = String(value ?? '').trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trimEnd()}\u2026`;
};

/** Deterministic (UTC) date so the server and client render the same string. */
export function formatCertificateDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
}

export function getRankLabel(rank) {
  const parsed = Number(rank);
  return Number.isInteger(parsed) && parsed > 0 ? `Ranked #${parsed}` : '';
}

/**
 * The public verification URL printed on the certificate.
 *
 * `window.location.origin` is used in the browser so the printed link always
 * points at the deployment the member is actually using; the configured site
 * URL is the fallback for the server render.
 */
export function getCertificateVerifyUrl(certificateId) {
  const configured = process.env.NEXT_PUBLIC_SITE_URL || '';
  const origin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : '';
  const base = String(origin || configured || 'https://cpccu.vercel.app').replace(
    /\/+$/,
    ''
  );
  const id = String(certificateId || '').trim();

  return id ? `${base}/certificate/${encodeURIComponent(id)}` : base;
}

/**
 * Flattens a certificate record into what the layouts print.
 *
 * Every field is clamped or defaulted: an admin can save a 400-character
 * contest name or an empty description, and neither may push the layout past
 * the edge of the page.
 */
export function resolveCertificateView(certificate = {}, signatory = null) {
  const certificateType = certificate.certificateType || 'participation';
  const recipientName = clampText(certificate.recipientName, 80);
  const contestName = clampText(certificate.contestName, 110);
  const certificateId = String(certificate.certificateId || '').trim();
  const isParticipation = certificateType === 'participation';

  return {
    certificateId,
    recipientName: recipientName || 'Certificate Recipient',
    contestName: contestName || 'CPCCU Event',
    certificateType,
    heading:
      CERTIFICATE_TYPE_HEADINGS[certificateType] ||
      CERTIFICATE_TYPE_HEADINGS.participation,
    rankLabel: getRankLabel(certificate.rank),
    description:
      clampText(certificate.description, 220) ||
      (isParticipation
        ? `for active participation in ${contestName || 'this event'} organised by the Competitive Programming Camp, City University.`
        : `in recognition of an outstanding performance in ${contestName || 'this event'} organised by the Competitive Programming Camp, City University.`),
    issueDate: formatCertificateDate(certificate.issueDate),
    issuedBy:
      clampText(certificate.issuedBy, 60) || DEFAULT_CERTIFICATE_ISSUER,
    batch: clampText(certificate.batch, 24),
    verifyUrl: getCertificateVerifyUrl(certificateId),
    signatory: signatory || certificate?.signatory || null,
    signatories: certificate?.signatories || ['president', 'coordinator'],
  };
}

/** Longer names step down in size instead of running off the page. */
export function getRecipientNameFontSize(name, { max = 54, min = 30 } = {}) {
  const length = String(name || '').trim().length;
  if (length <= 18) return max;
  return Math.max(min, Math.round(max - (length - 18) * 1.15));
}

// ── Layout pieces ───────────────────────────────────────────────────────────

export function CertificateSheet({ theme, children, style }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: theme.paper,
        color: theme.ink,
        fontFamily: theme.body,
        overflow: 'hidden',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function CertificateHeading({ view, theme, style }) {
  return (
    <h1
      style={{
        margin: 0,
        fontFamily: theme.display,
        fontSize: 42,
        lineHeight: 1.15,
        fontWeight: 700,
        letterSpacing: '0.03em',
        color: theme.ink,
        ...style,
      }}
    >
      {view.heading}
    </h1>
  );
}

export function CertifyIntro({ theme, children = 'This is to certify that', style }) {
  return (
    <p
      style={{
        margin: 0,
        fontFamily: theme.body,
        fontSize: 13,
        fontWeight: 600,
        letterSpacing: '0.32em',
        textTransform: 'uppercase',
        color: theme.faint,
        ...style,
      }}
    >
      {children}
    </p>
  );
}

export function RecipientName({ name, theme, style, max = 54, min = 30 }) {
  return (
    <p
      style={{
        margin: 0,
        fontFamily: theme.display,
        fontSize: getRecipientNameFontSize(name, { max, min }),
        lineHeight: 1.12,
        fontWeight: 700,
        color: theme.ink,
        overflowWrap: 'break-word',
        wordBreak: 'break-word',
        ...style,
      }}
    >
      {name}
    </p>
  );
}

export function CertificateBody({ theme, children, style, maxWidth = 780 }) {
  return (
    <p
      style={{
        margin: 0,
        maxWidth,
        fontFamily: theme.body,
        fontSize: 17,
        lineHeight: 1.65,
        color: theme.muted,
        ...style,
      }}
    >
      {children}
    </p>
  );
}

export function EventLine({ eventName, theme, style }) {
  return (
    <p
      style={{
        margin: 0,
        fontFamily: theme.display,
        fontSize: 22,
        fontWeight: 600,
        color: theme.ink,
        ...style,
      }}
    >
      {eventName}
    </p>
  );
}

export function RankTag({ label, theme, style }) {
  if (!label) return null;

  return (
    <span
      style={{
        display: 'inline-block',
        marginTop: 10,
        padding: '4px 16px',
        border: `1px solid ${theme.accent}`,
        borderRadius: 999,
        fontFamily: theme.mono,
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        color: theme.accent,
        ...style,
      }}
    >
      {label}
    </span>
  );
}

export function DetailRow({ items = [], theme, style, itemStyle }) {
  const visible = items.filter((item) => item && item.value);
  if (!visible.length) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...style,
      }}
    >
      {visible.map((item, index) => (
        <div
          key={item.label}
          style={{ display: 'flex', alignItems: 'center' }}
        >
          {index > 0 ? (
            <span
              style={{
                width: 1,
                height: 34,
                background: theme.line,
                margin: '0 26px',
              }}
            />
          ) : null}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              minWidth: 150,
              ...itemStyle,
            }}
          >
            <span
              style={{
                fontFamily: theme.mono,
                fontSize: 10,
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                color: theme.faint,
              }}
            >
              {item.label}
            </span>
            <span
              style={{
                fontFamily: theme.body,
                fontSize: 15,
                fontWeight: 600,
                color: theme.ink,
              }}
            >
              {item.value}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

export function SignatureLine({ name, title, theme, width = 240, style, imageUrl }) {
  const resolvedImageUrl = imageUrl ? getSignatureImageUrl(imageUrl) : null;
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        width,
        ...style,
      }}
    >
      {resolvedImageUrl ? (
        <img
          src={resolvedImageUrl}
          crossOrigin="anonymous"
          alt=""
          style={{
            height: 48,
            maxWidth: '100%',
            objectFit: 'contain',
            marginBottom: 4,
          }}
        />
      ) : null}
      <div
        style={{
          width: '100%',
          borderTop: `1.5px solid ${theme.ink}`,
          marginBottom: 9,
        }}
      />
      <span
        style={{
          fontFamily: theme.display,
          fontSize: 16,
          fontWeight: 600,
          color: theme.ink,
          textAlign: 'center',
        }}
      >
        {name}
      </span>
      <span
        style={{
          marginTop: 3,
          fontFamily: theme.mono,
          fontSize: 10,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: theme.faint,
          textAlign: 'center',
        }}
      >
        {title}
      </span>
    </div>
  );
}

export function SignatureRow({ view, theme, style, left, right, signatory }) {
  const signatoryKeys = view?.signatories || ['president', 'coordinator'];
  const resolved = signatory || view?.signatory || null;

  // Render the selected signatory roles whenever any are selected. Committee
  // data is optional: without a resolved committee we still print the generic
  // role titles so the chosen count (1-3) is honoured.
  if (Array.isArray(signatoryKeys) && signatoryKeys.length > 0) {
    const roleMap = {
      president: {
        data: resolved?.president || {},
        name: 'President',
        title: 'President',
      },
      vicePresident: {
        data: resolved?.vicePresident || {},
        name: 'Vice President',
        title: 'Vice President',
      },
      generalSecretary: {
        data: resolved?.generalSecretary || {},
        name: 'General Secretary',
        title: 'General Secretary',
      },
      treasurer: {
        data: resolved?.treasurer || {},
        name: 'Treasurer',
        title: 'Treasurer',
      },
      coordinator: {
        data: resolved?.coordinator || {},
        name: 'Contest and Event Coordinator',
        title: 'Contest and Event Coordinator',
      },
    };
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-evenly',
          gap: 16,
          ...style,
        }}
      >
        {signatoryKeys.map((key) => {
          const role = roleMap[key];
          if (!role) return null;
          return (
            <SignatureLine
              key={key}
              name={role.data.name || role.name}
              title={role.data.title || role.title}
              theme={theme}
              width={180}
              imageUrl={role.data.signatureUrl}
            />
          );
        })}
      </div>
    );
  }

  const signatures = [
    left || { name: view?.issuedBy, title: 'Authorised Signatory' },
    right || {
      name: 'CPCCU',
      title: 'Competitive Programming Camp',
    },
  ];

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        gap: 96,
        ...style,
      }}
    >
      {signatures.map((signature) => (
        <SignatureLine
          key={`${signature.title}-${signature.name}`}
          name={signature.name}
          title={signature.title}
          theme={theme}
          imageUrl={signature.signatureUrl}
        />
      ))}
    </div>
  );
}

function hashString(value) {
  let hash = 2166136261;
  const text = String(value || '');
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function createRng(seed) {
  let state = seed || 1;
  return () => {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A QR-looking placeholder — a deterministic grid of squares, not a QR code.
 *
 * Deliberately not a QR library: the printed code carries no payload, it is
 * there so the verification block reads as one. The pattern is seeded from the
 * certificate id, so the same certificate always draws the same squares on
 * every device.
 */
export function QrPlaceholder({
  value,
  size = 74,
  moduleCount = 11,
  quietZone = 2,
  color = '#111827',
  background = '#FFFFFF',
  style,
}) {
  const cell = Math.max(2, Math.floor((size - quietZone * 2) / moduleCount));
  const rng = createRng(hashString(value));
  const cells = [];

  const finderOrigins = [
    [0, 0],
    [0, moduleCount - 3],
    [moduleCount - 3, 0],
  ];

  for (let row = 0; row < moduleCount; row += 1) {
    for (let column = 0; column < moduleCount; column += 1) {
      const finder = finderOrigins.find(
        ([originRow, originColumn]) =>
          row >= originRow &&
          row < originRow + 3 &&
          column >= originColumn &&
          column < originColumn + 3
      );

      const filled = finder
        ? !(row - finder[0] === 1 && column - finder[1] === 1)
        : rng() > 0.55;

      cells.push(filled);
    }
  }

  const innerSize = cell * moduleCount;

  return (
    <div
      style={{
        width: size,
        height: size,
        padding: quietZone,
        boxSizing: 'border-box',
        background,
        border: `1px solid ${color}`,
        ...style,
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${moduleCount}, ${cell}px)`,
          gridTemplateRows: `repeat(${moduleCount}, ${cell}px)`,
          width: innerSize,
          height: innerSize,
        }}
      >
        {cells.map((filled, index) => (
          <span
            key={index}
            style={{
              width: cell,
              height: cell,
              background: filled ? color : background,
            }}
          />
        ))}
      </div>
    </div>
  );
}

export function VerificationFooter({ view, theme, style, qrStyle, textStyle }) {
  if (!view.certificateId) return null;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        ...style,
      }}
    >
      <QrPlaceholder
        value={view.certificateId}
        size={74}
        color={theme.ink}
        background={theme.paper}
        style={qrStyle}
      />
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
          maxWidth: 560,
          textAlign: 'left',
          ...textStyle,
        }}
      >
        <span
          style={{
            fontFamily: theme.mono,
            fontSize: 10,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: theme.faint,
          }}
        >
          Certificate ID
        </span>
        <span
          style={{
            fontFamily: theme.mono,
            fontSize: 13,
            fontWeight: 600,
            color: theme.ink,
          }}
        >
          {view.certificateId}
        </span>
        <span
          style={{
            fontFamily: theme.body,
            fontSize: 11.5,
            color: theme.muted,
            overflowWrap: 'anywhere',
          }}
        >
          Verify at: {view.verifyUrl}
        </span>
      </div>
    </div>
  );
}

/** A faint graph-paper grid drawn as real lines (no gradients to mis-parse). */
export function GridLines({ spacing = 34, color = 'rgba(34, 211, 238, 0.1)' }) {
  const columns = Math.floor(CERTIFICATE_WIDTH / spacing);
  const rows = Math.floor(CERTIFICATE_HEIGHT / spacing);

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      {Array.from({ length: columns }).map((_, index) => (
        <span
          key={`v-${index}`}
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: index * spacing,
            width: 1,
            background: color,
          }}
        />
      ))}
      {Array.from({ length: rows }).map((_, index) => (
        <span
          key={`h-${index}`}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: index * spacing,
            height: 1,
            background: color,
          }}
        />
      ))}
    </div>
  );
}

export const CERTIFICATE_FONTS = CERTIFICATE_FONT_STACKS;
