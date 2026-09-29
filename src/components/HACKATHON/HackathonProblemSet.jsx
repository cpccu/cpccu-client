"use client";

import Link from "next/link";
import { useSelector } from "react-redux";
import { FileQuestion, Lock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetPublicHackathonProblemSetQuery } from "@/features/content/contentApi";
import { toSafeHref } from "@/lib/hackathon";
import { hasHackathonStarted } from "@/lib/countdown";
import { useHackathonPhase } from "@/hooks/use-hackathon-phase";

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
 * consults `endDate`; `phase` DOES consult `endDate`, so a record with a valid
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
      : Boolean(problemSetAvailable) && hasHackathonStarted({ date: startAt, now });

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
        <div className="flex items-start gap-3 rounded-2xl border border-border bg-card px-6 py-6">
          <FileQuestion className="mt-0.5 size-6 shrink-0 text-header" />
          <p className="text-muted-foreground">{notReleasedCopy}</p>
        </div>
      </section>
    );
  }

  if (!user) {
    return (
      <section className="flex flex-col gap-3">
        {header}
        <div className="flex flex-col items-start gap-3 rounded-2xl border border-border bg-card px-6 py-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Lock className="mt-0.5 size-6 shrink-0 text-header" />
            <p className="text-muted-foreground">
              Sign in with your CPCCU account to view the problem set.
            </p>
          </div>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-lg bg-header px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-header-hover"
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
        <div className="flex items-start gap-3 rounded-2xl border border-border bg-card px-6 py-6">
          <FileQuestion className="mt-0.5 size-6 shrink-0 text-header" />
          <p className="text-muted-foreground">
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
        <div className="flex items-start gap-3 rounded-2xl border border-border bg-card px-6 py-6">
          <FileQuestion className="mt-0.5 size-6 shrink-0 text-header" />
          <p className="text-muted-foreground">
            The problem set is not available right now.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3">
      {header}
      <div className="flex flex-col items-start gap-3 rounded-2xl border border-border bg-card px-6 py-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <FileQuestion className="mt-0.5 size-6 shrink-0 text-header" />
          <p className="text-muted-foreground">
            Download the problem set and start working.
          </p>
        </div>
        <a
          href={problemSetUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg bg-header px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-header-hover"
        >
          Open problem set
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      </div>
    </section>
  );
}
