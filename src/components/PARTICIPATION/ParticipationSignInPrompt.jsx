"use client";

import Link from "next/link";
import { Lock } from "lucide-react";

/**
 * "Sign in to continue" panel for the participation routes.
 *
 * ⚠️ THIS PROMPTS, IT DOES NOT REDIRECT, and the difference is deliberate.
 * `admin-layout.jsx` uses `router.replace('/login')` because an admin page has
 * nothing to show a signed-out visitor. That is the wrong pattern here: the event
 * detail page is PUBLIC, and a member who clicked "Register" from it did not ask
 * to leave. Bouncing them to `/login` and losing the event context means the
 * round trip ends on a page with no link back to the event they were registering
 * for, and the most likely outcome is that they do not come back.
 *
 * `HackathonProblemSet` already establishes this pattern on `/hackathon` — an
 * inline card with a `Sign in` link — and this component follows it so the two
 * surfaces behave identically. `next/link` is correct for `/login`: it is an
 * internal route, which is the one case the EXTERNAL LINK RULE in
 * `src/lib/hackathon.js` explicitly exempts.
 *
 * The `message` is a prop rather than a fixed string because the two routes need
 * different wording: signing in to REGISTER is a different act from signing in to
 * SUBMIT, and telling someone to sign in to "continue" without saying what they
 * will get is a wasted trip.
 */
export default function ParticipationSignInPrompt({
  title = "Sign in to continue",
  message = "Sign in with your CPCCU account to register for this event.",
}) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-2xl border border-border bg-card px-6 py-6 md:flex-row md:items-center md:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <Lock className="mt-0.5 size-6 shrink-0 text-header" aria-hidden="true" />
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-lg font-bold text-foreground">{title}</h2>
          {/* `break-words` — the event title is admin free text and is embedded in
              this sentence on the detail page, so one long unbroken token would
              otherwise push the row into a horizontal scroll on a phone. */}
          <p className="break-words text-muted-foreground">{message}</p>
        </div>
      </div>
      <Link
        href="/login"
        /* `min-h-[2.75rem]` (44px) is the touch-target floor — `px-4 py-2 text-sm`
           alone is ~36px. `md:min-h-0` hands the height back to the padding once
           there is a mouse. `shrink-0` stops the sentence beside it from squeezing
           the label on a narrow screen. */
        className="inline-flex min-h-[2.75rem] shrink-0 items-center justify-center gap-2 rounded-lg bg-header px-4 py-2 text-center text-sm font-bold text-white transition-colors hover:bg-header-hover md:min-h-0"
      >
        Sign in
      </Link>
    </div>
  );
}