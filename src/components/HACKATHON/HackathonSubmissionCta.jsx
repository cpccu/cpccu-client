"use client";

import Link from "next/link";
import { Send } from "lucide-react";
import { toSafeHref } from "@/lib/hackathon";
import { useHackathonPhase } from "@/hooks/use-hackathon-phase";
import { useGetEventParticipationWindowQuery } from "@/features/participation/participationApi";
import { resolveWindowAction } from "@/lib/participation";

/**
 * Project-submission call-to-action. Renders below the problem set.
 *
 * Props:
 *   eventId        — the hackathon's own Event `_id`, so the in-app page can be
 *                    addressed. Absent on older payloads; every branch degrades to
 *                    the external form without it.
 *   phase          — the SERVER's phase, used only as the pre-mount seed
 *   startAt        — UTC ISO string of the start instant
 *   endAt          — UTC ISO string of the end instant
 *   submissionUrl  — admin-supplied Google Form target, already filtered by
 *                    `toPublicHackathon`
 *
 * WHERE THE SUBMISSION FORM LIVES
 * -------------------------------
 * BOTH PLACES, AND THE ADMIN PICKS. `submissionEnabled` on the `Event` document
 * switches this CTA to the in-app submission page at `/event/<id>/submit`;
 * otherwise it uses the external form. This is the same rule
 * `resolveRegistrationTarget` applies to registration, applied to a different
 * admin field — `submissionEnabled` + `hackathonSubmissionUrl` — because the two
 * have different lifetimes and are configured independently. The hackathon is an
 * ordinary `Event` document and `resolveEventParticipationWindow` reads those
 * fields from any event with no type check, which is what makes the same feature
 * work for a workshop without a second code path.
 *
 * ⚠️ WHY THIS IS NOT GATED BY PHASE, WHILE `HackathonProblemSet` IS. The problem
 * set is the competition itself; releasing it early would leak the questions to
 * teams that have not started. A submission form is the opposite: it is the route
 * by which a team hands its work in, and a team that cannot find it simply cannot
 * take part. The in-app window has its own `submissionOpenAt`/`submissionCloseAt`, which is
 * where a hard cutoff lives when the club wants one.
 *
 * ⚠️ WHY THE PHASE COMES FROM `useHackathonPhase`, NOT THE RAW PROP. Same reason
 * as the registration CTA and the countdown: the server resolves phase once, at
 * request time, so a tab left open across `startAt` would otherwise keep saying
 * "nothing to submit yet" (or keep offering to submit) long after the truth
 * changed. Nothing invalidates the `PublicContent: 'hackathon'` tag on a timer,
 * so a refetch will not save it. One clock, one verdict.
 *
 * VISIBILITY: shown from kickoff onwards — `live` AND `ended`.
 *
 * The `ended` case is deliberate. Deriving visibility from `endAt` alone would
 * hide the form the moment the clock runs out, but a hackathon's submission window
 * almost never ends at the closing ceremony: teams get a day or two to finish, and
 * an admin who has published the form is saying "this is still open". The in-app
 * path honours `submissionCloseAt`, so it can express the hard cutoff the
 * external form cannot.
 *
 * ⚠️ WHEN THE WINDOW IS SHUT AND THE MODE IS IN-APP, THE LINK STILL POINTS
 * IN-APP. A member whose deadline has passed most wants to confirm what they
 * filed, and the submit route renders their existing submission read-only. Sending
 * them to a Google Form instead would discard the one thing they came for.
 *
 * OUTBOUND LINK RULE: the external branch is a plain anchor with
 * `rel="noopener noreferrer"`, never `next/link` — see the block comment at the top
 * of `src/lib/hackathon.js`. The in-app branch is an internal route and correctly
 * uses `next/link`.
 */
export default function HackathonSubmissionCta({
  eventId,
  phase,
  startAt,
  endAt,
  submissionUrl,
}) {
  const { phase: activePhase } = useHackathonPhase({
    startAt,
    endAt,
    serverPhase: phase,
  });

  const { data: windowResponse } = useGetEventParticipationWindowQuery(eventId, {
    skip: !eventId,
  });

  const submissionState = resolveWindowAction(
    windowResponse?.data,
    'submission'
  );

  // Nothing to submit before the hackathon has begun. `unannounced` has no
  // trustworthy window, so it is treated as "not yet" rather than guessing.
  if (activePhase !== "live" && activePhase !== "ended") {
    return null;
  }

  // ⚠️ THE INTERNAL BRANCH IS CHECKED FIRST, for the same reason as the
  // registration CTA: when an admin has switched this hackathon onto the in-app
  // flow, the external `submissionUrl` is a leftover from before, and preferring
  // it would discard the entry into the system of record.
  const useInApp = submissionState.enabled && Boolean(eventId);

  // Re-checked on arrival even though `toPublicHackathon` already filtered it, so
  // a caller that hands this component an unmapped value cannot get a raw
  // `javascript:` string into an `href`.
  const safeUrl = useInApp ? "" : toSafeHref(submissionUrl);

  // A button with no href is a dead control.
  if (!useInApp && !safeUrl) {
    return null;
  }

  const isEnded = activePhase === "ended";

  // ⚠️ THE COPY DIFFERS BY WINDOW STATE AND BY PHASE — three separate questions,
  // and collapsing them produces the classic "submissions closed" shown to a team
  // whose deadline has not passed yet.
  const copy = useInApp
    ? submissionState.open
      ? isEnded
        ? "The hackathon has finished, but submissions are still open. Send your project through this site."
        : "Finished building? Send your project through this site before the deadline."
      : "Finished building? You can still review what you submitted."
    : isEnded
      ? "The hackathon has finished, but submissions may still be open. Send your project through the official form."
      : "Finished building? Send your project through the official form before the deadline.";

  const buttonLabel = useInApp
    ? submissionState.open
      ? "Submit Project"
      : "View Submission"
    : "Submit Project";

  return (
    <section className="flex flex-col items-start gap-4 rounded-2xl border border-border bg-card px-5 py-6 sm:px-6 md:flex-row md:items-center md:justify-between md:px-8 md:py-7">
      <div className="flex min-w-0 items-start gap-3">
        <Send className="mt-0.5 size-6 shrink-0 text-header" />
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-xl font-bold text-foreground md:text-2xl">
            Submit your project
          </h2>
          <p className="break-words text-muted-foreground">{copy}</p>
        </div>
      </div>

      {/* `min-h-[2.75rem]` (44px) is the touch-target floor, matching the other
          panels; `md:min-h-0` hands the height back to the padding once there is a
          mouse. `shrink-0` stops the sentence beside it from squeezing the
          label. */}
      {useInApp ? (
        <Link
          href={`/event/${eventId}/submit`}
          className="inline-flex min-h-[2.75rem] w-full shrink-0 items-center justify-center gap-2 break-words rounded-lg bg-header px-6 py-3 text-center font-bold text-white transition-colors hover:bg-header-hover md:min-h-0 md:w-auto"
        >
          {buttonLabel}
        </Link>
      ) : (
        <a
          href={safeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-[2.75rem] w-full shrink-0 items-center justify-center gap-2 break-words rounded-lg bg-header px-6 py-3 text-center font-bold text-white transition-colors hover:bg-header-hover md:min-h-0 md:w-auto"
        >
          {buttonLabel}
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      )}
    </section>
  );
}
