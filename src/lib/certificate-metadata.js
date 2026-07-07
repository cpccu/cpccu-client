const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000').replace('/api/v1', '');

const SITE_NAME = 'Competitive Programming Camp City University';
const SITE_URL = 'https://www.cpccu.club';
const OG_IMAGE = `${SITE_URL}/cpccu.png`;
const FALLBACK_CERTIFICATE_TITLE = 'Certificate Verification | CPCCU';
const FALLBACK_CERTIFICATE_DESCRIPTION = 'Verify certificates issued by Competitive Programming Camp City University.';

const CERTIFICATE_TYPE_LABELS = {
  winner: 'Winner',
  'runner-up': 'Runner Up',
  'top-performer': 'Top Performer',
  participation: 'Participation',
};

function formatCertificateType(type) {
  if (!type) return '';
  return CERTIFICATE_TYPE_LABELS[type] || type.replace(/-/g, ' ');
}

function getCertificateTypeLabel(certificate) {
  const type = certificate?.certificateType;
  if (!type) return '';
  return formatCertificateType(type);
}

function getFallbackMetadata(certificateId) {
  const canonicalUrl = certificateId ? `${SITE_URL}/certificate/${certificateId}` : `${SITE_URL}/certificate`;

  return {
    title: FALLBACK_CERTIFICATE_TITLE,
    description: FALLBACK_CERTIFICATE_DESCRIPTION,
    alternates: {
      canonical: canonicalUrl,
    },
    robots: {
      index: false,
      follow: false,
    },
    openGraph: {
      title: FALLBACK_CERTIFICATE_TITLE,
      description: FALLBACK_CERTIFICATE_DESCRIPTION,
      url: canonicalUrl,
      siteName: SITE_NAME,
      type: 'website',
      locale: 'en_US',
      images: [OG_IMAGE],
    },
    twitter: {
      card: 'summary_large_image',
      title: FALLBACK_CERTIFICATE_TITLE,
      description: FALLBACK_CERTIFICATE_DESCRIPTION,
      images: [OG_IMAGE],
    },
  };
}

export async function getCertificateMetadata(certificateId) {
  if (!certificateId || typeof certificateId !== 'string') {
    return getFallbackMetadata(certificateId);
  }

  try {
    const res = await fetch(
      `${API_BASE_URL}/certificates/verify?certificateId=${encodeURIComponent(certificateId)}`,
      { credentials: 'include' }
    );

    if (!res.ok) {
      return getFallbackMetadata(certificateId);
    }

    const json = await res.json();

    let certificate = null;
    if (json?.data?.data) {
      const data = json.data.data;
      certificate = Array.isArray(data) ? data[0] : data;
    } else if (json?.data && typeof json.data === 'object' && !Array.isArray(json.data)) {
      certificate = json.data;
    }

    if (!certificate) {
      return getFallbackMetadata(certificateId);
    }

    const recipientName = certificate.recipientName || 'CPCCU';
    const contestName = certificate.contestName || '';
    const certificateType = getCertificateTypeLabel(certificate);

    const canonicalUrl = `${SITE_URL}/certificate/${certificateId}`;

    const title = `Certificate Verification | ${recipientName}`;
    const description = `Verified ${certificateType} Certificate.\n\nRecipient:\n${recipientName}\n\nContest:\n${contestName}\n\nIssued by Competitive Programming Camp City University.`;
    const ogDescription = `Verified ${certificateType} Certificate.\n\nRecipient:\n${recipientName}\n\nContest:\n${contestName}`;

    return {
      title,
      description,
      alternates: {
        canonical: canonicalUrl,
      },
      robots: {
        index: true,
        follow: true,
      },
      openGraph: {
        title,
        description: ogDescription,
        url: canonicalUrl,
        siteName: SITE_NAME,
        type: 'website',
        locale: 'en_US',
        images: [OG_IMAGE],
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description: ogDescription,
        images: [OG_IMAGE],
      },
    };
  } catch (error) {
    return getFallbackMetadata(certificateId);
  }
}
