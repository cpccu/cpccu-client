/**
 * The sandboxed document frame shared by the rule book and the problem set.
 *
 * WHY THIS IS ITS OWN COMPONENT: the `sandbox` and `referrerPolicy` values
 * below are SECURITY attributes, not styling. While each panel carried its own
 * inline `<iframe>`, a future tightening of the sandbox (dropping
 * `allow-scripts`, say) would have to be applied in two places, and the panel
 * nobody remembered would quietly keep the looser policy. One frame, one
 * policy, one place to change it.
 *
 * Both callers pass a URL that `deriveEmbeddableUrl` has already vouched for, so
 * `src` is always a rebuilt, canonical `drive.google.com` / `docs.google.com`
 * preview URL — never the admin's href verbatim. That matters for production:
 * the CSP `frame-src` in `src/proxy.ts` lists those two bare hosts, and host
 * matching there is EXACT, so a `www.`-prefixed src would render a silently
 * blank frame in production while looking fine under `next dev`. See the ⚠️
 * block in `src/lib/hackathon.js`.
 *
 * ⚠️ CALLERS MUST NOT PASS AN UNVALIDATED URL. This component deliberately
 * performs no validation of its own — doing it here would be a second,
 * silently-diverging copy of `toSafeHref` + `deriveEmbeddableUrl`. Gate the
 * input at the call site.
 *
 * This component is deliberately NOT a client component: it holds no state and
 * registers no handlers, so it adds nothing to the client bundle. It is
 * rendered inside client panels and inherits their boundary.
 */
export default function HackathonDocumentFrame({ src, title }) {
  return (
    <iframe
      src={src}
      // `sandbox` withholds everything the viewer does not need. It has to
      // include `allow-scripts` + `allow-same-origin` because Google's preview
      // viewer is a script-driven app, and `allow-popups` because "Open in
      // Drive" inside the viewer is the normal escape hatch.
      // `allow-popups-to-escape-sandbox` is what lets that escape hatch actually
      // work instead of being neutered by the sandbox.
      sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-presentation"
      // `no-referrer` keeps the visitor's URL and any query string off the
      // framed request entirely.
      referrerPolicy="no-referrer"
      loading="lazy"
      title={title}
      /* ⚠️ `svh`, NOT `vh`. On mobile browsers `vh` counts the tallest
         viewport, which includes the URL bar that collapses on scroll — so a
         `70vh` frame pushed the bottom of the document behind browser chrome
         where it could not be scrolled to. `svh` is the smallest viewport height
         and is stable under that collapse. The `min-h` steps up at `md` because
         28rem (448px) exceeds the usable height of a landscape phone. A phone in
         portrait still gets 60svh, which is the most of the screen a scrollable
         embed can usefully own. */
      className="h-[60svh] min-h-[22rem] w-full rounded-2xl border border-border bg-white md:h-[70svh] md:min-h-[28rem]"
    />
  );
}
