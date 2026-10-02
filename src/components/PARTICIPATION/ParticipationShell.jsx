"use client";

import Link from "next/link";
import { ChevronLeft } from "lucide-react";

/**
 * The chrome every participation route renders inside.
 *
 * ⚠️ IT IS A SHARED SHELL BECAUSE ALL THREE ROUTES MUST AGREE ON WHERE "BACK"
 * GOES. `/event/[id]`, `/event/[id]/register` and `/event/[id]/submit` are one
 * flow, and a member who lands on the submit page by pasting a link and then
 * navigates back must arrive at the event, not at the site's home page. Encoding
 * the breadcrumb once means the three pages cannot drift.
 *
 * ⚠️ `<Link>` NOT AN ANCHOR, AND NOT `next/link` FOR THE EXTERNAL CASE — there is
 * no external case here. This is an internal route, which is the one thing the
 * EXTERNAL LINK RULE in `src/lib/hackathon.js` explicitly exempts from the
 * plain-anchor requirement.
 */
export default function ParticipationShell({ eventId, title, subtitle, children }) {
  return (
    <div className="flex grow min-h-[50svh] flex-col px-4 py-8 sm:px-6 sm:py-10 md:px-10 md:py-14">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
        <Link
          href={`/event/${eventId}`}
          className="inline-flex min-h-[2.75rem] w-fit items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-header md:min-h-0"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          Back to the event
        </Link>

        <div className="flex flex-col gap-2">
          {/* `break-words`: the title is admin free text and these pages put it in
              a heading, where one long unbroken token would force a horizontal
              scroll on a phone. */}
          <h1 className="break-words text-3xl font-bold text-foreground md:text-4xl">
            {title}
          </h1>
          {subtitle ? (
            <p className="break-words text-base text-muted-foreground">
              {subtitle}
            </p>
          ) : null}
        </div>

        {/* The page body is a single card so a long form has a consistent,
            readable measure instead of running the full viewport width. */}
        <div className="rounded-3xl border border-border bg-card px-5 py-6 sm:px-8 sm:py-8">
          {children}
        </div>
      </div>
    </div>
  );
}
