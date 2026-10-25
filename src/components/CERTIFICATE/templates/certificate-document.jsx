'use client';

import { useEffect, useRef, useState } from 'react';
import { CertificateClassic } from './certificate-classic';
import { CertificateModern } from './certificate-modern';
import { CertificateTech } from './certificate-tech';
import { CertificateElegant } from './certificate-elegant';
import { CertificateVibrant } from './certificate-vibrant';
import { CertificatePlatinum } from './certificate-platinum';
import {
  CERTIFICATE_HEIGHT,
  CERTIFICATE_WIDTH,
  createCertificateTheme,
  resolveCertificateView,
} from './certificate-frame';
import {
  DEFAULT_CERTIFICATE_TEMPLATE_KEY,
  getClientTemplate,
} from './template-registry';

const TEMPLATE_COMPONENTS = {
  classic: CertificateClassic,
  modern: CertificateModern,
  tech: CertificateTech,
  elegant: CertificateElegant,
  vibrant: CertificateVibrant,
  platinum: CertificatePlatinum,
  'platinum-participation': CertificatePlatinum,
  'platinum-achievement': CertificatePlatinum,
};

/**
 * The certificate document, always rendered at exactly 1123×794 CSS pixels
 * (A4 landscape at 96dpi) regardless of the space it is placed in.
 *
 * ⚠️ THE EXPORT NODE MUST KEEP THIS EXACT SIZE. html2canvas is called with a
 * fixed 1123×794 frame, so a root that had already been shrunk to fit its
 * parent would rasterise at the wrong scale. The screen version is scaled
 * separately by `CertificatePreview`, which never wraps the node it exports.
 */
export function CertificateDocument({
  certificate,
  templateKey,
  exportId,
  className = '',
  style,
  ref,
  signatory,
}) {
  const template = getClientTemplate(
    templateKey || certificate?.templateKey || DEFAULT_CERTIFICATE_TEMPLATE_KEY
  );
  const Template = TEMPLATE_COMPONENTS[template.key] || CertificateClassic;
  const theme = createCertificateTheme(template);
  const resolvedSignatory = signatory || certificate?.signatory || null;
  const view = resolveCertificateView(certificate || {}, resolvedSignatory);

  return (
    <div
      ref={ref}
      id={exportId}
      data-certificate-export={exportId ? 'true' : undefined}
      data-paper={theme.paper}
      data-template-key={template.key}
      className={className}
      style={{
        position: 'relative',
        width: CERTIFICATE_WIDTH,
        height: CERTIFICATE_HEIGHT,
        flex: '0 0 auto',
        overflow: 'hidden',
        background: theme.paper,
        ...style,
      }}
    >
      <Template view={view} theme={theme} signatory={resolvedSignatory} />
    </div>
  );
}

/**
 * A down-scaled, responsive view of a certificate.
 *
 * The measuring wrapper is what shrinks; the document inside it stays at its
 * native size and is scaled with `transform`, so text metrics match the PDF
 * exactly. This wrapper is for display only — never hand it to html2canvas.
 */
export function CertificatePreview({
  certificate,
  templateKey,
  className = '',
  style,
  signatory,
}) {
  const containerRef = useRef(null);
  const [scale, setScale] = useState(0);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return undefined;

    const update = () => {
      const width = node.clientWidth;
      setScale(width > 0 ? width / CERTIFICATE_WIDTH : 0);
    };

    update();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', update);
      return () => window.removeEventListener('resize', update);
    }

    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        position: 'relative',
        width: '100%',
        aspectRatio: `${CERTIFICATE_WIDTH} / ${CERTIFICATE_HEIGHT}`,
        overflow: 'hidden',
        ...style,
      }}
    >
      {scale > 0 ? (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: CERTIFICATE_WIDTH,
            height: CERTIFICATE_HEIGHT,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
          }}
        >
          <CertificateDocument
            certificate={certificate}
            templateKey={templateKey}
            signatory={signatory}
          />
        </div>
      ) : null}
    </div>
  );
}
