/** @type {import('next').NextConfig} */
const nextConfig = {
  // output: "export", // for static
  reactStrictMode: true,
  // Do not advertise the framework. `X-Powered-By: Next.js` tells an attacker
  // exactly which version to look up published CVEs for, and costs nothing to
  // remove.
  poweredByHeader: false,
  // `mongoose` stays external because it reaches for its own files through
  // dynamic `require` calls (the optional native/node-gyp drivers) that webpack
  // cannot statically analyse. Bundling it fails `next build` with
  // "Module not found: Can't resolve 'dns'" style errors. Marking it external
  // resolves it from node_modules at runtime instead.
  //
  // `firebase-admin` WAS listed here and has been removed: it was pulled in for
  // the Google sign-in endpoints (`POST /api/v1/auth/google-signin` and
  // `/google-signup`), which the client never called, so it was dead code. It is
  // the largest attack surface the migration introduced (it transitively drags in
  // `google-auth-library`, `node-forge` and `@grpc/grpc-js`).
  //
  // WARNING: if Firebase auth is ever reintroduced, `firebase-admin` MUST be
  // added back to this array. Leaving it out makes the build fail on the
  // dynamic requires, exactly as above.
  serverExternalPackages: ["mongoose"],
  images: {
    // unoptimized: true, // for static
    //
    // THIS ALLOW-LIST IS DERIVED FROM ACTUAL `next/image` USAGE, not from every
    // host the codebase mentions in a string. Grepping `<Image ... src=` under
    // `src/components/**` and `src/app/**` yields exactly two remote hosts:
    //
    //   res.cloudinary.com        — user avatars and cover images
    //                               (ProfileHero.jsx:44, Profile.jsx:867), which
    //                               are Cloudinary delivery URLs.
    //   avatars.githubusercontent.com — AboutCard.jsx:10-16 via AboutPage.jsx:7,
    //                               fed by data/Committee.json:45,
    //                               data/donators.json:288 and all 11 entries of
    //                               data/contributors.json. Omitting this host
    //                               makes `next/image` throw "Invalid src prop …
    //                               hostname is not configured" at RUNTIME and
    //                               takes the whole About page down.
    //
    // The hosts that were previously listed and are deliberately NOT here:
    //   api.github.com            — used only by the build-time Python script
    //                               that regenerates contributors.json, never by
    //                               an image component.
    //   raw.githubusercontent.com — never an image source.
    //   github.com                — link targets only.
    //   fonts.googleapis.com /
    //   fonts.gstatic.com         — `<link rel="preconnect">` / stylesheet
    //                               in app/layout.jsx:15-18, not `next/image`
    //                               sources. The CSP in src/proxy.ts is what
    //                               governs those, and it already lists them.
    //   ui-avatars.com            — an `onError` fallback assigned to a plain
    //                               `<img>` (DonatorCard.jsx:20,
    //                               ContributorCard.jsx:21,
    //                               PreviousCommittee.jsx:82), which is not
    //                               optimised by Next and so is not subject to
    //                               this allow-list.
    //
    // WHY THE LIST IS EXPLICIT. The original `hostname: "**"` across http AND
    // https let the image optimiser fetch from ANY host: an SSRF surface. A
    // user-controlled `avatar` / `coverImage` URL in a profile payload pointing
    // at `169.254.169.254` (the cloud metadata endpoint) or `127.0.0.1` would
    // have been fetched by Vercel's image optimiser FROM INSIDE the deployment,
    // with the response returned to the attacker. Do not widen this list back to
    // a wildcard; add a host explicitly when a new remote image source is
    // introduced, and only after checking where that URL is stored and who can
    // set it.
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
    ],
  },
};

export default nextConfig;
