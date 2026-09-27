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
