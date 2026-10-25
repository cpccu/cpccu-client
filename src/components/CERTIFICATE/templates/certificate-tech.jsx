import {
  CertificateSheet,
  DetailRow,
  GridLines,
  RankTag,
  RecipientName,
  SignatureRow,
  VerificationFooter,
  withAlpha,
} from './certificate-frame';

const BRACKET_LENGTH = 54;
const BRACKET_THICKNESS = 3;

// Bars are anchored by corner instead of mirrored with `scale()`: html2canvas
// rasterises transforms poorly, and a flipped element can drop out entirely.
const CornerBracket = ({ color, side }) => {
  const anchor = {
    ...(side.includes('r') ? { right: 0 } : { left: 0 }),
    ...(side.includes('b') ? { bottom: 0 } : { top: 0 }),
  };
  const wrapper = {
    ...(side.includes('r') ? { right: 26 } : { left: 26 }),
    ...(side.includes('b') ? { bottom: 26 } : { top: 26 }),
  };

  return (
    <span style={{ position: 'absolute', ...wrapper }}>
      <span
        style={{
          position: 'absolute',
          width: BRACKET_LENGTH,
          height: BRACKET_THICKNESS,
          background: color,
          ...anchor,
        }}
      />
      <span
        style={{
          position: 'absolute',
          width: BRACKET_THICKNESS,
          height: BRACKET_LENGTH,
          background: color,
          ...anchor,
        }}
      />
    </span>
  );
};

/**
 * Code Grid — dark navy paper, cyan accent, monospaced micro-labels and a
 * graph-paper grid. The technical certificate, for contest and hackathon
 * placements.
 */
export function CertificateTech({ view, theme, signatory }) {
  const accentLine = withAlpha(theme.accent, 0.45);
  const accentFaint = withAlpha(theme.accent, 0.18);

  return (
    <CertificateSheet theme={theme}>
      <GridLines spacing={34} color={accentFaint} />

      <div
        style={{
          position: 'absolute',
          inset: 26,
          border: `1px solid ${accentLine}`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 34,
          border: `1px solid ${withAlpha(theme.accent, 0.16)}`,
        }}
      />

      <CornerBracket color={theme.accent} side="tl" />
      <CornerBracket color={theme.accent} side="tr" />
      <CornerBracket color={theme.accent} side="bl" />
      <CornerBracket color={theme.accent} side="br" />

      <div
        style={{
          position: 'absolute',
          inset: '66px 78px 60px 78px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
        }}
      >
        <div
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontFamily: theme.mono,
            fontSize: 12,
            letterSpacing: '0.14em',
            color: theme.accent,
          }}
        >
          <span>CPCCU://CERTIFICATES</span>
          <span style={{ color: withAlpha(theme.accent, 0.75) }}>
            {view.certificateId || 'PENDING-ID'}
          </span>
        </div>

        <span
          style={{
            marginTop: 34,
            fontFamily: theme.mono,
            fontSize: 12,
            letterSpacing: '0.26em',
            textTransform: 'uppercase',
            color: withAlpha(theme.accent, 0.85),
          }}
        >
          {'<!-- verified credential -->'}
        </span>

        <h1
          style={{
            margin: '12px 0 0',
            fontFamily: theme.body,
            fontSize: 40,
            fontWeight: 800,
            letterSpacing: '0.01em',
            color: theme.ink,
          }}
        >
          {view.heading}
        </h1>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginTop: 18,
          }}
        >
          <span style={{ width: 10, height: 10, background: theme.accent }} />
          <span
            style={{
              fontFamily: theme.mono,
              fontSize: 13,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: theme.muted,
            }}
          >
            This is to certify that
          </span>
          <span style={{ width: 10, height: 10, background: theme.accent }} />
        </div>

        <RecipientName
          name={view.recipientName}
          theme={theme}
          max={50}
          style={{ marginTop: 16, color: theme.ink }}
        />

        <RankTag
          label={view.rankLabel}
          theme={theme}
          style={{ color: theme.accent, borderColor: theme.accent }}
        />

        <p
          style={{
            margin: '16px 0 0',
            maxWidth: 780,
            fontFamily: theme.body,
            fontSize: 17,
            lineHeight: 1.6,
            color: theme.muted,
          }}
        >
          {view.description}
        </p>

        <p
          style={{
            margin: '16px 0 0',
            fontFamily: theme.mono,
            fontSize: 18,
            fontWeight: 600,
            color: theme.accent,
          }}
        >
          $ event = &quot;{view.contestName}&quot;
        </p>

        <div style={{ flex: 1, minHeight: 14 }} />

        <DetailRow
          theme={theme}
          style={{ marginBottom: 24 }}
          itemStyle={{
            padding: '8px 16px',
            border: `1px solid ${withAlpha(theme.accent, 0.35)}`,
            background: withAlpha(theme.accent, 0.06),
          }}
          items={[
            { label: 'issued_on()', value: view.issueDate },
            { label: 'certificate_id()', value: view.certificateId },
            ...(view.batch ? [{ label: 'batch()', value: view.batch }] : []),
          ]}
        />

        <SignatureRow
          view={view}
          theme={theme}
          left={{ name: view.issuedBy, title: 'authorised_signatory' }}
          right={{ name: 'CPCCU', title: 'competitive_programming_camp' }}
          signatory={signatory || view?.signatory}
        />

        <VerificationFooter
          view={view}
          theme={theme}
          style={{ marginTop: 24 }}
        />
      </div>
    </CertificateSheet>
  );
}
