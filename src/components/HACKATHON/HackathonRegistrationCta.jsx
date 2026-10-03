"use client";

import Link from "next/link";
import { toSafeHref } from "@/lib/hackathon";
import { useHackathonPhase } from "@/hooks/use-hackathon-phase";
import { useGetEventParticipationWindowQuery } from "@/features/participation/participationApi";
import { resolveWindowAction } from "@/lib/participation";

/**
 * Registration call-to-action.
 *
 * Props:
 *   eventId         — the hackathon's own Event `_id`, so the in-app page can be
 *                     addressed. Absent on older payloads, and every branch below
 *                     degrades to the external form without it.
 *   phase           — the SERVER's phase, used only as the pre-mount seed
 *   startAt         — UTC ISO string of the start instant
 *   endAt           — UTC ISO string of the end instant
 *   registrationUrl — admin-supplied external target, already filtered by
 *                     `toPublicHackathon`
 *   ctaLabel        — admin-supplied button text
 *
 * ⚠️ THE ADMIN PICKS PER EVENT, AND THE HACKATHON IS NOT AN EXCEPTION.
 *
 * This CTA previously sent every visitor to an admin-supplied Google Form, and it
 * still does — for a hackathon whose admin has NOT switched on the in-app flow.
 * The hackathon is an ordinary `Event` document carrying the same six
 * participation fields as every other event, and `resolveEventParticipationWindow`
 * reads them from any event object it is handed with no type check at all. That is
 * deliberate: it is what lets an admin change an event's `type` without stranding a
 * live registration.
 *
 * So the rule is the same one `resolveRegistrationTarget` applies everywhere, and
 * it is applied here rather than inlined:
 *
 *   `registrationEnabled === true`  → `/event/<id>/register`  (INTERNAL)
 *   otherwise, if a URL is configured → that URL                (EXTERNAL)
 *   otherwise                        → render nothing
 *
 * ⚠️ THE PHASE GATE BELOW STILL APPLIES TO BOTH BRANCHES, and it is unchanged:
 * the button is offered only while the hackathon is `upcoming`. The in-app window
 * has its own, independent `registrationCloseAt`, so an admin can close in-app
 * registration before the hackathon starts; this gate is the coarser of the two
 * and the registration page is the finer one. Both are shown, neither is inferred
 * from the other.
 *
 * ⚠️ THE WINDOW IS FETCHED ANONYMOUSLY, SO THIS COMPONENT COSTS ONE EXTRA REQUEST
 * PER LOAD of `/hackathon` — and it is the SAME cache entry the event detail page
 * and the registration route use. RTK Query deduplicates by key, so navigating
 * from `/hackathon` to `/event/<id>/register` does not re-fetch it.
 *
 * ⚠️ THE PHASE COMES FROM `useHackathonPhase`, THE SAME SOURCE AS THE
 * COUNTDOWN. Reading the raw server `phase` prop here meant a tab left open
 * across `startAt` kept rendering "Registrations are open" while the countdown
 * above it had already flipped to "Ends in" — and nothing invalidates the
 * `PublicContent: 'hackathon'` tag on a timer, so only a hard refresh fixed it.
 * One shared hook is what keeps the two surfaces from contradicting each other.
 * See `src/hooks/use-hackathon-phase.js`.
 *
 * OUTBOUND LINK RULE: the external branch is a plain anchor with
 * `rel="noopener noreferrer"`, never `next/link` — see the block comment at the top
 * of `src/lib/hackathon.js`. The in-app branch IS an internal route and correctly
 * uses `next/link`, which is that rule's documented exemption.
 */
export default function HackathonRegistrationCta({
  eventId,
  phase,
  startAt,
  endAt,
  registrationUrl,
  ctaLabel,
}) {
  const { phase: activePhase } = useHackathonPhase({
    startAt,
    endAt,
    serverPhase: phase,
  });

  const { data: windowResponse } = useGetEventParticipationWindowQuery(eventId, {
    // No id means an older payload, and the external form is the correct fallback
    // — asking for a window we have no key for would 404 on every load.
    skip: !eventId,
  });

  const registrationState = resolveWindowAction(
    windowResponse?.data,
    'registration'
  );

  if (activePhase !== 'upcoming') {
    return null;
  }

  // ⚠️ THE INTERNAL BRANCH IS CHECKED FIRST, AND THAT IS THE POINT. When an admin
  // has switched this hackathon onto the in-app flow, the external `registrationUrl`
  // is a leftover from before. Preferring it would mean the admin's most recent and
  // most deliberate action is the one that gets ignored — and a member would be
  // filling in a Google Form whose responses nobody reads.
  //
  // The button still renders while the in-app window is shut, pointing at the
  // in-app page, so the member is told WHY registration is unavailable instead of
  // being quietly redirected to a form that is not the system of record.
  const useInApp = registrationState.enabled && Boolean(eventId);

  const safeUrl = useInApp ? '' : toSafeHref(registrationUrl);

  // A button with no href is a dead control.
  if (!useInApp && !safeUrl) {
    return null;
  }

  return (
    /* `px-5` on the smallest screens: the card sits inside an already-narrow
       `px-4` page gutter, and 24px of padding on each side of a 320px screen
       left the label barely 230px to wrap into. */
    <section className="flex flex-col items-start gap-4 rounded-2xl bg-header px-5 py-6 text-white sm:px-6 sm:py-7 md:px-8">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-bold md:text-2xl">Registrations are open</h2>
        <p className="text-white/85">
          {useInApp
            ? registrationState.open
              ? 'Seats are limited. Register through this site — alone, or add your team.'
              : 'Registration is not open right now. Follow the link for the schedule and the deadline.'
            : 'Seats are limited. Register through the official form below.'}
        </p>
      </div>
      {useInApp ? (
        <Link
          href={`/event/${eventId}/register`}
          // `motion-reduce:` disables the hover scale for visitors who ask their
          // OS to reduce motion — a decorative zoom is exactly the kind of
          // incidental animation that setting exists to suppress.
          // `max-w-full` + `break-words`: `ctaLabel` is admin-supplied free text,
          // so a long label ("Register for the CPCCU Winter Hackathon 2026") had
          // no overflow guard and pushed past the card's padding on a phone.
          // `text-center` keeps a wrapped label centred rather than ragged-left.
          className="inline-flex max-w-full items-center justify-center gap-2 break-words rounded-lg bg-white px-6 py-3 text-center font-bold text-header transition-transform hover:scale-[1.02] motion-reduce:transform-none motion-reduce:transition-none"
        >
          {ctaLabel || "Register Now"}
        </Link>
      ) : (
        <a
          href={safeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex max-w-full items-center justify-center gap-2 break-words rounded-lg bg-white px-6 py-3 text-center font-bold text-header transition-transform hover:scale-[1.02] motion-reduce:transform-none motion-reduce:transition-none"
        >
          {ctaLabel || "Register Now"}
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      )}
    </section>
  );
}
