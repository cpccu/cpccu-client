"use client";

import { Activity, AlertTriangle, CalendarDays, MapPin, Radio, UserRound } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import HackathonCountdown from "@/components/HACKATHON/HackathonCountdown";
import HackathonRuleBook from "@/components/HACKATHON/HackathonRuleBook";
import HackathonProblemSet from "@/components/HACKATHON/HackathonProblemSet";
import HackathonRegistrationCta from "@/components/HACKATHON/HackathonRegistrationCta";
import HackathonSubmissionCta from "@/components/HACKATHON/HackathonSubmissionCta";
import { useGetPublicHackathonQuery } from "@/features/content/contentApi";
import { toPublicHackathon } from "@/lib/public-content";
import { DHAKA_TIME_ZONE_LABEL, formatDhakaDateTime } from "@/lib/dhaka-time";

/**
 * Public hackathon page.
 *
 * A SINGLETON resource, so `chooseLiveItems` is not used (see the note on
 * `toPublicHackathon`). Loading, error and empty are three explicit branches,
 * following `src/components/Layout/JobPipeline.jsx:60-81`.
 *
 * ⚠️ SCOPING — WHY THERE IS NO ROUTE GUARD ON `/hackathon`
 * A bookmarked `/hackathon` still renders the page shell with an "unavailable"
 * message when the admin toggle is off, because this is a static App Router
 * route with no per-page server middleware and the 404 comes from the API, not
 * from a redirect. That is ACCEPTABLE, and deliberately so: there is nothing on
 * this page to protect. The only sensitive artefact — the problem set URL — is
 * gated server-side by `verifyToken` AND the start time, and is fetched from a
 * separate endpoint that this page never embeds. The toggle governs navigation
 * and content, not a secret. Adding a route guard here would be security
 * theatre: it would hide an empty page while the actual gate stays where it
 * belongs, on the endpoint.
 *
 * The page therefore always renders SOMETHING: it degrades to a message, never
 * to a blank screen and never throws.
 */

const UNAVAILABLE_COPY = "Hackathon is not currently available.";

/**
 * Human label for each phase, plus the icon that goes with it.
 *
 * ⚠️ WHY THIS IS DERIVED FROM `phase` AND NOT FROM THE EVENT'S `status` FIELD.
 * `status` is a free-text admin field on the Event document. It is chosen by
 * hand, it is never reconciled with the clock, and nothing forces an admin to
 * update it when the hackathon ends — so it can permanently disagree with the
 * countdown two tiles above it (mark a finished hackathon "ongoing" and the
 * page says so forever). `phase`, by contrast, is derived by the server from
 * `date`/`endDate` and is the same value the countdown consumes, so a status
 * tile built from it cannot contradict the timer. That is the whole reason
 * the public payload no longer carries `status` at all: the one field that
 * could lie is the one the backend dropped.
 *
 * The Icon per row matters for the same reason — a `CalendarDays` glyph on a
 * lifecycle tile reads as "a date is shown here" and there is no date.
 */
const PHASE_TILES = {
  upcoming: { label: "Upcoming", Icon: CalendarDays },
  live: { label: "Live now", Icon: Radio },
  ended: { label: "Ended", Icon: Activity },
  unannounced: { label: "To be announced", Icon: AlertTriangle },
};

