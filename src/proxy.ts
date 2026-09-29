import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

function setSecurityHeaders(response: NextResponse, req: NextRequest) {
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction) {
    response.headers.set('Content-Security-Policy', [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      // ⚠️ Without an explicit `frame-src`, the `default-src 'self'` above
      // governs <iframe> targets, so a frame pointing at drive.google.com is
      // BLOCKED IN PRODUCTION while working fine under `next dev` — this
      // whole block is production-only. That is a silent, prod-only breakage
      // local testing cannot catch; verify it by reading the response headers
      // of a production build (`npm run build && npm run start`, then
      // `curl -sI http://localhost:3000/hackathon`).
      //
      // The allowlist is FIXED rather than `frame-src https:` on purpose. A
      // blanket `https:` lets any admin-supplied URL be framed inside our own
      // origin, which is a phishing / UI-redressing surface: the framed page
      // inherits our address bar, TLS indicator and layout. Two hosts cover
      // every case `deriveEmbeddableUrl` in `src/lib/hackathon.js` can emit,
      // so this list and that function's host allowlist are COUPLED BY DESIGN.
      // Add a host to one and you must add it to the other, or the iframe
      // breaks in production only.
      "frame-src 'self' https://drive.google.com https://docs.google.com",
      "connect-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com https://res.cloudinary.com https://ui-avatars.com https: ws:",
      "font-src 'self' https://fonts.gstatic.com data:",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "base-uri 'self'",
      "upgrade-insecure-requests",
    ].join('; '));
  }

  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set(
    'Permissions-Policy',
    'camera=(),microphone=(),geolocation=(),usb=(),payment=(),accelerometer=(),gyroscope=(),magnetometer=()'
  );
  // `X-Frame-Options: DENY` (and `frame-ancestors 'none'` above) govern whether
  // OURSELVES may be framed by someone else. They say nothing about what we
  // are allowed to frame, which is what `frame-src` controls. Leaving these
  // as-is: clickjacking protection on our own pages is unrelated to, and must
  // not be relaxed for, embedding a Google Drive preview.
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Cross-Origin-Embedder-Policy', 'unsafe-none');
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  response.headers.set('Cross-Origin-Resource-Policy', 'same-origin');

  if (req.nextUrl.hostname !== 'localhost' && req.nextUrl.hostname !== '127.0.0.1' && req.nextUrl.hostname !== '0.0.0.0') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload'
    );
  }
}

export function proxy(request: NextRequest) {
  const response = NextResponse.next();
  setSecurityHeaders(response, request);
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
};
