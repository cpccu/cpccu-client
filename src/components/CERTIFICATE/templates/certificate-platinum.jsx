'use client';

import {
  CertificateSheet,
  getRecipientNameFontSize,
  QrPlaceholder,
} from './certificate-frame';

/**
 * A decorative gold diamond divider with thin horizontal wings.
 */
const DiamondDivider = ({ width = 140, color = '#C5A059', style }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width,
      margin: '6px auto',
      ...style,
    }}
  >
    <div
      style={{
        flex: 1,
        height: 1,
        background: `linear-gradient(90deg, transparent, ${color})`,
      }}
    />
    <div
      style={{
        width: 7,
        height: 7,
        background: color,
        transform: 'rotate(45deg)',
        margin: '0 8px',
        flexShrink: 0,
      }}
    />
    <div
      style={{
        flex: 1,
        height: 1,
        background: `linear-gradient(90deg, ${color}, transparent)`,
      }}
    />
  </div>
);

/**
 * Verification QR Badge (Top Right for P1 and P2)
 */
const VerificationQrTopRight = ({ certificateId, verifyUrl }) => (
  <div
    style={{
      position: 'absolute',
      top: 26,
      right: 32,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      zIndex: 10,
    }}
  >
    <QrPlaceholder
      value={certificateId || 'CPCCU-VERIFY'}
      size={72}
      moduleCount={11}
      color="#0B1B3D"
      background="#FFFFFF"
      style={{
        border: '1px solid #CBD5E1',
        borderRadius: 4,
        boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
      }}
    />
    <span
      style={{
        marginTop: 4,
        fontFamily: "Helvetica, Arial, sans-serif",
        fontSize: 10.5,
        color: '#475569',
      }}
    >
      Verify at:
    </span>
    <span
      style={{
        fontFamily: "Helvetica, Arial, sans-serif",
        fontSize: 11,
        fontWeight: 700,
        color: '#0070F3',
        letterSpacing: '0.02em',
      }}
    >
      cpccu.club
    </span>
  </div>
);

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * VARIANT 1: Platinum Appreciation & Hackathon (template_platinum.jpeg)
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function PlatinumAppreciation({ view, theme, signatory }) {
  const resolvedSignatory = signatory || view?.signatory || null;
  const presidentSig =
    resolvedSignatory?.president?.signatureUrl ||
    '/assets/certificates/signature_president.png';
  const vpSig =
    resolvedSignatory?.vicePresident?.signatureUrl ||
    resolvedSignatory?.coordinator?.signatureUrl ||
    '/assets/certificates/signature_vp.png';

  const presidentName = resolvedSignatory?.president?.name || 'PRESIDENT';
  const presidentTitle =
    resolvedSignatory?.president?.title || 'COMPETITIVE PROGRAMMING CAMP';

  const vpName =
    resolvedSignatory?.vicePresident?.name ||
    resolvedSignatory?.coordinator?.name ||
    'VICE PRESIDENT';
  const vpTitle =
    resolvedSignatory?.vicePresident?.title ||
    resolvedSignatory?.coordinator?.title ||
    'COMPETITIVE PROGRAMMING CAMP';

  const isDefaultContest =
    !view.contestName ||
    view.contestName === 'CPCCU Event' ||
    view.contestName.includes('HACKATHON') ||
    view.contestName.includes('AI-POWERED');

  const contestTitle = isDefaultContest
    ? 'AI-POWERED WEB APP DEVELOPMENT & DEPLOYMENT HACKATHON 2026'
    : view.contestName;

  let roleText = 'ORGANIZING TEAM MEMBER';
  if (view.rankLabel) {
    roleText = view.rankLabel.toUpperCase();
  } else if (view.certificateType === 'winner') {
    roleText = 'WINNER (1ST PLACE)';
  } else if (view.certificateType === 'runner-up') {
    roleText = 'RUNNER UP (2ND PLACE)';
  } else if (view.certificateType === '2nd-runner-up') {
    roleText = '2ND RUNNER UP (3RD PLACE)';
  }

  const nameFontSize = getRecipientNameFontSize(view.recipientName, {
    max: 68,
    min: 36,
  });

  return (
    <CertificateSheet
      theme={theme}
      style={{
        background: '#F8F8F6',
        fontFamily: "Helvetica, Arial, 'Inria Sans', sans-serif",
      }}
    >
      <img
        src="/assets/certificates/platinum_bg.png"
        alt=""
        crossOrigin="anonymous"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: 1056,
          height: 816,
          objectFit: 'fill',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      />

      {/* Top Center: Event & Contest Header */}
      <div
        style={{
          position: 'absolute',
          top: 62,
          left: 330,
          right: 280,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          pointerEvents: 'none',
        }}
      >
        <span
          style={{
            fontFamily:
              "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
            fontSize: 27,
            fontWeight: 900,
            fontStyle: 'italic',
            letterSpacing: '0.04em',
            background:
              'linear-gradient(135deg, #0B1B3D 0%, #0369A1 65%, #0284C7 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            textTransform: 'uppercase',
            lineHeight: 1.1,
          }}
        >
          AI-POWERED
        </span>
        <span
          style={{
            marginTop: 4,
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.12em',
            color: '#0B1B3D',
            textTransform: 'uppercase',
          }}
        >
          {isDefaultContest ? 'WEB APP DEVELOPMENT & DEPLOYMENT' : contestTitle}
        </span>
        <span
          style={{
            marginTop: 3,
            fontSize: 18,
            fontWeight: 800,
            letterSpacing: '0.14em',
            color: '#0070F3',
            textTransform: 'uppercase',
          }}
        >
          {isDefaultContest ? 'HACKATHON 2026' : (view.rankLabel || 'OFFICIAL CERTIFICATE')}
        </span>
      </div>

      {/* Main Center Content */}
      <div
        style={{
          position: 'absolute',
          top: 178,
          left: 210,
          right: 210,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
        }}
      >
        <h1
          style={{
            margin: 0,
            fontFamily:
              "'Cinzel', 'Playfair Display', Georgia, 'Times New Roman', serif",
            fontSize: 66,
            fontWeight: 700,
            letterSpacing: '0.08em',
            color: '#0B1B3D',
            lineHeight: 1,
          }}
        >
          CERTIFICATE
        </h1>

        <h2
          style={{
            margin: '6px 0 0 0',
            fontFamily:
              "'Cinzel', 'Playfair Display', Georgia, 'Times New Roman', serif",
            fontSize: 24,
            fontWeight: 600,
            letterSpacing: '0.38em',
            color: '#C5A059',
            lineHeight: 1.2,
          }}
        >
          OF APPRECIATION
        </h2>

        <DiamondDivider width={140} color="#C5A059" style={{ margin: '8px auto 6px auto' }} />

        <p
          style={{
            margin: 0,
            fontFamily: "Helvetica, Arial, sans-serif",
            fontSize: 12.5,
            fontWeight: 600,
            letterSpacing: '0.26em',
            textTransform: 'uppercase',
            color: '#334155',
          }}
        >
          THIS CERTIFICATE IS PROUDLY PRESENTED TO
        </p>

        <div
          style={{
            margin: '0 auto',
            minHeight: 74,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span
            style={{
              fontFamily:
                "'Alex Brush', 'Great Vibes', 'Brush Script MT', cursive",
              fontSize: nameFontSize,
              fontWeight: 400,
              color: '#0B1B3D',
              lineHeight: 1.15,
              whiteSpace: 'nowrap',
              textShadow: '0 1px 1px rgba(11, 27, 61, 0.08)',
            }}
          >
            {view.recipientName}
          </span>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 420,
            margin: '0 auto 10px auto',
          }}
        >
          <div
            style={{
              flex: 1,
              height: 1.5,
              background: 'linear-gradient(90deg, transparent, #C5A059)',
            }}
          />
          <div
            style={{
              width: 7,
              height: 7,
              background: '#C5A059',
              transform: 'rotate(45deg)',
              margin: '0 8px',
              flexShrink: 0,
            }}
          />
          <div
            style={{
              flex: 1,
              height: 1.5,
              background: 'linear-gradient(90deg, #C5A059, transparent)',
            }}
          />
        </div>

        <div
          style={{
            maxWidth: 560,
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontSize: 14.5,
            lineHeight: 1.6,
            color: '#334155',
          }}
        >
          <p style={{ margin: 0 }}>
            In recognition of your valuable contribution and dedicated service as a{' '}
            <strong
              style={{
                fontFamily: "Helvetica, Arial, sans-serif",
                fontWeight: 800,
                color: '#0B1B3D',
                letterSpacing: '0.04em',
              }}
            >
              {roleText}
            </strong>{' '}
            for the{' '}
            <strong
              style={{
                fontFamily: "Helvetica, Arial, sans-serif",
                fontWeight: 800,
                color: '#0070F3',
                letterSpacing: '0.03em',
              }}
            >
              {contestTitle}.
            </strong>
          </p>
          <p style={{ margin: '8px 0 0 0', fontSize: 13.5, color: '#475569' }}>
            Your commitment, teamwork, and efforts played an important role in making this
            event a success. We sincerely appreciate your contribution to fostering
            innovation, creativity, and technological excellence.
          </p>
        </div>
      </div>

      {/* Bottom Signatures */}
      <div
        style={{
          position: 'absolute',
          top: 618,
          left: 0,
          right: 0,
          height: 140,
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 220,
            top: 0,
            width: 175,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              height: 56,
              width: '100%',
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              marginBottom: 4,
            }}
          >
            {presidentSig ? (
              <img
                src={presidentSig}
                crossOrigin="anonymous"
                alt=""
                style={{
                  maxHeight: 52,
                  maxWidth: 160,
                  objectFit: 'contain',
                }}
              />
            ) : null}
          </div>
          <div
            style={{
              width: '100%',
              height: 1.5,
              background: '#0B1B3D',
              marginBottom: 7,
            }}
          />
          <span
            style={{
              fontFamily: "Helvetica, Arial, sans-serif",
              fontSize: 12.5,
              fontWeight: 800,
              letterSpacing: '0.14em',
              color: '#0B1B3D',
              textTransform: 'uppercase',
              textAlign: 'center',
            }}
          >
            {presidentName}
          </span>
          <span
            style={{
              marginTop: 2,
              fontFamily: "Helvetica, Arial, sans-serif",
              fontSize: 9.5,
              letterSpacing: '0.06em',
              color: '#475569',
              textAlign: 'center',
              textTransform: 'uppercase',
            }}
          >
            {presidentTitle}
          </span>
          <span
            style={{
              marginTop: 1,
              fontFamily: "Helvetica, Arial, sans-serif",
              fontSize: 9,
              letterSpacing: '0.06em',
              color: '#475569',
              textAlign: 'center',
            }}
          >
            (CPCCU)
          </span>
        </div>

        <div
          style={{
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
            top: 48,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <DiamondDivider width={130} color="#C5A059" style={{ margin: '0 auto 5px auto' }} />
          <span
            style={{
              fontFamily: "Helvetica, Arial, sans-serif",
              fontSize: 9.5,
              fontWeight: 700,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: '#475569',
            }}
          >
            HELD ON
          </span>
          <span
            style={{
              marginTop: 3,
              fontFamily: "Helvetica, Arial, sans-serif",
              fontSize: 12.5,
              fontWeight: 800,
              letterSpacing: '0.1em',
              color: '#0B1B3D',
              textTransform: 'uppercase',
            }}
          >
            {view.issueDate || '07 OCTOBER 2026'}
          </span>
          {view.certificateId ? (
            <span
              style={{
                marginTop: 4,
                fontFamily: "ui-monospace, 'Courier New', monospace",
                fontSize: 9,
                letterSpacing: '0.12em',
                color: '#64748B',
              }}
            >
              ID: {view.certificateId}
            </span>
          ) : null}
        </div>

        <div
          style={{
            position: 'absolute',
            right: 220,
            top: 0,
            width: 175,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              height: 56,
              width: '100%',
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              marginBottom: 4,
            }}
          >
            {vpSig ? (
              <img
                src={vpSig}
                crossOrigin="anonymous"
                alt=""
                style={{
                  maxHeight: 52,
                  maxWidth: 160,
                  objectFit: 'contain',
                }}
              />
            ) : null}
          </div>
          <div
            style={{
              width: '100%',
              height: 1.5,
              background: '#0B1B3D',
              marginBottom: 7,
            }}
          />
          <span
            style={{
              fontFamily: "Helvetica, Arial, sans-serif",
              fontSize: 12.5,
              fontWeight: 800,
              letterSpacing: '0.14em',
              color: '#0B1B3D',
              textTransform: 'uppercase',
              textAlign: 'center',
            }}
          >
            {vpName}
          </span>
          <span
            style={{
              marginTop: 2,
              fontFamily: "Helvetica, Arial, sans-serif",
              fontSize: 9.5,
              letterSpacing: '0.06em',
              color: '#475569',
              textAlign: 'center',
              textTransform: 'uppercase',
            }}
          >
            {vpTitle}
          </span>
          <span
            style={{
              marginTop: 1,
              fontFamily: "Helvetica, Arial, sans-serif",
              fontSize: 9,
              letterSpacing: '0.06em',
              color: '#475569',
              textAlign: 'center',
            }}
          >
            (CPCCU)
          </span>
        </div>
      </div>
    </CertificateSheet>
  );
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * VARIANT 2: Platinum Participation (template_platinum_1.jpeg)
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function PlatinumParticipation({ view, theme, signatory }) {
  const resolvedSignatory = signatory || view?.signatory || null;
  const presidentSig =
    resolvedSignatory?.president?.signatureUrl ||
    '/assets/certificates/signature_zahin.png';
  const vpSig =
    resolvedSignatory?.vicePresident?.signatureUrl ||
    resolvedSignatory?.coordinator?.signatureUrl ||
    '/assets/certificates/signature_rihad.png';

  const presidentName = resolvedSignatory?.president?.name || 'Zalim';
  const presidentTitle = resolvedSignatory?.president?.title || 'President';

  const vpName =
    resolvedSignatory?.vicePresident?.name ||
    resolvedSignatory?.coordinator?.name ||
    'Rihad';
  const vpTitle =
    resolvedSignatory?.vicePresident?.title ||
    resolvedSignatory?.coordinator?.title ||
    'Vice President';

  const contestTitle =
    view.contestName && view.contestName !== 'CPCCU Event'
      ? view.contestName
      : 'Beat the vibe Programming Contest';

  const nameFontSize = getRecipientNameFontSize(view.recipientName, {
    max: 64,
    min: 36,
  });

  return (
    <CertificateSheet
      theme={theme}
      style={{
        background: '#FFFFFF',
        fontFamily: "Helvetica, Arial, 'Inria Sans', sans-serif",
      }}
    >
      <img
        src="/assets/certificates/platinum_p1_bg.png"
        alt=""
        crossOrigin="anonymous"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: 1056,
          height: 816,
          objectFit: 'fill',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      />

      <VerificationQrTopRight
        certificateId={view.certificateId}
        verifyUrl={view.verifyUrl}
      />

      {/* Main Center Content */}
      <div
        style={{
          position: 'absolute',
          top: 72,
          left: 280,
          right: 140,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
        }}
      >
        <h2
          style={{
            margin: 0,
            fontFamily:
              "'Cinzel', 'Playfair Display', Georgia, 'Times New Roman', serif",
            fontSize: 29,
            fontWeight: 800,
            letterSpacing: '0.06em',
            color: '#0B1B3D',
            textTransform: 'uppercase',
          }}
        >
          CITY UNIVERSITY
        </h2>
        <p
          style={{
            margin: '4px 0 0 0',
            fontFamily: "Helvetica, Arial, sans-serif",
            fontSize: 13.5,
            fontWeight: 600,
            color: '#1E293B',
          }}
        >
          Competitive Programming Camp City University
        </p>

        <DiamondDivider width={160} color="#C5A059" style={{ margin: '10px auto' }} />

        <h3
          style={{
            margin: 0,
            fontFamily:
              "'Cinzel', 'Playfair Display', Georgia, 'Times New Roman', serif",
            fontSize: 20,
            fontWeight: 700,
            letterSpacing: '0.2em',
            color: '#0B1B3D',
            textTransform: 'uppercase',
          }}
        >
          CERTIFICATE OF
        </h3>
        <h1
          style={{
            margin: '2px 0 0 0',
            fontFamily:
              "'Cinzel', 'Playfair Display', Georgia, 'Times New Roman', serif",
            fontSize: 54,
            fontWeight: 800,
            letterSpacing: '0.08em',
            color: '#0B1B3D',
            lineHeight: 1.05,
          }}
        >
          PARTICIPATION
        </h1>

        <DiamondDivider width={140} color="#C5A059" style={{ margin: '10px auto 8px auto' }} />

        <p
          style={{
            margin: 0,
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontSize: 14,
            color: '#334155',
          }}
        >
          This is to certify that
        </p>

        <div
          style={{
            margin: '0 auto',
            minHeight: 70,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span
            style={{
              fontFamily:
                "'Alex Brush', 'Great Vibes', 'Brush Script MT', cursive",
              fontSize: nameFontSize,
              fontWeight: 400,
              color: '#0B1B3D',
              lineHeight: 1.15,
              whiteSpace: 'nowrap',
            }}
          >
            {view.recipientName}
          </span>
        </div>

        <div
          style={{
            width: 380,
            height: 1,
            background: '#64748B',
            margin: '0 auto 12px auto',
          }}
        />

        <p
          style={{
            margin: 0,
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontSize: 14.5,
            color: '#334155',
          }}
        >
          has successfully participated in the
        </p>
        <p
          style={{
            margin: '6px 0 4px 0',
            fontFamily:
              "'Cinzel', 'Playfair Display', Georgia, 'Times New Roman', serif",
            fontSize: 21,
            fontWeight: 800,
            color: '#DC2626',
            letterSpacing: '0.02em',
          }}
        >
          {contestTitle}
        </p>
        <p
          style={{
            margin: 0,
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontSize: 14,
            color: '#334155',
          }}
        >
          organized by Competitive Programming Camp City University
        </p>
        <p
          style={{
            margin: '3px 0 0 0',
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontSize: 14,
            color: '#334155',
          }}
        >
          held on {view.issueDate || '27 September 2025'}
        </p>

        {/* Quote Card */}
        <div
          style={{
            marginTop: 14,
            display: 'inline-flex',
            alignItems: 'center',
            padding: '8px 22px',
            background: 'rgba(238, 242, 255, 0.75)',
            border: '1px solid #E0E7FF',
            borderRadius: 8,
          }}
        >
          <span
            style={{
              fontFamily: "Georgia, serif",
              fontSize: 22,
              fontWeight: 700,
              color: '#C5A059',
              marginRight: 8,
            }}
          >
            &#123;
          </span>
          <span
            style={{
              fontFamily: "Georgia, 'Times New Roman', serif",
              fontStyle: 'italic',
              fontSize: 13,
              color: '#334155',
            }}
          >
            "Thank you for being a part of our journey and contributing to a vibrant
            coding community."
          </span>
          <span
            style={{
              fontFamily: "Georgia, serif",
              fontSize: 22,
              fontWeight: 700,
              color: '#C5A059',
              marginLeft: 8,
            }}
          >
            &#125;
          </span>
        </div>
      </div>

      {/* Bottom Section */}
      <div
        style={{
          position: 'absolute',
          bottom: 38,
          left: 260,
          right: 120,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: 140,
          }}
        >
          <div
            style={{
              height: 48,
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              marginBottom: 4,
            }}
          >
            {presidentSig ? (
              <img
                src={presidentSig}
                crossOrigin="anonymous"
                alt=""
                style={{ maxHeight: 46, maxWidth: 130, objectFit: 'contain' }}
              />
            ) : null}
          </div>
          <div
            style={{ width: '100%', height: 1.5, background: '#0B1B3D', marginBottom: 6 }}
          />
          <span
            style={{
              fontFamily: "Helvetica, Arial, sans-serif",
              fontSize: 13.5,
              fontWeight: 800,
              color: '#0B1B3D',
            }}
          >
            {presidentName}
          </span>
          <span
            style={{
              fontFamily: "Helvetica, Arial, sans-serif",
              fontSize: 11,
              fontWeight: 600,
              color: '#475569',
            }}
          >
            CPCCU
          </span>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            marginBottom: 6,
          }}
        >
          <DiamondDivider width={110} color="#C5A059" style={{ margin: '0 auto 4px auto' }} />
          <span
            style={{
              fontFamily: "ui-monospace, 'Courier New', monospace",
              fontSize: 11,
              fontWeight: 600,
              color: '#334155',
            }}
          >
            Certificate ID: {view.certificateId || 'CPCCU-2026-00123'}
          </span>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: 140,
          }}
        >
          <div
            style={{
              height: 48,
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              marginBottom: 4,
            }}
          >
            {vpSig ? (
              <img
                src={vpSig}
                crossOrigin="anonymous"
                alt=""
                style={{ maxHeight: 46, maxWidth: 130, objectFit: 'contain' }}
              />
            ) : null}
          </div>
          <div
            style={{ width: '100%', height: 1.5, background: '#0B1B3D', marginBottom: 6 }}
          />
          <span
            style={{
              fontFamily: "Helvetica, Arial, sans-serif",
              fontSize: 13.5,
              fontWeight: 800,
              color: '#0B1B3D',
            }}
          >
            {vpName}
          </span>
          <span
            style={{
              fontFamily: "Helvetica, Arial, sans-serif",
              fontSize: 11,
              fontWeight: 600,
              color: '#475569',
            }}
          >
            CPCCU
          </span>
        </div>
      </div>
    </CertificateSheet>
  );
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * VARIANT 3: Platinum Achievement / Position (template_platinum_2.jpeg)
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function PlatinumAchievement({ view, theme, signatory }) {
  const resolvedSignatory = signatory || view?.signatory || null;
  const presidentSig =
    resolvedSignatory?.president?.signatureUrl ||
    '/assets/certificates/signature_zahin.png';
  const vpSig =
    resolvedSignatory?.vicePresident?.signatureUrl ||
    resolvedSignatory?.coordinator?.signatureUrl ||
    '/assets/certificates/signature_rihad.png';

  const presidentName = resolvedSignatory?.president?.name || 'Zalim';
  const presidentTitle = resolvedSignatory?.president?.title || 'President';

  const vpName =
    resolvedSignatory?.vicePresident?.name ||
    resolvedSignatory?.coordinator?.name ||
    'Rihad';
  const vpTitle =
    resolvedSignatory?.vicePresident?.title ||
    resolvedSignatory?.coordinator?.title ||
    'Vice President';

  const contestTitle =
    view.contestName && view.contestName !== 'CPCCU Event'
      ? view.contestName
      : 'Beat the vibe Programming Contest';

  const nameFontSize = getRecipientNameFontSize(view.recipientName, {
    max: 64,
    min: 36,
  });

  return (
    <CertificateSheet
      theme={theme}
      style={{
        background: '#FFFFFF',
        fontFamily: "Helvetica, Arial, 'Inria Sans', sans-serif",
      }}
    >
      <img
        src="/assets/certificates/platinum_p2_bg.png"
        alt=""
        crossOrigin="anonymous"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: 1056,
          height: 816,
          objectFit: 'fill',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      />

      <VerificationQrTopRight
        certificateId={view.certificateId}
        verifyUrl={view.verifyUrl}
      />

      {/* Main Center Content */}
      <div
        style={{
          position: 'absolute',
          top: 72,
          left: 170,
          right: 170,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
        }}
      >
        <h2
          style={{
            margin: 0,
            fontFamily:
              "'Cinzel', 'Playfair Display', Georgia, 'Times New Roman', serif",
            fontSize: 32,
            fontWeight: 800,
            letterSpacing: '0.06em',
            color: '#0B1B3D',
            textTransform: 'uppercase',
          }}
        >
          CITY UNIVERSITY
        </h2>
        <p
          style={{
            margin: '4px 0 0 0',
            fontFamily: "Helvetica, Arial, sans-serif",
            fontSize: 14,
            fontWeight: 600,
            color: '#1E293B',
          }}
        >
          Competitive Programming Camp City University
        </p>

        <DiamondDivider width={160} color="#C5A059" style={{ margin: '10px auto' }} />

        <h1
          style={{
            margin: '2px 0 0 0',
            fontFamily:
              "'Cinzel', 'Playfair Display', Georgia, 'Times New Roman', serif",
            fontSize: 34,
            fontWeight: 800,
            letterSpacing: '0.14em',
            color: '#C5A059',
            textTransform: 'uppercase',
            lineHeight: 1.1,
          }}
        >
          CERTIFICATE OF ACHIEVEMENT
        </h1>

        <p
          style={{
            margin: '10px 0 0 0',
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontSize: 14.5,
            color: '#334155',
          }}
        >
          This is to certify that
        </p>

        <div
          style={{
            margin: '0 auto',
            minHeight: 70,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span
            style={{
              fontFamily:
                "'Alex Brush', 'Great Vibes', 'Brush Script MT', cursive",
              fontSize: nameFontSize,
              fontWeight: 400,
              color: '#0B1B3D',
              lineHeight: 1.15,
              whiteSpace: 'nowrap',
            }}
          >
            {view.recipientName}
          </span>
        </div>

        <div
          style={{
            width: 380,
            height: 1,
            background: '#64748B',
            margin: '0 auto 10px auto',
          }}
        />

        <p
          style={{
            margin: 0,
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontSize: 14,
            color: '#334155',
          }}
        >
          has successfully achieved
        </p>

        {/* 1st / 2nd / 3rd Position Laurel Ribbon Badge */}
        <div
          style={{
            margin: '6px auto',
            height: 72,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <img
            src="/assets/certificates/platinum_badge_1st.png"
            crossOrigin="anonymous"
            alt="1st POSITION"
            style={{
              height: 72,
              objectFit: 'contain',
              filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))',
            }}
          />
        </div>

        <p
          style={{
            margin: '4px 0 0 0',
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontSize: 14,
            color: '#334155',
          }}
        >
          in the programming contest
        </p>
        <p
          style={{
            margin: '4px 0 4px 0',
            fontFamily:
              "'Cinzel', 'Playfair Display', Georgia, 'Times New Roman', serif",
            fontSize: 21,
            fontWeight: 800,
            color: '#DC2626',
            letterSpacing: '0.02em',
          }}
        >
          {contestTitle}
        </p>

        <DiamondDivider width={120} color="#C5A059" style={{ margin: '6px auto' }} />

        <p
          style={{
            margin: 0,
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontSize: 13.5,
            color: '#334155',
          }}
        >
          organized by Competitive Programming Camp City University
        </p>
        <p
          style={{
            margin: '2px 0 0 0',
            fontFamily: "Georgia, 'Times New Roman', serif",
            fontSize: 13.5,
            color: '#334155',
          }}
        >
          held on {view.issueDate || '27 September 2025'}
        </p>
      </div>

      {/* Bottom Section */}
      <div
        style={{
          position: 'absolute',
          bottom: 38,
          left: 170,
          right: 170,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: 140,
          }}
        >
          <div
            style={{
              height: 48,
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              marginBottom: 4,
            }}
          >
            {presidentSig ? (
              <img
                src={presidentSig}
                crossOrigin="anonymous"
                alt=""
                style={{ maxHeight: 46, maxWidth: 130, objectFit: 'contain' }}
              />
            ) : null}
          </div>
          <div
            style={{ width: '100%', height: 1.5, background: '#0B1B3D', marginBottom: 6 }}
          />
          <span
            style={{
              fontFamily: "Helvetica, Arial, sans-serif",
              fontSize: 13.5,
              fontWeight: 800,
              color: '#0B1B3D',
            }}
          >
            {presidentName}
          </span>
          <span
            style={{
              fontFamily: "Helvetica, Arial, sans-serif",
              fontSize: 11,
              fontWeight: 600,
              color: '#475569',
            }}
          >
            CPCCU
          </span>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            marginBottom: 6,
          }}
        >
          <span
            style={{
              fontFamily: "ui-monospace, 'Courier New', monospace",
              fontSize: 11,
              fontWeight: 600,
              color: '#334155',
            }}
          >
            Certificate ID: {view.certificateId || 'CPCCU-2026-00123'}
          </span>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: 140,
          }}
        >
          <div
            style={{
              height: 48,
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              marginBottom: 4,
            }}
          >
            {vpSig ? (
              <img
                src={vpSig}
                crossOrigin="anonymous"
                alt=""
                style={{ maxHeight: 46, maxWidth: 130, objectFit: 'contain' }}
              />
            ) : null}
          </div>
          <div
            style={{ width: '100%', height: 1.5, background: '#0B1B3D', marginBottom: 6 }}
          />
          <span
            style={{
              fontFamily: "Helvetica, Arial, sans-serif",
              fontSize: 13.5,
              fontWeight: 800,
              color: '#0B1B3D',
            }}
          >
            {vpName}
          </span>
          <span
            style={{
              fontFamily: "Helvetica, Arial, sans-serif",
              fontSize: 11,
              fontWeight: 600,
              color: '#475569',
            }}
          >
            CPCCU
          </span>
        </div>
      </div>
    </CertificateSheet>
  );
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Master Dynamic Router: CertificatePlatinum
 *
 * Automatically dispatches to the corresponding 100% same-to-same template:
 * - template_platinum_1.jpeg: for participation certificates or 'platinum-participation'
 * - template_platinum_2.jpeg: for winner/achievement rankings or 'platinum-achievement'
 * - template_platinum.jpeg: for hackathon/appreciation or default 'platinum'
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function CertificatePlatinum({ view, theme, signatory }) {
  const templateKey = theme?.key;

  if (templateKey === 'platinum-participation') {
    return <PlatinumParticipation view={view} theme={theme} signatory={signatory} />;
  }
  if (templateKey === 'platinum-achievement') {
    return <PlatinumAchievement view={view} theme={theme} signatory={signatory} />;
  }

  // Automatic variant selection when templateKey === 'platinum'
  if (view.certificateType === 'participation' && view.contestName?.includes('Beat the vibe')) {
    return <PlatinumParticipation view={view} theme={theme} signatory={signatory} />;
  }
  if (
    (view.certificateType === 'winner' ||
      view.certificateType === 'runner-up' ||
      view.certificateType === '2nd-runner-up') &&
    view.contestName?.includes('Beat the vibe')
  ) {
    return <PlatinumAchievement view={view} theme={theme} signatory={signatory} />;
  }

  return <PlatinumAppreciation view={view} theme={theme} signatory={signatory} />;
}
