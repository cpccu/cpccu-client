/**
 * Permission helpers for certificate actions.
 *
 * ⚠️ THE SERVER IS THE GATE — NOTHING HERE DECIDES OWNERSHIP. A student id
 * is self-asserted and mutable, so a client-side comparison could be talked
 * into believing a member owns somebody else's certificate. The server's
 * `GET /certificates/me` is scoped to the signed-in member and stamps each
 * of its certificates with `canDownload`; these helpers only read that flag.
 */

/**
 * Whether a certificate may be downloaded by the member viewing it.
 *
 * ⚠️ THE SERVER'S FLAG IS THE ONLY INPUT. `canDownload` comes from
 * `GET /certificates/me`, which the server scopes to the caller. A
 * certificate that came from a public endpoint carries no flag at all, so it
 * is never downloadable.
 */
export function canDownloadCertificate(certificate) {
  return certificate?.canDownload === true;
}

/**
 * Whether the current user can share a certificate.
 *
 * ⚠️ NOT IMPLEMENTED. The server would have to answer first.
 */
export function canShareCertificate(_certificate, _user) {
  return false;
}

/**
 * Whether the current user can edit a certificate.
 *
 * ⚠️ NOT IMPLEMENTED. The server would have to answer first.
 */
export function canEditCertificate(_certificate, _user) {
  return false;
}

/**
 * Whether the current user can delete a certificate.
 *
 * ⚠️ NOT IMPLEMENTED. The server would have to answer first.
 */
export function canDeleteCertificate(_certificate, _user) {
  return false;
}
