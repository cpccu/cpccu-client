/**
 * Sort certificates newest first by issueDate (descending).
 */
export function sortCertificatesNewest(certificates) {
  if (!Array.isArray(certificates)) return [];
  return [...certificates].sort(
    (a, b) => new Date(b.issueDate) - new Date(a.issueDate),
  );
}

/**
 * Sort certificates oldest first by issueDate (ascending).
 */
export function sortCertificatesOldest(certificates) {
  if (!Array.isArray(certificates)) return [];
  return [...certificates].sort(
    (a, b) => new Date(a.issueDate) - new Date(b.issueDate),
  );
}

/**
 * Sort certificates by issue date (alias for sortCertificatesNewest).
 */
export function sortByIssueDate(certificates) {
  return sortCertificatesNewest(certificates);
}
