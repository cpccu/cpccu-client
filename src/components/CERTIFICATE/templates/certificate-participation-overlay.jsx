'use client';

import { forwardRef } from 'react';
import { getSignatureImageUrl } from '@/lib/certificate-signatories';
import InstitudeInfo from '@/data/global/institude.json';
import {
  getRecipientNameFontSize,
  resolveCertificateView,
} from './certificate-frame';

export const PARTICIPATION_OVERLAY_WIDTH = 1491;
export const PARTICIPATION_OVERLAY_HEIGHT = 1055;

const SIGNATORY_ROLES = {
  president: { name: 'President', title: 'President' },
  vicePresident: { name: 'Vice President', title: 'Vice President' },
  generalSecretary: {
    name: 'General Secretary',
    title: 'General Secretary',
  },
  treasurer: { name: 'Treasurer', title: 'Treasurer' },
  coordinator: {
    name: 'Contest and Event Coordinator',
    title: 'Contest and Event Coordinator',
  },
};

const formatParticipationDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Dhaka',
  }).format(date);
};

function SignatoryBlock({ signatory, role, sigLeft, textLeft }) {
  const imageUrl = getSignatureImageUrl(signatory?.signatureUrl);
  const title = signatory?.title || role?.title || 'Signatory';

  return (
    <>
      {/* Signature image sitting directly above the signature line (Line at Y = 912) */}
      <div
        style={{
          position: 'absolute',
          top: 834,
          left: sigLeft,
          width: 220,
          height: 76,
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            crossOrigin="anonymous"
            alt={title}
            style={{
              maxWidth: 210,
              maxHeight: 76,
              objectFit: 'contain',
            }}
          />
        ) : null}
      </div>

      {/* Designation under the signature line (Line at Y = 912, CPCCU at Y = 960) */}
      <div
        style={{
          position: 'absolute',
          top: 902,
          left: textLeft,
          width: 220,
          height: 32,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span
          style={{
            fontFamily: "'TeX Gyre Termes', 'Times New Roman', Times, serif",
            fontSize: title.length > 22 ? 21 : 25.9,
            fontWeight: 700,
            color: '#101010',
            lineHeight: 1,
            textAlign: 'center',
            whiteSpace: 'nowrap',
          }}
        >
          {title}
        </span>
      </div>
    </>
  );
}

/**
 * Transparent dynamic content layer positioned over the Canva blank Participation PDF.
 * Dimensions: 1491 x 1055 px.
 */
export const CertificateParticipationOverlay = forwardRef(
  function CertificateParticipationOverlay(
    { certificate = {}, signatory, exportId },
    ref
  ) {
    const view = resolveCertificateView(certificate, signatory);
    const signatoryKeys =
      Array.isArray(certificate.signatories) && certificate.signatories.length > 0
        ? certificate.signatories
        : ['president', 'vicePresident'];

    const selectedSignatories = signatoryKeys
      .map((key) => ({
        key,
        role: SIGNATORY_ROLES[key] || { name: key, title: key },
        data: signatory?.[key] || {},
      }))
      .filter(({ role }) => role);

    const issueDateText = formatParticipationDate(
      certificate.issueDate || certificate.eventDate
    );
    const clubName =
      [InstitudeInfo.fullName, InstitudeInfo.uniName].filter(Boolean).join(' ') ||
      'Competitive Programming Camp City University';

    // Dynamic contest font size clamp so long titles never overflow into 'organized by...'
    const contestLen = (view.contestName || '').length;
    const contestFontSize =
      contestLen <= 38 ? 24.9 : contestLen <= 52 ? 21.5 : 18.5;

    return (
      <div
        ref={ref}
        id={exportId}
        data-certificate-export={exportId ? 'true' : undefined}
        style={{
          position: 'relative',
          width: PARTICIPATION_OVERLAY_WIDTH,
          height: PARTICIPATION_OVERLAY_HEIGHT,
          overflow: 'hidden',
          background: 'transparent',
          flex: '0 0 auto',
        }}
      >
        {/* 1. CPCCU Logo at top-left: 252.7 x 252.7 px */}
        <img
          src="/cpccu.png"
          crossOrigin="anonymous"
          alt="CPCCU Logo"
          style={{
            position: 'absolute',
            top: 62.4,
            left: 33.7,
            width: 252.7,
            height: 252.7,
            objectFit: 'contain',
          }}
        />

        {/* 2. Club Name: Poppins, 21.6 pt (28.8 px), color #101010, centered at X: 821.4 */}
        <div
          style={{
            position: 'absolute',
            top: 160.5,
            left: 371.4,
            width: 900,
            height: 35,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: "'Poppins', sans-serif",
            fontSize: 28.8,
            fontWeight: 400,
            color: '#101010',
            textAlign: 'center',
            whiteSpace: 'nowrap',
          }}
        >
          {clubName}
        </div>

        {/* 3. Recipient Name: Great Vibes, 53.8 pt (71.7 px), color #101010, resting on line at Y: 568 */}
        <div
          style={{
            position: 'absolute',
            top: 424,
            left: 371.4,
            width: 900,
            height: 96,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'visible',
            fontFamily: "'Great Vibes', cursive",
            fontSize: getRecipientNameFontSize(view.recipientName, {
              max: 71.7,
              min: 44,
            }),
            color: '#101010',
            lineHeight: 1,
            whiteSpace: 'nowrap',
          }}
        >
          {view.recipientName}
        </div>

        {/* 4. Contest Name: TeX Gyre Termes Bold, color #C80B0B, positioned cleanly above 'organized by...' */}
        <div
          style={{
            position: 'absolute',
            top: 616,
            left: 341.4,
            width: 960,
            height: 70,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            fontFamily: "'TeX Gyre Termes', 'Times New Roman', Times, serif",
            fontSize: contestFontSize,
            fontWeight: 700,
            color: '#C80B0B',
            lineHeight: 1.15,
            textAlign: 'center',
            textTransform: 'uppercase',
          }}
        >
          {view.contestName}
        </div>

        {/* 5. Issue Date: TeX Gyre Termes Regular, 21.0 pt (28.0 px), color #2B2E37, right after 'held on ' */}
        {issueDateText ? (
          <div
            style={{
              position: 'absolute',
              top: 706,
              left: 787.2,
              width: 250,
              height: 34,
              display: 'flex',
              alignItems: 'center',
              fontFamily: "'TeX Gyre Termes', 'Times New Roman', Times, serif",
              fontSize: 28.0,
              fontWeight: 400,
              color: '#2B2E37',
              whiteSpace: 'nowrap',
            }}
          >
            {issueDateText}
          </div>
        ) : null}

        {/* 6. Signatories (Admin controlled) */}
        {selectedSignatories.length === 1 ? (
          <SignatoryBlock
            signatory={selectedSignatories[0].data}
            role={selectedSignatories[0].role}
            sigLeft={394}
            textLeft={406}
          />
        ) : null}
        {selectedSignatories.length >= 2 ? (
          <>
            <SignatoryBlock
              signatory={selectedSignatories[0].data}
              role={selectedSignatories[0].role}
              sigLeft={394}
              textLeft={406}
            />
            <SignatoryBlock
              signatory={selectedSignatories[1].data}
              role={selectedSignatories[1].role}
              sigLeft={1127}
              textLeft={1121}
            />
          </>
        ) : null}

        {/* 7. Certificate ID: TeX Gyre Termes Regular, 16.8 pt (22.4 px), color #2B2E37, right after 'Certificate ID: ' */}
        <div
          style={{
            position: 'absolute',
            top: 958,
            left: 824.0,
            width: 250,
            height: 27,
            display: 'flex',
            alignItems: 'center',
            fontFamily: "'TeX Gyre Termes', 'Times New Roman', Times, serif",
            fontSize: 22.4,
            fontWeight: 400,
            color: '#2B2E37',
            whiteSpace: 'nowrap',
          }}
        >
          {view.certificateId}
        </div>
      </div>
    );
  }
);
