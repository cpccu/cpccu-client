"use client";

import { toSafeHref } from "@/lib/hackathon";
import { useHackathonPhase } from "@/hooks/use-hackathon-phase";

/**
 * Registration call-to-action.
 *
 * Props:
 *   phase           — the SERVER's phase, used only as the pre-mount seed
 *   startAt         — UTC ISO string of the start instant
 *   endAt           — UTC ISO string of the end instant
 *   registrationUrl — admin-supplied target, already filtered by
 *                     `toPublicHackathon`
 *   ctaLabel        — admin-supplied button text
 *
 * BUSINESS RULE: the CTA is shown ONLY while the hackathon is `upcoming`.
 * Registration closes when the event starts; leaving the button on a live or
 * ended hackathon would send visitors to a form the organisers are no longer
 * reading. This is a presentation rule only — nothing is enforced by hiding a
 * button, and the registration page is the organiser's own system.
 *
 * It also renders nothing when there is no usable target, because a button with
 * no href is a dead control.
 *
 * ⚠️ THE PHASE COMES FROM `useHackathonPhase`, THE SAME SOURCE AS THE
 * COUNTDOWN. Reading the raw server `phase` prop here meant a tab left open
 * across `startAt` kept rendering "Registrations are open" while the countdown
 * above it had already flipped to "Ends in" — and nothing invalidates the
 * `PublicContent: 'hackathon'` tag on a timer, so only a hard refresh fixed
 * it. One shared hook is what keeps the two surfaces from contradicting each
 * other. See `src/hooks/use-hackathon-phase.js`.
 *
 * OUTBOUND LINK RULE: plain anchor with `rel="noopener noreferrer"`, never
 * `next/link` — see the block comment at the top of `src/lib/hackathon.js`.
 */
export default function HackathonRegistrationCta({
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

  if (activePhase !== "upcoming") {
    return null;
  }

  const safeUrl = toSafeHref(registrationUrl);

  if (!safeUrl) {
    return null;
  }

  return (
    <section className="flex flex-col items-start gap-4 rounded-2xl bg-header px-6 py-7 text-white md:px-8">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-bold md:text-2xl">Registrations are open</h2>
        <p className="text-white/85">
          Seats are limited. Register through the official form below.
        </p>
      </div>
      <a
        href={safeUrl}
        target="_blank"
        rel="noopener noreferrer"
        // `motion-reduce:` disables the hover scale for visitors who ask their
        // OS to reduce motion — a decorative zoom is exactly the kind of
        // incidental animation that setting exists to suppress.
        className="inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 font-bold text-header transition-transform hover:scale-[1.02] motion-reduce:transform-none motion-reduce:transition-none"
      >
        {ctaLabel || "Register Now"}
        <span className="sr-only">(opens in a new tab)</span>
      </a>
    </section>
  );
}