export default function Hackathon() {
  const { data, isLoading, isError, error } = useGetPublicHackathonQuery();

  if (isLoading) {
    return (
      <div className="flex grow min-h-[50svh] flex-col gap-8 px-4 py-12 sm:px-6 md:px-10">
        {/* Matches the hero's stacked shape on phones — a 288px-tall placeholder
            is a third of a small screen. */}
        <Skeleton className="h-48 w-full rounded-3xl sm:h-72" />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-4/5" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </div>
    );
  }

  // 404 and any transport failure land here. The server's own 404 message is
  // "Hackathon is not currently available.", which is exactly the copy the nav
  // entry's absence implies, so it is preferred over a hard-coded string.
  if (isError || !data?.data) {
    return (
      <div className="flex grow min-h-[50svh] flex-col items-center justify-center gap-6 px-4 py-24 sm:px-6">
        <div className="flex size-20 items-center justify-center rounded-full bg-red-50">
          <AlertTriangle className="size-10 text-red-500" />
        </div>
        <div className="space-y-2 text-center">
          <h2 className="text-2xl font-bold text-gray-900">{UNAVAILABLE_COPY}</h2>
          <p className="mx-auto max-w-md text-gray-500">
            {error?.data?.message ||
              "There is no live hackathon to show right now. Please check back later."}
          </p>
        </div>
      </div>
    );
  }

  const hackathon = toPublicHackathon(data.data);

  const details = [
    { label: "Venue", value: hackathon.venue, Icon: MapPin },
    { label: "Organiser", value: hackathon.organizer, Icon: UserRound },
    { label: "Starts", value: formatDhakaDateTime(hackathon.startAt), Icon: CalendarDays },
    { label: "Ends", value: formatDhakaDateTime(hackathon.endAt), Icon: CalendarDays },
    // Phase-derived, not `status`-derived — see `PHASE_TILES`. The `unannounced`
    // fallback covers a phase string this build does not know about; it is a
    // non-empty string, so `.filter(item => item.value)` below does not drop
    // the tile (which is why the old `"—"` default had to go: it was truthy and
    // rendered a permanently meaningless "Status —").
    {
      label: "Status",
      value: PHASE_TILES[hackathon.phase]?.label || PHASE_TILES.unannounced.label,
      Icon: PHASE_TILES[hackathon.phase]?.Icon || PHASE_TILES.unannounced.Icon,
    },
  ].filter((item) => item.value);

  return (
    <div className="flex grow min-h-[50svh] flex-col px-4 py-8 sm:px-6 sm:py-10 md:px-10 md:py-14">
      <div className="mx-auto flex w-full max-w-[100rem] flex-col gap-10">
        {/* Hero — STACKED BELOW `lg`, SIDE BY SIDE ABOVE IT.
            ⚠️ WHY `lg` AND NOT `md`: the content column is roughly 55% of the
            viewport, so at `md` (768px) it is ~303px and the countdown tiles
            (260px) plus a `text-3xl` title have no room to breathe. `lg` (976px)
            is also the exact width NavBar collapses at, so the hero and the nav
            change shape together. */}
        <section className="flex flex-col gap-6 lg:flex-row lg:gap-10">
          {hackathon.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={hackathon.image}
              alt={hackathon.title}
              /* ⚠️ NO PERCENTAGE HEIGHT HERE. The old `h-[50%]` resolved against
                 a flex container whose height is `auto`, so it computed to
                 `auto` and `object-cover` never got a box to crop into — the
                 banner rendered at its own aspect ratio and the hero height
                 changed with every image an admin uploaded. `aspect-[16/9]` gives
                 the stacked layout a deterministic box; at `lg` the aspect is
                 dropped so the flex row's `stretch` (the default) plus
                 `object-cover` does the cropping, matching the house pattern in
                 `HOME/OurMission.jsx`. `shrink-0` stops a long description from
                 squeezing the banner. */
              className="aspect-[16/9] w-full shrink-0 rounded-3xl object-cover lg:aspect-auto lg:w-[45%]"
            />
          ) : null}
          {/* `min-w-0` is the horizontal-overflow guard: a flex item defaults to
              `min-width: auto`, so a bare URL in an admin-written description
              would otherwise push the whole page into a sideways scroll. */}
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <div className="flex flex-col gap-4">
              {/* `break-words` — titles are free text and can contain a single
                  very long token (a hashtag, a sponsor name). */}
              <h1 className="break-words text-3xl font-bold text-foreground md:text-4xl lg:text-5xl">
                {hackathon.title}
              </h1>
              {hackathon.description ? (
                <p className="max-w-3xl text-base text-muted-foreground sm:text-lg">
                  {hackathon.description}
                </p>
              ) : null}
            </div>
            <div className="flex flex-col gap-4">
              {/* The start/end instants are threaded through to EVERY panel below,
              not just the countdown. Each panel re-derives its own phase from
              them via `useHackathonPhase`, so a tab left open across
              `startAt` / `endAt` updates the countdown, the CTA and the
              problem set together. Passing only `phase` to the panels is what
              previously let this page contradict itself the moment it went
              live — see `src/hooks/use-hackathon-phase.js`. */}
              <HackathonCountdown
                phase={hackathon.phase}
                startAt={hackathon.startAt}
                endAt={hackathon.endAt}
              />
              {/* Every rendered timestamp is explicit about its zone. The server
              sends UTC ISO strings and the page renders them in Dhaka time, so
              a visitor in another timezone would otherwise have to guess which
              wall-clock they are looking at. */}
              <p className="text-sm text-muted-foreground">
                All times shown in {DHAKA_TIME_ZONE_LABEL}.
              </p>
            </div>
          </div>
        </section>

        {/* Details grid — FULL WIDTH, DELIBERATELY OUTSIDE THE HERO COLUMN.
            ⚠️ Tailwind's `lg:` measures the VIEWPORT, not the parent. While this
            grid lived inside the hero's 45%-width text column, `lg:grid-cols-4`
            at a 976px viewport still asked for four tiles inside a ~417px
            column — ~95px each, and after `px-5` plus the border a 57px text
            box, which shredded any real venue name. Hoisting it out makes the
            breakpoint mean what it says, and five facts read better as a
            full-width strip than crammed into one column. Container queries
            (`@container` + `@xl:grid-cols-4`) would measure the column
            correctly, but that would be the only container query in the
            codebase, so the simpler layout wins. */}
        {details.length ? (
          <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {details.map(({ label, value, Icon }) => (
              <div
                key={label}
                className="flex h-full flex-col gap-2 rounded-2xl border border-border bg-card px-5 py-4"
              >
                <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <Icon className="size-3.5 shrink-0" />
                  {label}
                </span>
                {/* `break-words` — venue and organiser are free-text admin
                    fields, and one long unbroken string would otherwise force a
                    horizontal scroll on a phone. `h-full` on the tile above
                    keeps every tile in a grid row the same height. */}
                <span className="break-words text-base font-semibold text-foreground">
                  {value}
                </span>
              </div>
            ))}
          </section>
        ) : null}



        {/* Registration — upcoming only, see HackathonRegistrationCta.
            ⚠️ `eventId` IS PASSED THROUGH BECAUSE THE IN-APP FLOW NEEDS IT. The
            hackathon is an ordinary `Event` document, so its participation window
            lives at `/participation/events/<that _id>` and its in-app registration
            and submission pages live at `/event/<that _id>/register` and
            `/submit`. Without this prop both CTAs would be permanently stuck on
            their external-form branch and the admin's `submissionEnabled` toggle
            would have no effect anywhere on this page — a switch that looks live in
            the admin panel and does nothing. */}
        <HackathonRegistrationCta
          eventId={hackathon.id}
          phase={hackathon.phase}
          startAt={hackathon.startAt}
          endAt={hackathon.endAt}
          registrationUrl={hackathon.registrationUrl}
          ctaLabel={hackathon.ctaLabel}
        />

        <HackathonRuleBook
          ruleBookUrl={hackathon.ruleBookUrl}
          title={hackathon.title}
        />

        <HackathonProblemSet
          phase={hackathon.phase}
          startAt={hackathon.startAt}
          endAt={hackathon.endAt}
          problemSetAvailable={hackathon.problemSetAvailable}
        />

        {/* Submission — live AND ended, see HackathonSubmissionCta. Sits below
            the problem set on purpose: a team reads the questions, builds, and
            then submits, so the action follows the thing it acts on. It renders
            nothing when no form is configured, so an unconfigured hackathon
            pays no layout cost here. */}
        <HackathonSubmissionCta
          eventId={hackathon.id}
          phase={hackathon.phase}
          startAt={hackathon.startAt}
          endAt={hackathon.endAt}
          submissionUrl={hackathon.submissionUrl}
        />
      </div>
    </div>
  );
}
