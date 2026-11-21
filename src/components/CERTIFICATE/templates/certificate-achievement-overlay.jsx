'use client';

import { getSignatureImageUrl } from '@/lib/certificate-signatories';
import InstitudeInfo from '@/data/global/institude.json';
import {
  getRecipientNameFontSize,
  resolveCertificateView,
} from './certificate-frame';

export const ACHIEVEMENT_OVERLAY_WIDTH = 1491;
export const ACHIEVEMENT_OVERLAY_HEIGHT = 1055;

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

const RANK_BY_TYPE = {
  winner: 1,
  'runner-up': 2,
  '2nd-runner-up': 3,
};

const formatAchievementDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Dhaka',
  }).format(date);
};

const toOrdinal = (value) => {
  const rank = Number(value);
  if (!Number.isInteger(rank) || rank < 1) return '';
  const suffix =
    rank % 100 >= 11 && rank % 100 <= 13
      ? 'th'
      : ({ 1: 'st', 2: 'nd', 3: 'rd' }[rank % 10] || 'th');
  return `${rank}${suffix}`;
};

const resolveOrdinal = (certificate) =>
  toOrdinal(
    RANK_BY_TYPE[certificate?.certificateType] ?? certificate?.rank
  );

function SignatoryBlock({ signatory, role, side }) {
  const imageUrl = getSignatureImageUrl(signatory?.signatureUrl);
  const title = signatory?.title || role.title;
  const fallbackName = signatory?.name || role.name;

  return (
    <div
      style={{
        position: 'absolute',
        top: 802,
        [side]: 84,
        width: 230,
        height: 132,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      <img
        src="/assets/logo/cpccu.png"
        crossOrigin="anonymous"
        alt=""
        style={{ position: 'absolute', top: 75, left: 150, width: 190, height: 190, objectFit: 'contain' }}
      />
      <div
        style={{
          position: 'absolute',
          top: 156,
          left: 370,
          right: 370,
          height: 42,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: "'Inria Sans', Helvetica, Arial, sans-serif",
          fontSize: 27,
          color: '#111111',
          whiteSpace: 'nowrap',
        }}
      >
        {[InstitudeInfo.fullName, InstitudeInfo.uniName].filter(Boolean).join(' ')}
      </div>

      <div
        style={{
          width: '100%',
          height: 92,
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
            alt=""
            style={{
              maxWidth: 210,
              maxHeight: 84,
              objectFit: 'contain',
            }}
          />
        ) : (
          <span
            style={{
              fontFamily: "'Alex Brush', 'Great Vibes', cursive",
              fontSize: 52,
              color: '#111827',
              lineHeight: 1,
            }}
          >
            {fallbackName}
          </span>
        )}
      </div>
      <span
        style={{
          marginTop: 7,
          fontFamily: "'Inria Sans', Helvetica, Arial, sans-serif",
          fontSize: title.length > 20 ? 17 : 22,
          fontWeight: 700,
          color: '#111827',
          lineHeight: 1.1,
          textAlign: 'center',
          whiteSpace: 'nowrap',
        }}
      >
        {title}
      </span>
    </div>
  );
}

/** Transparent content layer positioned over the approved blank PDF artwork. */
export function CertificateAchievementOverlay({
  certificate = {},
  eventDate,
  signatory,
  ref,
  exportId,
}) {
  const view = resolveCertificateView(certificate, signatory);
  const ordinal = resolveOrdinal(certificate);
  const signatoryKeys = Array.isArray(certificate.signatories)
    ? certificate.signatories
    : ['president', 'coordinator'];
  const selectedSignatories = signatoryKeys
    .map((key) => ({
      key,
      role: SIGNATORY_ROLES[key],
      data: signatory?.[key] || {},
    }))
    .filter(({ role }) => role);
  const eventDateText = formatAchievementDate(eventDate || certificate.eventDate);

  return (
    <div
      ref={ref}
      id={exportId}
      data-certificate-export={exportId ? 'true' : undefined}
      style={{
        position: 'relative',
        width: ACHIEVEMENT_OVERLAY_WIDTH,
        height: ACHIEVEMENT_OVERLAY_HEIGHT,
        overflow: 'hidden',
        background: 'transparent',
        flex: '0 0 auto',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 370,
          left: 150,
          right: 150,
          height: 110,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          fontFamily: "'Alex Brush', 'Great Vibes', 'Brush Script MT', cursive",
          fontSize: getRecipientNameFontSize(view.recipientName, {
            max: 82,
            min: 48,
          }),
          color: '#0B1B3D',
          lineHeight: 1,
          whiteSpace: 'nowrap',
        }}
      >
        {view.recipientName}
      </div>

      <div
        style={{
          position: 'absolute',
          top: 563,
          left: 580,
          width: 331,
          height: 92,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: "'Cinzel', Georgia, 'Times New Roman', serif",
          fontSize: 76,
          fontWeight: 700,
          color: '#D8A62A',
          lineHeight: 1,
          whiteSpace: 'nowrap',
        }}
      >
        {ordinal}
      </div>

      <div
        style={{
          position: 'absolute',
          top: 704,
          left: 180,
          right: 180,
          height: 54,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          fontFamily: "'Cinzel', 'Playfair Display', Georgia, serif",
          fontSize: Math.max(
            22,
            34 - Math.max(0, view.contestName.length - 34) * 0.25
          ),
          fontWeight: 800,
          color: '#B42323',
          lineHeight: 1.1,
          textAlign: 'center',
          whiteSpace: 'nowrap',
        }}
      >
        {view.contestName}
      </div>

      <div
        style={{
          position: 'absolute',
          top: 790,
          left: 180,
          right: 180,
          height: 32,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: "Georgia, 'Times New Roman', serif",
          fontSize: 22,
          color: '#333333',
          whiteSpace: 'nowrap',
        }}
      >
        organized by Competitive Programming Camp City University
      </div>

      <div
        style={{
          position: 'absolute',
          top: 836,
          left: 475,
          width: 541,
          height: 34,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: "Georgia, 'Times New Roman', serif",
          fontSize: 23,
          color: '#333333',
          whiteSpace: 'nowrap',
        }}
      >
        {eventDateText ? `held on ${eventDateText}` : ''}
      </div>

      {selectedSignatories.length === 1 ? (
        <SignatoryBlock
          signatory={selectedSignatories[0].data}
          role={selectedSignatories[0].role}
          side="left"
        />
      ) : null}
      {selectedSignatories.length >= 2 ? (
        <>
          <SignatoryBlock
            signatory={selectedSignatories[0].data}
            role={selectedSignatories[0].role}
            side="left"
          />
          <SignatoryBlock
            signatory={selectedSignatories[1].data}
            role={selectedSignatories[1].role}
            side="right"
          />
        </>
      ) : null}

      <div
        style={{
          position: 'absolute',
          top: 960,
          left: 300,
          right: 300,
          height: 32,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: "Georgia, 'Times New Roman', serif",
          fontSize: 24,
          color: '#333333',
          whiteSpace: 'nowrap',
        }}
      >
        Certificate ID: {view.certificateId}
      </div>
    </div>
  );
}
