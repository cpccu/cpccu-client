import {
  CertificateBody,
  CertificateSheet,
  DetailRow,
  RankTag,
  RecipientName,
  SignatureRow,
  VerificationFooter,
} from './certificate-frame';

const BandCircle = ({ size, color, style }) => (
  <span
    style={{
      position: 'absolute',
      width: size,
      height: size,
      borderRadius: '50%',
      border: `2px solid ${color}`,
      ...style,
    }}
  />
);

/**
 * Vibrant Gradient — bold sans-serif under a pink gradient banner, with
 * geometric accents. The loudest of the five, for participation certificates
 * from community events.
 */
export function CertificateVibrant({ view, theme, signatory }) {
  return (
    <CertificateSheet theme={theme}>
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 182,
          background:
            'linear-gradient(118deg, #BE185D 0%, #DB2777 46%, #F97316 100%)',
          overflow: 'hidden',
        }}
      >
        <BandCircle size={220} color="rgba(255, 255, 255, 0.18)" style={{ top: -84, right: 64 }} />
        <BandCircle size={132} color="rgba(255, 255, 255, 0.14)" style={{ bottom: -46, right: 238 }} />
        <BandCircle size={72} color="rgba(255, 255, 255, 0.2)" style={{ top: 34, left: 82 }} />

        <div
          style={{
            position: 'absolute',
            inset: '30px 84px 26px 84px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            color: '#FFFFFF',
          }}
        >
          <span
            style={{
              fontFamily: theme.mono,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.34em',
              textTransform: 'uppercase',
              color: 'rgba(255, 255, 255, 0.85)',
            }}
          >
            CPCCU · City University
          </span>
          <h1
            style={{
              margin: '12px 0 0',
              fontFamily: theme.body,
              fontSize: 42,
              fontWeight: 800,
              letterSpacing: '-0.01em',
              color: '#FFFFFF',
            }}
          >
            {view.heading}
          </h1>
          <p
            style={{
              margin: '10px 0 0',
              fontFamily: theme.body,
              fontSize: 19,
              fontWeight: 600,
              color: 'rgba(255, 255, 255, 0.94)',
            }}
          >
            {view.contestName}
          </p>
        </div>
      </div>

      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: 8,
          background:
            'linear-gradient(118deg, #BE185D 0%, #DB2777 46%, #F97316 100%)',
        }}
      />

      <div
        style={{
          position: 'absolute',
          inset: '216px 104px 54px 104px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
        }}
      >
        <span
          style={{
            fontFamily: theme.body,
            fontSize: 12.5,
            fontWeight: 700,
            letterSpacing: '0.3em',
            textTransform: 'uppercase',
            color: theme.accent,
          }}
        >
          This is to certify that
        </span>

        <RecipientName
          name={view.recipientName}
          theme={theme}
          max={52}
          style={{ marginTop: 10, color: theme.ink }}
        />

        <RankTag label={view.rankLabel} theme={theme} />

        <CertificateBody
          theme={theme}
          maxWidth={760}
          style={{ marginTop: 14, color: theme.muted }}
        >
          {view.description}
        </CertificateBody>

        <div style={{ flex: 1, minHeight: 12 }} />

        <DetailRow
          theme={theme}
          style={{ marginBottom: 22 }}
          itemStyle={{
            padding: '9px 16px',
            background: theme.wash,
            borderRadius: 8,
          }}
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
          style={{ marginTop: 24 }}
        />
      </div>
    </CertificateSheet>
  );
}
