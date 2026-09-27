import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

function setSecurityHeaders(response: NextResponse, req: NextRequest) {
  const isProduction = process.env.NODE_ENV === 'production';

  if (isProduction) {
    response.headers.set(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        // ONE `script-src`, NOT TWO. A previous revision listed
        // `https://vercel.live` and `https://vercel.com` as two separate
        // `script-src` directives. Per CSP, a duplicate directive is DISCARDED
        // and the browser reports "Ignoring duplicate Content-Security-Policy
        // directive 'script-src'", so the second origin silently stopped being
        // enforced — the header looked stricter than it was.
        "script-src 'self' 'unsafe-inline' https://vercel.live https://vercel.com",
        // `frame-src` IS SET EXPLICITLY, AND IT HAS TO BE. Vercel's Toolbar and
        // LiveReload inject an IFRAME from `https://vercel.live`, and `frame-src`
        // falls back to `default-src 'self'`, which does not contain that origin
        // — so the frame was blocked and the browser logged "Framing
        // 'https://vercel.live/' violates the following Content Security Policy
        // directive". Widening `script-src` (as the previous revision tried)
        // cannot fix a framing error; only `frame-src` can.
        "frame-src 'self' https://vercel.live https://vercel.com",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "img-src 'self' data: blob: https:",
        "connect-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com https://res.cloudinary.com https://ui-avatars.com https: ws:",
        "font-src 'self' https://fonts.gstatic.com data:",
        "object-src 'none'",
        "frame-ancestors 'none'",
        "form-action 'self'",
        "base-uri 'self'",
        'upgrade-insecure-requests',
      ].join('; '),
    );
  }

  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set(
    'Permissions-Policy',
    'camera=(),microphone=(),geolocation=(),usb=(),payment=(),accelerometer=(),gyroscope=(),magnetometer=()',
  );
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Cross-Origin-Embedder-Policy', 'unsafe-none');
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  response.headers.set('Cross-Origin-Resource-Policy', 'same-origin');

  if (
    req.nextUrl.hostname !== 'localhost' &&
    req.nextUrl.hostname !== '127.0.0.1' &&
    req.nextUrl.hostname !== '0.0.0.0'
  ) {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains; preload',
    );
  }
}

export function proxy(request: NextRequest) {
  const response = NextResponse.next();
  setSecurityHeaders(response, request);
  return response;
}

export const config = {
  // `/api` IS INCLUDED, and the `api/` term is DELIBERATELY ABSENT from this
  // lookahead. The Express original applied helmet to EVERY response, API
  // included (`app.js:12`), so a matcher that skips `/api` is a net regression:
  // no `X-Content-Type-Options`, no `X-Frame-Options` and no HSTS on any API
  // response.
  //
  // ---------------------------------------------------------------------------
  // HISTORY — a previous revision of this file ADDED `api/` to the lookahead
  // (i.e. excluded `/api`) and that was a REAL LOGIC ERROR, not a
  // conservative safety margin. Read the pattern as a regex, not as a
  // path-prefix list:
  //
  //     ^/((?!api/|…).*)$
  //
  // The leading `/` is a LITERAL that is consumed FIRST. The negative lookahead
  // is only then evaluated against the REMAINDER (`api/v1/auth/login`), where
  // `api/` matches, the lookahead fails, and the whole path fails to match.
  // So the term intended to exclude `/api` excluded nothing at all — while its
  // comment confidently asserted that `/api` was included. Any reader trusting
  // that comment would be reasoning about a matcher that did not exist. Do not
  // re-add `api/` believing it is a body-safety measure; there is no such effect
  // to be had, only the bug it already caused.
  // ---------------------------------------------------------------------------
  //
  // THE BODY-BUFFERING REASONING THAT LED TO THAT TERM, STATED PRECISELY. When
  // the proxy MATCHES a path, Next clones and BUFFERS the request body in memory
  // so both the proxy and the underlying route handler can read it. The ceiling
  // is `experimental.proxyClientMaxBodySize`, which DEFAULTS TO 10 MB, and
  // exceeding it is not an error: the body is "only buffered up to the limit"
  // and a warning is logged, with NOTHING returned to the caller. A handler
  // silently receives a short body, and a multipart upload is corrupted in
  // transit with no visible failure. See
  // node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/proxyClientMaxBodySize.md
  //
  // THAT CEILING IS UNREACHABLE FOR `/api` ON VERCEL, which is the whole point.
  // Vercel rejects ANY request body over 4.5 MB with
  // `413 FUNCTION_PAYLOAD_TOO_LARGE` AT THE EDGE, before the request reaches
  // this function. 4.5 MB is strictly below the 10 MB default, so no `/api`
  // request can ever grow a body large enough to be truncated: the constraint is
  // real but cannot be triggered by anything this app accepts. One matcher that
  // covers every route that will ever exist is a far better trade than leaving
  // every API response header-less and re-adding the headers by hand at each
  // route — which is why `apiRoute` in `src/lib/server/http.js` also sets
  // `nosniff` and `no-store` as a backstop in case this matcher is edited again.
  //
  // `favicon.ico`, `sitemap.xml` and `robots.txt` are excluded as static
  // crawl/metadata assets. None of the security headers set above are meaningful
  // there. The `Content-Security-Policy` is inert on a non-document response
  // (browsers only enforce CSP on documents, so it is harmlessly ignored on API
  // JSON) — but the other headers in `setSecurityHeaders` are not, which is the
  // whole reason `/api` is included.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
};
