export function getSignatureImageUrl(relativeUrl) {
  if (!relativeUrl) return null;
  if (relativeUrl.startsWith('http')) return relativeUrl;
  const baseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000').replace('/api/v1', '');
  return `${baseUrl}${relativeUrl}`;
}

export function resolveSignatory(signatories, committee) {
  if (!committee) return null;
  const source =
    signatories?.data?.committees ||
    signatories?.committees ||
    signatories?.data?.data?.committees ||
    [];
  if (!Array.isArray(source)) return null;
  return source.find((entry) => entry?.key === committee) || null;
}