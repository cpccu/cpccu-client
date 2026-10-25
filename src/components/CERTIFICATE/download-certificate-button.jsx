'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { showErrorAlert, showSuccessAlert } from '@/lib/alerts';
import { downloadCertificatePdf } from '@/lib/certificate-pdf';
import { useLazyDownloadCertificateCredentialsQuery, useGetCertificateSignatoriesQuery } from '@/features/certificate/certificateApi';
import { CertificateDocument } from './templates/certificate-document';
import { resolveSignatory } from '@/lib/certificate-signatories';

const toExportNodeId = (certificateId) =>
  `certificate-export-${String(certificateId || 'certificate').replace(
    /[^A-Za-z0-9_-]/g,
    '-'
  )}`;

/**
 * Turns an RTK Query rejection into a message a member can act on.
 *
 * A 403 covers both "somebody else's certificate" and "not a participation
 * certificate"; both mean the same thing to the person clicking, and the
 * specific server wording is not worth surfacing.
 */
const resolveDownloadErrorMessage = (error) => {
  if (!error) return 'Something went wrong. Please try again.';
  if (error.status === 401) return 'Please sign in to download your certificate.';
  if (error.status === 403) {
    return 'You can only download your own participation certificates.';
  }
  if (error.status === 404) return 'This certificate could not be found.';

  if (error.status === 503) {
    // The server answers 503 when it has no owner password configured. Its own
    // wording is the useful one, and a 503 raised by a proxy in front of it
    // carries no JSON body at all — hence the fallback.
    const serverMessage = error?.data?.message;
    return typeof serverMessage === 'string' && serverMessage
      ? serverMessage
      : 'Certificate downloads are unavailable right now. Please try again later.';
  }

  const fieldMessage = error?.data?.errors?.[0]?.message;
  if (typeof fieldMessage === 'string' && fieldMessage) return fieldMessage;
  if (typeof error?.data?.message === 'string' && error.data.message) {
    return error.data.message;
  }
  if (typeof error?.error === 'string' && error.error) return error.error;

  return 'Something went wrong. Please try again.';
};

/**
 * Downloads the member's own participation certificate as an encrypted PDF.
 *
 * ⚠️ VISIBILITY IS DECIDED BY THE PARENT. The server re-checks ownership and
 * certificate type on every request, so this component is a convenience, not
 * the gate — but it also refuses to run for a certificate that is not a
 * participation one, so a stray render cannot fetch credentials for it.
 *
 * The PDF is rendered in the browser: the credentials request returns JSON,
 * and the document is laid out in a portal that sits off-screen (not
 * `display:none` — html2canvas needs a layout box to rasterise).
 *
 * ⚠️ THE CALLER MUST KEEP THIS COMPONENT MOUNTED WHILE IT WORKS. The export
 * runs after the click (fetch → two frames → html2canvas), and unmounting
 * cancels it — so a menu that closes itself on click would swallow the
 * download. Inside a dropdown, leave the menu open: `onBusyChange` reports
 * when the export starts and when it ends, so the host can refuse to close
 * the menu until then.
 */
export function DownloadCertificateButton({
  certificate,
  signatory,
  disabled = false,
  className = '',
  variant = 'default',
  size = 'default',
  // The menu-call-site drops "PDF" — the row already says what is downloaded.
  label = 'Download PDF',
  // Reports whether an export is running, so a host that keeps this control
  // inside a menu can hold the menu open until the export is over.
  onBusyChange,
}) {
  const [getCredentials, { isFetching }] =
    useLazyDownloadCertificateCredentialsQuery();
  const { data: signatoriesResponse } = useGetCertificateSignatoriesQuery();
  const resolvedSignatory =
    signatory || resolveSignatory(signatoriesResponse, certificate?.committee);
  const [exportPayload, setExportPayload] = useState(null);
  const [isRendering, setIsRendering] = useState(false);
  const [mounted, setMounted] = useState(false);
  const exportRef = useRef(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isEligible =
    certificate?.certificateType === 'participation' &&
    Boolean(certificate?.certificateId);
  const isBusy = isFetching || isRendering;

  // Only transitions are reported: a control that was never used must not
  // tell its host that it went busy — or that it went idle.
  const busyRef = useRef(false);
  useEffect(() => {
    if (busyRef.current === isBusy) return;
    busyRef.current = isBusy;
    onBusyChange?.(isBusy);
  }, [isBusy, onBusyChange]);

  // An unmount in the middle of an export must not leave the host stuck open.
  useEffect(
    () => () => {
      if (!busyRef.current) return;
      busyRef.current = false;
      onBusyChange?.(false);
    },
    [onBusyChange],
  );

  const handleClick = async () => {
    if (!isEligible || disabled || isBusy) return;

    try {
      // No `preferCacheValue`: the credentials carry the owner password and
      // must not be replayed from the cache on a later click.
      const data = await getCredentials(certificate.certificateId).unwrap();
      setIsRendering(true);
      setExportPayload(data);
    } catch (error) {
      showErrorAlert('Could not download certificate', resolveDownloadErrorMessage(error));
    }
  };

  useEffect(() => {
    if (!exportPayload) return undefined;

    let cancelled = false;

    const run = async () => {
      try {
        // Two frames: one for the portal to mount, one for the browser to lay
        // it out, so html2canvas measures the finished document.
        await new Promise((resolve) => {
          window.requestAnimationFrame(() => window.requestAnimationFrame(resolve));
        });

        if (document.fonts?.ready) await document.fonts.ready;

        const node = exportRef.current;
        if (!node) {
          throw new Error('The certificate has not finished rendering. Please try again.');
        }

        await downloadCertificatePdf(node, {
          fileName: exportPayload.fileName,
          // The member's file opens with no prompt; the owner password is what
          // locks it against editing.
          userPassword: exportPayload.pdf?.userPassword ?? '',
          ownerPassword: exportPayload.pdf?.ownerPassword ?? '',
        });

        if (!cancelled) {
          showSuccessAlert(
            'Certificate downloaded',
            'Your certificate PDF is ready. It opens without a password and is protected against editing.'
          );
        }
      } catch (error) {
        if (!cancelled) {
          showErrorAlert(
            'Download failed',
            error?.message || 'The certificate PDF could not be generated.'
          );
        }
      } finally {
        if (!cancelled) {
          setIsRendering(false);
          setExportPayload(null);
        }
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [exportPayload]);

  return (
    <>
      <Button
        type="button"
        variant={variant}
        size={size}
        className={className}
        onClick={handleClick}
        disabled={disabled || !isEligible || isBusy}
      >
        {isBusy ? (
          <Loader2 className="animate-spin" aria-hidden="true" />
        ) : (
          <Download aria-hidden="true" />
        )}
        {isBusy ? 'Preparing…' : label}
      </Button>

      {mounted && exportPayload
        ? createPortal(
            <div
              aria-hidden="true"
              style={{
                position: 'fixed',
                top: 0,
                left: -10000,
                zIndex: -1,
                pointerEvents: 'none',
              }}
            >
              <CertificateDocument
                ref={exportRef}
                certificate={exportPayload.certificate}
                templateKey={
                  exportPayload.template?.key ||
                  exportPayload.certificate?.templateKey
                }
                signatory={resolvedSignatory}
                exportId={toExportNodeId(certificate?.certificateId)}
              />
            </div>,
            document.body
          )
        : null}
    </>
  );
}

export { resolveDownloadErrorMessage };
