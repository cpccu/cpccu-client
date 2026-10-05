import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

function setSecurityHeaders(response: NextResponse, req: NextRequest) {
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction) {
    response.headers.set('Content-Security-Policy', [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      // ⚠️ `https://fonts.googleapis.com` MUST be listed here or the Inria Sans
      // stylesheet in `src/app/layout.jsx` is BLOCKED. It was missing while
      // `connect-src` and `font-src` below BOTH already permitted the host —
      // which is the confusing shape of the bug: two of three directives allowed
      // it, so it read like a browser or network fault rather than a policy one.
      // Every browser logged
      //
      //   Loading the stylesheet 'https://fonts.googleapis.com/css2?family=…'
      //   violates the following Content Security Policy directive:
      //   "style-src 'self' 'unsafe-inline'"
      //
      // and the whole site silently rendered in a fallback font.
      //
      // `style-src` governs the `<link rel="stylesheet">` itself; `font-src`
      // governs the font FILES that stylesheet then pulls down from
      // fonts.gstatic.com. Both are required and neither substitutes for the
      // other, which is why fixing `font-src` alone does not work. `font-src`
      // additionally needs `data:` because Next.js inlines some font preloads.
      //
      // Verify in a PRODUCTION build only — this whole block is production-gated,
      // so `next dev` cannot reproduce the failure:
      //   npm run build && npm run start
      //   curl -sI http://localhost:3000/ | grep -i content-security-policy
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
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
