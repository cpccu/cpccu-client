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
  withAlpha,
} from './certificate-frame';

const Seal = ({ theme }) => (
  <div
    style={{
      position: 'absolute',
      right: 78,
      bottom: 132,
      width: 104,
      height: 104,
      borderRadius: '50%',
      border: `2px solid ${theme.accent}`,
      background: theme.accentSoft,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 2,
    }}
  >
    <div
      style={{
        position: 'absolute',
        inset: 7,
        borderRadius: '50%',
        border: `1px solid ${withAlpha(theme.accent, 0.55)}`,
      }}
    />
    <span
      style={{
        fontFamily: theme.display,
        fontSize: 17,
        fontWeight: 700,
        letterSpacing: '0.16em',
        color: theme.accent,
      }}
    >
      CPCCU
    </span>
    <span
      style={{
        fontFamily: theme.mono,
        fontSize: 8,
        letterSpacing: '0.28em',
        textTransform: 'uppercase',
        color: withAlpha(theme.accent, 0.85),
      }}
    >
      Official Seal
    </span>
    <span
      style={{
        width: 34,
        height: 1,
        background: withAlpha(theme.accent, 0.6),
        margin: '3px 0',
      }}
    />
    <span
      style={{
        fontFamily: theme.mono,
        fontSize: 7.5,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        color: withAlpha(theme.accent, 0.75),
      }}
    >
      City University
    </span>
  </div>
);

/**
 * Gold Ornate — gold double border and corner flourishes on a cream page,
 * serif type and a gold seal medallion (matching reference image 3).
 */
export function CertificateElegant({ view, theme, signatory }) {
  const cornerPositions = [
    { top: 46, left: 46 },
    { top: 46, right: 46 },
    { bottom: 46, left: 46 },
    { bottom: 46, right: 46 },
  ];

  return (
    <CertificateSheet theme={theme}>
      <div
        style={{
          position: 'absolute',
          inset: 20,
          border: `2px solid ${theme.accent}`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 30,
          border: `1px solid ${theme.accent}`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 37,
          border: `1px solid ${withAlpha(theme.accent, 0.45)}`,
        }}
      />

      {cornerPositions.map((position, index) => (
        <span key={index} style={{ position: 'absolute', ...position }}>
          <span
            style={{
              position: 'absolute',
              width: 22,
              height: 4,
              background: theme.accent,
            }}
          />
          <span
            style={{
              position: 'absolute',
              width: 4,
              height: 22,
              background: theme.accent,
            }}
          />
        </span>
      ))}

      <Seal theme={theme} />

      <div
        style={{
          position: 'absolute',
          inset: '70px 130px 58px 130px',
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
            fontSize: 40,
            color: theme.ink,
            letterSpacing: '0.08em',
          }}
        />

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            margin: '15px 0 17px',
          }}
        >
          <span style={{ width: 70, height: 1, background: theme.accent }} />
          <span
            style={{
              width: 7,
              height: 7,
              background: theme.accent,
              borderRadius: 1,
            }}
          />
          <span style={{ width: 70, height: 1, background: theme.accent }} />
        </div>

        <CertifyIntro
          theme={theme}
          style={{ color: theme.muted, letterSpacing: '0.28em' }}
        />

        <RecipientName
          name={view.recipientName}
          theme={theme}
          style={{ marginTop: 12, color: theme.ink }}
        />

        <RankTag
          label={view.rankLabel}
          theme={theme}
          style={{ color: theme.accent, borderColor: theme.accent }}
        />

        <CertificateBody
          theme={theme}
          maxWidth={660}
          style={{ marginTop: 15, color: theme.muted }}
        >
          {view.description}
        </CertificateBody>

        <EventLine
          eventName={view.contestName}
          theme={theme}
          style={{ marginTop: 14, fontSize: 21 }}
        />

        <div style={{ flex: 1, minHeight: 16 }} />

        <DetailRow
          theme={theme}
          style={{ marginBottom: 28 }}
          itemStyle={{ paddingBottom: 4 }}
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
