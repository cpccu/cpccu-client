import fallbackSignatories from '@/data/global/signatory.json';

export function getSignatureImageUrl(relativeUrl) {
  if (!relativeUrl) return null;
  if (relativeUrl.startsWith('http://') || relativeUrl.startsWith('https://')) {
    return relativeUrl;
  }
  // When a relative path is given (e.g. /signatures/...), prefer serving it directly from
  // the client's public static assets to prevent CORS issues and cross-origin failures during export.
  if (relativeUrl.startsWith('/signatures/')) {
    return relativeUrl;
  }
  const baseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000').replace('/api/v1', '');
  return `${baseUrl}${relativeUrl}`;
}

export function resolveSignatory(signatories, committee) {
  const source =
    signatories?.data?.committees ||
    signatories?.committees ||
    signatories?.data?.data?.committees ||
    fallbackSignatories?.committees ||
    [];

  if (!Array.isArray(source) || source.length === 0) return null;

  if (committee) {
    const found = source.find((entry) => entry?.key === committee);
    if (found) return found;
  }

  // Fallback to active 2026-2027 committee or latest in list so signatures always render
  const defaultCommittee =
    source.find((entry) => entry?.key === 'committee-2026-2027') ||
    source[source.length - 1];
  return defaultCommittee || null;
}
