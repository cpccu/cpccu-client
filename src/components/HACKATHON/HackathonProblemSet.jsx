"use client";

import Link from "next/link";
import { useSelector } from "react-redux";
import { ExternalLink, FileQuestion, Lock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetPublicHackathonProblemSetQuery } from "@/features/content/contentApi";
import { deriveEmbeddableUrl, toSafeHref } from "@/lib/hackathon";
import { hasHackathonStarted } from "@/lib/countdown";
import { useHackathonPhase } from "@/hooks/use-hackathon-phase";
import HackathonDocumentFrame from "@/components/HACKATHON/HackathonDocumentFrame";

/**
 * Problem-set panel.
 *
 * Props:
 *   phase               — the SERVER's phase, used only as the pre-mount seed
 *   startAt             — UTC ISO string of the start instant
 *   endAt               — UTC ISO string of the end instant
 *   problemSetAvailable — server's advisory flag, computed by the server from
 *                         the same "has it started?" rule mirrored below
 *
 * TWO GATES, ONLY ONE OF WHICH IS OURS
 * -------------------------------------
 * The problem set URL is behind `verifyToken` AND the start time server-side.
 * This component only decides whether to OFFER the affordance:
 *
 *   - not started yet: show the "available when the hackathon starts" notice
 *     and never issue the request. The `skip` flag means a signed-in visitor
 *     cannot even probe the endpoint before the start, so the response cannot
 *     be used to confirm that a problem set has been prepared.
 *   - signed out: show the login prompt. The 401/403 is not the point; we do not
 *     want to make a visitor log in to be told they cannot see it.
 *   - signed in and released: fetch it and link.
 *
 * ⚠️ `isReleased` IS `problemSetAvailable && hasHackathonStarted(startAt)` — IT
 * IS NOT `phase === 'live' || phase === 'ended'`. Those are different rules.
 * The server's gate is "a valid start instant that has passed" and it never
 * consults `endAt`; `phase` DOES consult `endAt`, so a record with a valid
 * start but a missing or inverted end resolves to `phase === 'unannounced'`
 * while the server would still answer 200. Keying off `phase` made the client
 * show "will be available when the hackathon starts" forever and never issue
 * the request. `hasHackathonStarted` in `src/lib/countdown.js` is the mirror
 * of the server's `isProblemSetReleased`, so the two agreeing is by
 * construction, not by luck.
 *
 * THE CLIENT IS DELIBERATELY CONSERVATIVE. It is an AND: the server must have
 * said the set is available AND the local clock must agree. When the two
 * disagree (a record edited moments after the page was cached, or a clock skew
 * on a visitor's device) the client refuses to request, and the server is
 * still the authority — it re-checks on every call. Being conservative can
 * only ever delay an affordance that the endpoint would serve; it can never
 * expose anything.
 *
 * ⚠️ THE PHASE COMES FROM `useHackathonPhase`, THE SAME SOURCE AS THE
 * COUNTDOWN. With the raw server prop, a tab left open across `startAt` kept
 * the "not released" notice up and the request `skip`ped while the countdown
 * above had already flipped to "Ends in" — a signed-in member got no problem
 * set at all until a hard refresh. See `src/hooks/use-hackathon-phase.js`.
 *
 * `problemSetAvailable` is treated as advisory only. Forging it in devtools
 * earns a 403 and nothing else — the real gate is the endpoint.
 *
 * EMBEDDING, SAME POLICY AS THE RULE BOOK
 * --------------------------------------
 * When `deriveEmbeddableUrl` recognises the admin's URL (a Google Doc or a
 * Drive file) the set is framed inline, and the "open in a new tab" card is
 * rendered UNDERNEATH it. When it does not, only the card renders. `null` from
 * `deriveEmbeddableUrl` must never become an `<iframe src>` — most document
 * hosts send `X-Frame-Options: DENY`, so the frame would be blank and the panel
 * would look broken. A link card does not.
 *
 * The link is kept under the frame deliberately, unlike the rule book: a framed
 * document is always a compromise (cramped on a phone, awkward to zoom, and
 * Google's "Open in Drive" is not discoverable), and the problem set is the one
 * artefact a participant genuinely needs full-screen while working.
 *
 * OUTBOUND LINK RULE: see `src/lib/hackathon.js`. The problem set link is a
 * plain anchor with `rel="noopener noreferrer"`; the login prompt is an
 * internal route and correctly uses `next/link`.
 */
