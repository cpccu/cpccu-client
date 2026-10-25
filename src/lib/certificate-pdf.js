/**
 * Client-side certificate PDF generation.
 *
 * ⚠️ THE HEAVY IMPORTS ARE DYNAMIC, AND MUST STAY THAT WAY. `html2canvas` and
 * `@cantoo/pdf-lib` are only needed on the click that downloads a certificate;
 * importing either one at module top level pulls it into the main bundle and
 * breaks the build's server rendering pass.
 *
 * Pipeline: DOM node → html2canvas raster (3×) → PNG → pdf-lib A4 landscape
 * page → AES-256 encrypted bytes → Blob → `<a download>`.
 *
 * ---------------------------------------------------------------------------
 * ⚠️ THE TWO-PASSWORD MODEL
 * ---------------------------------------------------------------------------
 *
 * A PDF has two passwords and they do two different jobs:
 *
 *   * the USER password is what a reader must type to OPEN the file. It is the
 *     empty string here, so the member's certificate opens freely — no prompt,
 *     and no password to hand out, copy or lose.
 *   * the OWNER password is what unlocks the permissions. Editing, annotating
 *     and copying are refused unless it is supplied. It is the site owner's own
 *     secret, held in the server's `CERTIFICATE_PDF_PASSWORD` environment
 *     variable and delivered with the credentials.
 *
 * ⚠️ THE OWNER PASSWORD NECESSARILY REACHES THE BROWSER. The PDF is assembled
 * in the browser, so the secret has to travel there to be used — there is no
 * other way to encrypt a file that only ever exists client-side. What the
 * encryption therefore guarantees is: the file opens freely, is marked
 * non-editable, and cannot be unlocked without the owner password. It is NOT
 * "the member can never obtain the password" — anybody who reads the network
 * response can extract it, and a determined member can strip the restrictions.
 * Treat it as a deterrent against casual edits, not as a secret.
 */

import { CERTIFICATE_HEIGHT, CERTIFICATE_WIDTH } from '@/components/CERTIFICATE/templates/certificate-frame';

// US Letter landscape in PDF points (1 pt = 1/72in): 11 × 8.5 in.
const PDF_PAGE_WIDTH = 792;   // 11 in × 72
const PDF_PAGE_HEIGHT = 612;  // 8.5 in × 72

/**
 * Strips anything that cannot appear in a download file name.
 *
 * The name comes from the server, which already reduces it to `[A-Za-z0-9._-]`,
 * but the client is the last writer — a quote or a slash here would produce a
 * malformed or nested file.
 */
const toSafeFileName = (value) => {
  const cleaned = String(value || 'certificate.pdf')
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '-')
    .replace(/^\.+/, '')
    .slice(0, 120);

  const base = cleaned || 'certificate';
  return base.toLowerCase().endsWith('.pdf') ? base : `${base}.pdf`;
};

/**
 * Renders a certificate node into an encrypted, non-editable PDF and downloads
 * it.
 *
 * @param {HTMLElement} node  the export node — a fixed 1056×816 element
 * @param {{ fileName?: string, userPassword?: string, ownerPassword: string }} options
 *   `userPassword` may be empty — that is what makes the file open without a
 *   prompt. `ownerPassword` must not be empty: it is what locks the file
 *   against editing.
 */
export async function downloadCertificatePdf(
  node,
  { fileName, userPassword, ownerPassword } = {}
) {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    throw new Error('Certificate PDFs can only be generated in the browser.');
  }

  if (!node) {
    throw new Error('The certificate has not finished rendering. Please try again.');
  }

  if (typeof ownerPassword !== 'string' || !ownerPassword) {
    // Refusing beats emitting an editable certificate: the owner password is
    // what locks the file, not a decoration.
    throw new Error('An owner password is required to protect the certificate PDF.');
  }

  if (typeof userPassword !== 'string') {
    // An EMPTY user password is the normal case (the member opens the file
    // with no prompt) — only a missing one is a broken credentials payload.
    throw new Error('The certificate PDF credentials are incomplete.');
  }

  if (document.fonts?.ready) {
    await document.fonts.ready;
  }

  const [{ default: html2canvas }, pdfLib] = await Promise.all([
    import('html2canvas'),
    import('@cantoo/pdf-lib'),
  ]);

  const paper = node.dataset?.paper || '#FFFFFF';

  const canvas = await html2canvas(node, {
    scale: 3,
    backgroundColor: paper,
    useCORS: true,
    logging: false,
    width: CERTIFICATE_WIDTH,
    height: CERTIFICATE_HEIGHT,
  });

  const dataUrl = canvas.toDataURL('image/png');

  const { PDFDocument } = pdfLib;
  const pdf = await PDFDocument.create();
  const image = await pdf.embedPng(dataUrl);

  const page = pdf.addPage([PDF_PAGE_WIDTH, PDF_PAGE_HEIGHT]);
  page.drawImage(image, {
    x: 0,
    y: 0,
    width: PDF_PAGE_WIDTH,
    height: PDF_PAGE_HEIGHT,
  });

  pdf.encrypt({
    userPassword,
    ownerPassword,
    permissions: {
      printing: 'highResolution',
      modifying: false,
      copying: false,
      annotating: false,
      fillingForms: false,
    },
  });

  const bytes = await pdf.save();
  const blob = new Blob([bytes], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = toSafeFileName(fileName);
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();

  // The click starts the download synchronously; the blob URL is only needed
  // until the browser has taken it.
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);

  return bytes.length;
}

export { toSafeFileName };
