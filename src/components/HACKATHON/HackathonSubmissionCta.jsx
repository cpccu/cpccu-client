"use client";

import { Send } from "lucide-react";
import { toSafeHref } from "@/lib/hackathon";
import { useHackathonPhase } from "@/hooks/use-hackathon-phase";

/**
 * Project-submission call-to-action. Renders below the problem set.
 *
 * Props:
 *   phase        — the SERVER's phase, used only as the pre-mount seed
 *   startAt      — UTC ISO string of the start instant
 *   endAt        — UTC ISO string of the end instant
 *   submissionUrl — admin-supplied Google Form target, already filtered by
 *                   `toPublicHackathon`
 *
 * WHERE THE SUBMISSION FORM LIVES
 * -------------------------------
 * The target is an admin-supplied external link — typically a Google Form —
 * exactly like the registration CTA above it. Nothing about a submission is
 * stored here: the form is the system of record, and the organisers read its
 * responses. This component therefore only decides whether to OFFER the
 * affordance, and re-validates the URL on arrival.
 *
 * ⚠️ WHY THIS IS NOT GATED, WHILE `HackathonProblemSet` IS. The problem set is
 * the competition itself; releasing it early would leak the questions to teams
 * that have not started. A submission form is the opposite: it is the route by
 * which a team hands its work in, and a team that cannot find it simply cannot
 * take part. The server serves this URL anonymously on purpose, and the form's
 * own "accepting responses" setting is what actually stops a late submission —
 * which is also why an admin can leave this published after `endAt` without
 * risk.
 *
 * ⚠️ WHY THE PHASE COMES FROM `useHackathonPhase`, NOT THE RAW PROP. Same
 * reason as the registration CTA and the countdown: the server resolves phase
 * once, at request time, so a tab left open across `startAt` would otherwise
 * keep saying "nothing to submit yet" (or keep offering to submit) long after
 * the truth changed. Nothing invalidates the `PublicContent: 'hackathon'` tag
 * on a timer, so a refetch will not save it. One clock, one verdict.
 *
 * VISIBILITY: shown from kickoff onwards — `live` AND `ended`.
 *
 * The `ended` case is deliberate and is the part worth arguing about. Deriving
 * visibility from `endAt` alone would hide the form the moment the clock runs
 * out, but a hackathon's submission window almost never ends at the closing
 * ceremony: teams get a day or two to finish, and an admin who has published
 * the form is saying "this is still open". Since the form is itself the gate
 * for whether a response is accepted, the page's only job is to stop showing it
 * BEFORE there is anything to submit.
 *
 * If the club later wants a hard cutoff that the form cannot express, the
 * server already has one: `submissionEnabled` + `submissionDeadline` on the
 * `Event` schema, resolved by `resolveEventParticipationWindow` in
 * `cpccu-server/src/utils/participationWindow.js`. That is a deliberate,
 * admin-controlled switch independent of the event dates. It is NOT wired here
 * because it belongs to the in-app participation feature (teams, an
 * `EventSubmission` collection) and this form is an external Google Form — but
 * that is the seam to cut if the two ever need to be unified.
 *
 * OUTBOUND LINK RULE: plain anchor with `rel="noopener noreferrer"`, never
 * `next/link` — see the block comment at the top of `src/lib/hackathon.js`.
 */
export default function HackathonSubmissionCta({
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

  // Nothing to submit before the hackathon has begun. `unannounced` has no
  // trustworthy window, so it is treated as "not yet" rather than guessing.
  if (activePhase !== "live" && activePhase !== "ended") {
    return null;
  }

  // Re-checked on arrival even though `toPublicHackathon` already filtered it,
  // so a caller that hands this component an unmapped value cannot get a raw
  // `javascript:` string into an `href`.
  const safeUrl = toSafeHref(submissionUrl);

  // A button with no href is a dead control.
  if (!safeUrl) {
    return null;
  }

  const isEnded = activePhase === "ended";

  return (
    <section className="flex flex-col items-start gap-4 rounded-2xl border border-border bg-card px-5 py-6 sm:px-6 md:flex-row md:items-center md:justify-between md:px-8 md:py-7">
      <div className="flex min-w-0 items-start gap-3">
        <Send className="mt-0.5 size-6 shrink-0 text-header" />
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-xl font-bold text-foreground md:text-2xl">
            Submit your project
          </h2>
          <p className="break-words text-muted-foreground">
            {isEnded
              ? "The hackathon has finished, but submissions may still be open. Send your project through the official form."
              : "Finished building? Send your project through the official form before the deadline."}
          </p>
        </div>
      </div>
      <a
        href={safeUrl}
        target="_blank"
        rel="noopener noreferrer"
        /* `max-w-full` + `break-words`: the label is fixed rather than
           admin-supplied, but it still must not push past the card's padding on
           a 320px screen. `min-h-[2.75rem]` (44px) is the touch-target floor,
           matching the other panels; `md:min-h-0` hands the height back to the
           padding once there is a mouse. `shrink-0` stops the sentence beside it
           from squeezing the label. */
        className="inline-flex min-h-[2.75rem] w-full shrink-0 items-center justify-center gap-2 break-words rounded-lg bg-header px-6 py-3 text-center font-bold text-white transition-colors hover:bg-header-hover md:min-h-0 md:w-auto"
      >
        Submit Project
        <span className="sr-only">(opens in a new tab)</span>
      </a>
    </section>
  );
}
