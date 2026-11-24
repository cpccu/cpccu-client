import {
  CertificateBody,
  CertificateHeading,
  CertificateSheet,
  CertifyIntro,
  DetailRow,
  EventLine,
  RankTag,
  RecipientName,
  SignatureRow,
  VerificationFooter,
} from './certificate-frame';

/**
 * Classic Blue — royal-blue double border, serif type, white paper.
 *
 * The club's house certificate: the closest of the five to what was previously
 * issued by hand (matching reference images 1 and 3).
 */
export function CertificateClassic({ view, theme, signatory }) {
  const cornerPositions = [
    { top: 56, left: 56 },
    { top: 56, right: 56 },
    { bottom: 56, left: 56 },
    { bottom: 56, right: 56 },
  ];

  return (
    <CertificateSheet theme={theme}>
      <div
        style={{
          position: 'absolute',
          inset: 22,
          border: `3px solid ${theme.accent}`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 32,
          border: `1px solid ${theme.accent}`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 39,
          border: `1px solid ${theme.accentSoft}`,
        }}
      />

      {/* Corner blocks that read as ornamental caps at print size. */}
      {cornerPositions.map((position, index) => (
        <span
          key={index}
          style={{
            position: 'absolute',
            width: 12,
            height: 12,
            background: theme.accent,
            ...position,
          }}
        />
      ))}

      <div
        style={{
          position: 'absolute',
          inset: 74,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
        }}
      >
        <CertificateHeading
          view={view}
          theme={theme}
          style={{
            fontSize: 42,
            color: theme.accent,
            letterSpacing: '0.06em',
          }}
        />

        <div
          style={{
            width: 190,
            height: 2,
            background: theme.accent,
            margin: '16px 0 18px',
          }}
        />

        <CertifyIntro theme={theme} style={{ color: theme.muted }} />

        <RecipientName
          name={view.recipientName}
          theme={theme}
          style={{ marginTop: 12, color: theme.ink }}
        />

        <RankTag label={view.rankLabel} theme={theme} />

        <CertificateBody theme={theme} style={{ marginTop: 16 }}>
          {view.description}
        </CertificateBody>

        <EventLine
          eventName={view.contestName}
          theme={theme}
          style={{ marginTop: 16, color: theme.accent }}
        />

        <div style={{ flex: 1, minHeight: 14 }} />

        <DetailRow
          theme={theme}
          style={{ marginBottom: 26 }}
          items={[
            { label: 'Issued On', value: view.issueDate },
            { label: 'Certificate ID', value: view.certificateId },
            ...(view.batch ? [{ label: 'Batch', value: view.batch }] : []),
          ]}
        />

        <SignatureRow view={view} theme={theme} signatory={signatory || view?.signatory} />

        <VerificationFooter
          view={view}
          theme={theme}
          style={{ marginTop: 26 }}
        />
      </div>
    </CertificateSheet>
  );
}
