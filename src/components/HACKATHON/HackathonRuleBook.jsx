"use client";

import { ExternalLink, FileText } from "lucide-react";
import { deriveEmbeddableUrl, toSafeHref } from "@/lib/hackathon";
import HackathonDocumentFrame from "@/components/HACKATHON/HackathonDocumentFrame";

/**
 * Rule book viewer.
 *
 * Props:
 *   ruleBookUrl — the admin-supplied URL, already run through `toSafeHref`
 *                 by `toPublicHackathon` (so it is `''` when unsafe)
 *   title       — hackathon title, used for the iframe's accessible name
 *
 * THE FRAME FALLBACK IS THE POINT OF THIS COMPONENT.
 * `deriveEmbeddableUrl` returns `null` for anything it does not recognise as
 * embeddable, and `null` must render the "open in a new tab" card — never an
 * `<iframe src={originalUrl}>`. Pointing an iframe at an arbitrary host would
 * either render a blocked blank frame (most document hosts send
 * `X-Frame-Options: DENY`) or, worse, frame third-party content inside our own
 * chrome. A dead iframe looks broken; a link card does not.
 *
 * The production CSP `frame-src` allowlist in `src/proxy.ts` covers exactly the
 * hosts `deriveEmbeddableUrl` can emit. Those two lists are coupled on purpose,
 * and the coupling only holds because `deriveEmbeddableUrl` REBUILDS every URL
 * it returns on a bare, CSP-listed host — it never hands back the admin's href
 * verbatim. A `www.docs.google.com` input is normalised to `docs.google.com`
 * precisely so it cannot pass the allowlist check and then be rejected by
 * `frame-src`, which would work under `next dev` (where the CSP is absent) and
 * render a blank frame in production.
 *
 * OUTBOUND LINK RULE: see the block comment at the top of `src/lib/hackathon.js`
 * — plain `<a target="_blank" rel="noopener noreferrer">`, never `next/link`.
 */
export default function HackathonRuleBook({ ruleBookUrl, title = "Hackathon" }) {
  if (!ruleBookUrl) {
    return null;
  }

  // Re-checked here even though `toPublicHackathon` already filtered it, so a
  // caller that hands this component an unmapped value cannot get a raw
  // `javascript:` string into an `href`.
  const safeUrl = toSafeHref(ruleBookUrl);

  if (!safeUrl) {
    return null;
  }

  const embedUrl = deriveEmbeddableUrl(safeUrl);

  if (embedUrl) {
    return (
      <section className="flex flex-col gap-3">
        <h2 className="text-2xl font-bold text-foreground">Rule book</h2>
        {/* The frame's sandbox, referrer policy and responsive height live in
            `HackathonDocumentFrame` so the problem set's frame cannot drift from
            this one. */}
        <HackathonDocumentFrame src={embedUrl} title={`${title} rule book`} />
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-2xl font-bold text-foreground">Rule book</h2>
      {/* ⚠️ The row switch is `md` (768px), not `sm` (480px — this theme
          redefines `sm`, it is not Tailwind's 640px). At 480px the 24px icon,
          the gap and a ~130px button leave the sentence ~230px, which then
          wraps four lines vertically centred beside a short button. */}
      <div className="flex flex-col items-start gap-3 rounded-2xl border border-border bg-card px-6 py-6 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <FileText className="size-6 shrink-0 text-header" />
          <p className="break-words text-muted-foreground">
            The rule book is hosted on an external service and cannot be
            displayed here.
          </p>
        </div>
        <a
          href={safeUrl}
          target="_blank"
          rel="noopener noreferrer"
          /* `min-h-[2.75rem]` (44px) is the touch-target floor; `px-4 py-2 text-sm`
             alone is ~36px. `md:min-h-0` hands the height back to the padding
             once there is a mouse. `shrink-0` stops a long sentence from
             squeezing the label mid-word. */
          className="inline-flex min-h-[2.75rem] shrink-0 items-center justify-center gap-2 rounded-lg bg-header px-4 py-2 text-center text-sm font-bold text-white transition-colors hover:bg-header-hover md:min-h-0"
        >
          Open rule book
          <span className="sr-only">(opens in a new tab)</span>
          <ExternalLink className="size-4" />
        </a>
      </div>
    </section>
  );
}
