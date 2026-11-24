import {
  CertificateBody,
  CertificateHeading,
  CertificateSheet,
  EventLine,
  RankTag,
  RecipientName,
  SignatureRow,
  VerificationFooter,
} from './certificate-frame';

const DetailChip = ({ label, value, theme }) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 3,
      padding: '10px 18px',
      background: theme.wash,
      border: `1px solid ${theme.line}`,
      borderRadius: 8,
      minWidth: 170,
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
      {label}
    </span>
    <span style={{ fontFamily: theme.body, fontSize: 15, fontWeight: 600 }}>
      {value}
    </span>
  </div>
);

/**
 * Modern Minimal — indigo accent, one vertical rule, sans-serif, generous
 * whitespace. No border ornament at all, which is what keeps it distinct from
 * `classic`.
 */
export function CertificateModern({ view, theme, signatory }) {
  const details = [
    { label: 'Issued On', value: view.issueDate },
    { label: 'Certificate ID', value: view.certificateId },
    ...(view.batch ? [{ label: 'Batch', value: view.batch }] : []),
  ].filter((item) => item.value);

  return (
    <CertificateSheet theme={theme}>
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 9,
          background: theme.accent,
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: 9,
          left: 0,
          right: 0,
          height: 3,
          background: theme.accentSoft,
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 12,
          bottom: 0,
          width: 10,
          background: theme.accentSoft,
        }}
      />

      <div
        style={{
          position: 'absolute',
          inset: '70px 96px 62px 112px',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span
            style={{
              fontFamily: theme.mono,
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: '0.3em',
              textTransform: 'uppercase',
              color: theme.accent,
            }}
          >
            CPCCU
          </span>
          <span
            style={{
              fontFamily: theme.mono,
              fontSize: 11,
              letterSpacing: '0.14em',
              color: theme.faint,
            }}
          >
            {view.certificateId}
          </span>
        </div>

        <CertificateHeading
          view={view}
          theme={theme}
          style={{
            marginTop: 30,
            fontSize: 40,
            fontWeight: 800,
            letterSpacing: '-0.01em',
          }}
        />

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            marginTop: 16,
          }}
        >
          <span
            style={{
              width: 56,
              height: 4,
              background: theme.accent,
              borderRadius: 2,
            }}
          />
          <span
            style={{
              fontFamily: theme.body,
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: '0.24em',
              textTransform: 'uppercase',
              color: theme.muted,
            }}
          >
            This is to certify that
          </span>
        </div>

        <RecipientName
          name={view.recipientName}
          theme={theme}
          max={50}
          style={{ marginTop: 18 }}
        />

        <RankTag label={view.rankLabel} theme={theme} />

        <CertificateBody
          theme={theme}
          maxWidth={720}
          style={{ marginTop: 18 }}
        >
          {view.description}
        </CertificateBody>

        <EventLine
          eventName={view.contestName}
          theme={theme}
          style={{ marginTop: 14, fontSize: 21, color: theme.accent }}
        />

        <div style={{ flex: 1, minHeight: 16 }} />

        <div
          style={{
            display: 'flex',
            alignItems: 'stretch',
            gap: 12,
            marginBottom: 30,
          }}
        >
          {details.map((item) => (
            <DetailChip
              key={item.label}
              label={item.label}
              value={item.value}
              theme={theme}
            />
          ))}
        </div>

        <SignatureRow view={view} theme={theme} left={undefined} signatory={signatory || view?.signatory} />

        <VerificationFooter
          view={view}
          theme={theme}
          style={{ marginTop: 26 }}
        />
      </div>
    </CertificateSheet>
  );
}