export default function HackathonProblemSet({
  phase,
  startAt,
  endAt,
  problemSetAvailable,
}) {
  const user = useSelector((state) => state.auth.user);

  const { now, phase: activePhase } = useHackathonPhase({
    startAt,
    endAt,
    serverPhase: phase,
  });

  // Before mount there is no clock, so the SERVER's phase is the only verdict
  // available — and the server's phase already accounts for the full window,
  // which is exactly what we want to show in the server-rendered HTML.
  // After mount the local clock re-evaluates the real rule every tick.
  const isReleased =
    now === null
      ? Boolean(problemSetAvailable) && (activePhase === "live" || activePhase === "ended")
      : Boolean(problemSetAvailable) && hasHackathonStarted({ startAt, now });

  // The copy differs by REASON, not by symmetry. Telling an unannounced visitor
  // "the problem set will be available when the hackathon starts" is a promise
  // about an event that has no published start time at all — the honest
  // message there is that no schedule exists yet.
  const notReleasedCopy =
    activePhase === "unannounced"
      ? "No problem set has been published yet. The organisers have not announced a schedule for the hackathon."
      : "The problem set will be available when the hackathon starts.";

  // `skip` rather than a guard inside the body: the decision is derived ONLY
  // from props and the store, never from render order or anything transient, so
  // a re-render cannot re-fire the request. (RTK Query handles `skip` flipping
  // freely — the reason this is stable is that the inputs are, not that the
  // hook order is.)
  const { data, error, isLoading } = useGetPublicHackathonProblemSetQuery(undefined, {
    skip: !user || !isReleased,
  });

  const header = (
    <h2 className="text-2xl font-bold text-foreground">Problem set</h2>
  );

  if (!isReleased) {
    return (
      <section className="flex flex-col gap-3">
        {header}
        <div className="flex min-w-0 items-start gap-3 rounded-2xl border border-border bg-card px-6 py-6">
          <FileQuestion className="mt-0.5 size-6 shrink-0 text-header" />
          <p className="break-words text-muted-foreground">{notReleasedCopy}</p>
        </div>
      </section>
    );
  }

  if (!user) {
    return (
      <section className="flex flex-col gap-3">
        {header}
        <div className="flex flex-col items-start gap-3 rounded-2xl border border-border bg-card px-6 py-6 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <Lock className="mt-0.5 size-6 shrink-0 text-header" />
            <p className="break-words text-muted-foreground">
              Sign in with your CPCCU account to view the problem set.
            </p>
          </div>
          <Link
            href="/login"
            /* `min-h-[2.75rem]` (44px) is the touch-target floor — `px-4 py-2
               text-sm` alone is ~36px. `md:min-h-0` hands the height back to
               the padding once there is a mouse. `shrink-0` stops the sentence
               beside it from squeezing the label. */
            className="inline-flex min-h-[2.75rem] shrink-0 items-center justify-center gap-2 rounded-lg bg-header px-4 py-2 text-center text-sm font-bold text-white transition-colors hover:bg-header-hover md:min-h-0"
          >
            Sign in
          </Link>
        </div>
      </section>
    );
  }

  if (isLoading) {
    return (
      <section className="flex flex-col gap-3">
        {header}
        <Skeleton className="h-24 w-full rounded-2xl" />
      </section>
    );
  }

  if (error) {
    // House error idiom: the server returns `{ status, message, errors }`, so
    // the message lives at `data.message`. A 404 means "no problem set has
    // been published" and a 403 means "not started yet" — both are states the
    // visitor can act on, so the server's own wording is shown.
    return (
      <section className="flex flex-col gap-3">
        {header}
        <div className="flex min-w-0 items-start gap-3 rounded-2xl border border-border bg-card px-6 py-6">
          <FileQuestion className="mt-0.5 size-6 shrink-0 text-header" />
          <p className="break-words text-muted-foreground">
            {error?.data?.message ||
              "The problem set is not available right now."}
          </p>
        </div>
      </section>
    );
  }

  // Re-validated on arrival: the URL crosses the network and is admin-supplied.
  const problemSetUrl = toSafeHref(data?.data?.problemSetUrl);

  if (!problemSetUrl) {
    return (
      <section className="flex flex-col gap-3">
        {header}
        <div className="flex min-w-0 items-start gap-3 rounded-2xl border border-border bg-card px-6 py-6">
          <FileQuestion className="mt-0.5 size-6 shrink-0 text-header" />
          <p className="break-words text-muted-foreground">
            The problem set is not available right now.
          </p>
        </div>
      </section>
    );
  }

  /* ⚠️ EMBEDDING DOES NOT WEAKEN EITHER GATE ABOVE.
     By the time this line runs the visitor is signed in AND the set is released,
     so the URL is already in the page: it is fetched from a `verifyToken`-
     protected endpoint, it is never in the server-rendered HTML, and it never
     touches a shared cache. An `<iframe src>` exposes exactly as much as the
     `<a href>` this component already rendered — it is the same string in the
     same DOM, in a different attribute. `/preview` is if anything the SAFER of
     the two: it cannot drop a visitor into Google's editor.
     The URL is also rebuilt onto a canonical bare host by
     `deriveEmbeddableUrl`, so it stays inside the production CSP `frame-src`
     allowlist in `src/proxy.ts` — which already covers both hosts it can emit,
     because the rule book embeds the same way. No CSP change is needed. */
  const embedUrl = deriveEmbeddableUrl(problemSetUrl);

  /* The new-tab affordance. Rendered under BOTH shapes, because a framed
     document is always a compromise: Google's viewer is cramped on a phone,
     zoom is awkward, and "Open in Drive" is the normal escape hatch but is not
     discoverable. Same rule as the rule book — plain anchor with
     `rel="noopener noreferrer"`, never `next/link` (see `src/lib/hackathon.js`). */
  const openLink = (
    <div className="flex flex-col items-start gap-3 rounded-2xl border border-border bg-card px-6 py-6 md:flex-row md:items-center md:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <FileQuestion className="mt-0.5 size-6 shrink-0 text-header" />
        <p className="break-words text-muted-foreground">
          {embedUrl
            ? "Prefer a full-screen view? Open the problem set in a new tab."
            : "The problem set is hosted on an external service and cannot be displayed here."}
        </p>
      </div>
      <a
        href={problemSetUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-[2.75rem] shrink-0 items-center justify-center gap-2 rounded-lg bg-header px-4 py-2 text-center text-sm font-bold text-white transition-colors hover:bg-header-hover md:min-h-0"
      >
        Open problem set
        <span className="sr-only">(opens in a new tab)</span>
        <ExternalLink className="size-4" />
      </a>
    </div>
  );

  if (embedUrl) {
    return (
      <section className="flex flex-col gap-3">
        {header}
        <HackathonDocumentFrame src={embedUrl} title="Problem set" />
        {openLink}
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3">
      {header}
      {openLink}
    </section>
  );
}
