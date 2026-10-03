"use client";

import { useMemo } from "react";
import Link from "next/link";
import { AlertTriangle, CalendarDays, ExternalLink, Info, MapPin, Send, UserRound } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetPublicEventQuery } from "@/features/content/contentApi";
import { toPublicEventDetail } from "@/lib/public-content";
import { useGetEventParticipationWindowQuery } from "@/features/participation/participationApi";
import { resolveSubmissionTarget, resolveWindowAction } from "@/lib/participation";
import {
  describeParticipationWindow,
  formatInstant,
  formatInstantRange,
} from "@/lib/event-schedule";
// `formatDhakaDateTime` is deliberately NOT imported here: every instant on this
// page now goes through `@/lib/event-schedule`, which is the single place that
// decides how a schedule instant is spoken (and what to say when it is unset).
// Re-introducing the raw formatter is how two sentences on one page end up using
// two different fallbacks for the same missing date.
import { DHAKA_TIME_ZONE_LABEL } from "@/lib/dhaka-time";
import EventParticipationSection from "@/components/PARTICIPATION/EventParticipationSection";
import EventWinnersGallery from "@/components/PARTICIPATION/EventWinnersGallery";

/**
 * The event detail page.
 *
 * Loads the event content (`GET /content/events/:eventId`) and the participation
 * window (`GET /participation/events/:eventId`) and renders both.
 *
 * ⚠️ IT ALWAYS RENDERS SOMETHING, AND THE "SOMETHING" IS NEVER A BLANK SCREEN.
 * That rule comes straight from `Layout/Hackathon.jsx` and is the reason the
 * loading and error branches below are explicit rather than delegated to a
 * `loading.tsx` / `error.tsx`. This codebase has neither, and adding them for one
 * page while its sibling hand-rolls three branches would make the two pages read
 * as different applications.
 *
 * ⚠️ A 404 IS AN HONEST ANSWER, NOT A FAILURE TO DISPLAY. The server 404s for an
 * unknown id, a malformed id, AND for a hackathon — the last of which is a real
 * possibility here, since nothing stops a member pasting a hackathon id into
 * `/event/…`. All three render the same "no such event" state, which is correct:
 * the member needs to know there is nothing here, not why.
 *
 * ⚠️ THE OUTBOUND LINKS ON THIS PAGE ARE PLAIN ANCHORS. Every URL rendered below
 * is admin-supplied and therefore admin-controlled, so the EXTERNAL LINK RULE in
 * `src/lib/hackathon.js` applies in full: `<a target="_blank"
 * rel="noopener noreferrer">`, never `next/link`. The one internal link — "Submit
 * your project" — correctly uses `next/link`, because internal routes are the
 * documented exemption.
 */
export default function EventDetail({ eventId }) {
  const {
    data,
    isLoading,
    isError,
  } = useGetPublicEventQuery(eventId, { skip: !eventId });

  // The window is fetched HERE as well as inside `EventParticipationSection`,
  // because this page needs it for the SUBMISSION call to action, which the
  // section does not render. Two calls to the same query on one page is not two
  // requests: RTK Query deduplicates by cache key, and both components use the
  // identical `eventId` argument, so they share one entry and one in-flight
  // request. Reaching for the window only in the section and then fetching it
  // again for the submission CTA would be the actual duplication.
  const { data: windowResponse } = useGetEventParticipationWindowQuery(eventId, {
    skip: !eventId,
  });

  const window = windowResponse?.data;

  const event = useMemo(
    () => (data?.data ? toPublicEventDetail(data.data) : null),
    [data]
  );

  // ⚠️ NO EXTERNAL FALLBACK FOR SUBMISSIONS ON THIS PAGE, and that is a fact
  // about the schema rather than an omission. `hackathonSubmissionUrl` is the only
  // dedicated submission-form field on `eventSchema`, it belongs to the hackathon,
  // and a hackathon 404s on this endpoint by design. A non-hackathon event has no
  // admin-authored submission URL at all — so `submissionEnabled` is the ONLY way
  // to offer submissions, and passing `''` here makes `resolveSubmissionTarget`
  // return `'none'` unless it is on. Inventing a fallback from `contestLink`
  // would be wrong: contest links are published in event emails to attendees and
  // point at registration or the contest itself, not at a place to hand in work.
  //
  // The external submission form still works — it lives on `/hackathon`, where
  // the field exists. See `HackathonSubmissionCta`.
  const submissionTarget = useMemo(
    () => resolveSubmissionTarget({ window, externalUrl: '' }),
    [window]
  );

  const submissionState = resolveWindowAction(window, 'submission');

  // ⚠️ THE "COMING SOON" SENTENCE NAMES THE OPENING INSTANT, AND IT HAS TO BE
  // BUILT FROM `opensAt` RATHER THAN THE CLOSING ONE. That was the bug: the state
  // is decided by when the window OPENS, and the first version of this page quoted
  // the closing instant under the words "open on", so a window that opens next week
  // announced that it opened the day it shut. `describeParticipationWindow` is the
  // shared place that knows which instant explains a state.
  const submissionWindow = describeParticipationWindow(submissionState);
  const submissionOpensCopy = submissionWindow.opensAt
    ? `Submissions open on ${formatInstant(submissionWindow.opensAt)}.`
    : null;

  // ⚠️ THE PARTICIPATION SECTION BELOW OWNS THE REGISTER CTA, AND THIS PAGE
  // ONLY OWNS THE SUBMISSION ONE. The Register button lives inside
  // `EventParticipationSection`, which owns the "am I signed in" and "do I already
  // hold a registration" questions that decide which of its three panels renders.
  // Computing a target here as well would give a member who is already registered
  // TWO Register buttons, one of which 409s — and it would be a second place
  // making a decision `resolveRegistrationTarget` already owns in one pure
  // function.
  //
  // This page still fetches the window, because `submissionState.open` is what
  // chooses between "Submit project" and "View submission", and getting that
  // wrong tells a member with a closed deadline that they can still submit.
  const participationEnabled =
    resolveWindowAction(window, 'registration').enabled ||
    resolveWindowAction(window, 'submission').enabled;

  if (isLoading) {
    return (
      <div className="flex grow min-h-[50svh] flex-col gap-8 px-4 py-12 sm:px-6 md:px-10">
        <Skeleton className="h-48 w-full rounded-3xl sm:h-64" />
        <Skeleton className="h-9 w-2/3" />
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-5 w-4/5" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }

  if (isError || !event) {
    return (
      <div className="flex grow min-h-[50svh] flex-col items-center justify-center gap-6 px-4 py-24 sm:px-6">
        <div className="flex size-20 items-center justify-center rounded-full bg-red-50">
          <AlertTriangle className="size-10 text-red-500" aria-hidden="true" />
        </div>
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold text-gray-900">
            This event is not available
          </h1>
          <p className="mx-auto max-w-md text-gray-500">
            The event may have been unpublished, or the link may be incorrect.
          </p>
        </div>
        <Link
          href="/event"
          className="inline-flex min-h-[2.75rem] items-center justify-center rounded-lg bg-header px-5 py-3 text-center text-sm font-bold text-white transition-colors hover:bg-header-hover md:min-h-0"
        >
          Browse all events
        </Link>
      </div>
    );
  }

  // The admin's other outbound links, deduplicated against each other so an event
  // that sets `contestLink` and `btnLink` to the same URL shows one row, not two.
  // Every one has already been through `toSafeHref` in the mapper; re-checking
  // here would be redundant, but the map's job is shaping data and this is the
  // render path, so the entries are filtered on truthiness only.
  const outboundLinks = [
    { label: event.btnText || 'Event link', href: event.btnLink },
    { label: event.btnText1 || 'Contest link', href: event.btnLink1 },
    { label: 'Contest link', href: event.contestUrl },
    { label: 'Meet link', href: event.meetUrl },
    { label: 'VJudge group', href: event.vjudgeUrl },
  ]
    .filter((link) => link.href)
    .filter(
      (link, index, all) =>
        all.findIndex((other) => other.href === link.href) === index
    );

  return (
    <article className="flex grow min-h-[50svh] flex-col px-4 py-8 sm:px-6 sm:py-10 md:px-10 md:py-14">
      <div className="mx-auto flex w-full max-w-[80rem] flex-col gap-10">
        <nav className="text-sm">
          <Link
            href="/event"
            className="font-medium text-muted-foreground transition-colors hover:text-header"
          >
            ← All events
          </Link>
        </nav>

        {/* ── Hero ────────────────────────────────────────────────────────────
            ⚠️ STACKED BELOW `lg`, SIDE BY SIDE ABOVE IT — same reasoning as
            `Layout/Hackathon.jsx`: `lg` is 976px in this project, not Tailwind's
            1024, and it is also the exact width NavBar collapses at, so the hero
            and the nav change shape together. */}
        <header className="flex flex-col gap-6 lg:flex-row lg:gap-10">
          {event.img ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={event.img}
              alt=""
              /* ⚠️ `alt=""` DELIBERATELY. The image is decorative here: the
                 accessible name of this page is the `h1` immediately after it,
                 and repeating the title in an alt attribute makes a screen reader
                 announce it twice. */
              className="aspect-[16/9] w-full shrink-0 rounded-3xl object-cover lg:aspect-auto lg:w-[45%]"
            />
          ) : null}

          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <h1 className="break-words text-3xl font-bold text-foreground md:text-4xl lg:text-5xl">
              {event.headline}
            </h1>

            {event.summary ? (
              <p className="max-w-3xl text-base text-muted-foreground sm:text-lg">
                {event.summary}
              </p>
            ) : null}

            <div className="flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">
                All times shown in {DHAKA_TIME_ZONE_LABEL}.
              </p>
              {event.startAt || event.endAt ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CalendarDays className="size-4 shrink-0" aria-hidden="true" />
                  {/* ⚠️ THE SCHEDULE IS RENDERED HERE AND NOWHERE ELSE ON THE PAGE.
                      `EventParticipationSection` used to repeat Starts / Ends /
                      Venue / Organiser and its own timezone line directly below, so
                      the same instant appeared twice in one viewport with two
                      different timezones claims. The hero is the one place for the
                      event's own facts; the section below is for the two participation
                      windows, which the hero knows nothing about. */}
                  {formatInstantRange(event.startAt, event.endAt)}
                </p>
              ) : null}
              {event.location ? (
                <p className="flex items-start gap-2 break-words text-sm text-muted-foreground">
                  <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  {event.location}
                </p>
              ) : null}
              {event.organizer ? (
                <p className="flex items-start gap-2 break-words text-sm text-muted-foreground">
                  <UserRound className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  {event.organizer}
                </p>
              ) : null}
            </div>
          </div>
        </header>

        {/* ── Detail lines ────────────────────────────────────────────────────
            `event.details` is the four admin free-text slots, already filtered
            of empties in the mapper. Dropping empties THERE rather than here is
            what stops a permanently meaningless "—" bullet, which is the bug the
            `.filter(item => item.value)` comment in the hackathon page records. */}
        {event.details.length ? (
          <section className="flex flex-col gap-2">
            <h2 className="text-xl font-bold text-foreground md:text-2xl">
              {event.headlineTertiary || 'Event details'}
            </h2>
            <ul className="flex flex-col gap-2">
              {event.details.map((line, index) => (
                <li
                  // ⚠️ INDEX KEY. These lines have no stable id — they are four
                  // positional strings with no identity — and the list is static
                    // and never reordered or filtered, so index is correct here.
                  key={`${index}-${line.slice(0, 16)}`}
                  className="break-words text-base text-muted-foreground"
                >
                  <span className="mr-2 text-header" aria-hidden="true">
                    🔶
                  </span>
                  {line}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* ── Reward ───────────────────────────────────────────────────────── */}
        {event.reward ? (
          <section className="flex flex-col gap-2">
            <h2 className="text-xl font-bold text-foreground md:text-2xl">
              {event.headlineSecondary || 'Reward'}
            </h2>
            <p className="break-words text-base text-muted-foreground">
              {event.reward}
            </p>
          </section>
        ) : null}

        {/* ── The participation section ─────────────────────────────────────
            Renders nothing at all when the event has neither in-app
            participation nor an external registration form, which is the
            majority of events. See its docstring for why that is a normal state
            rather than an error. */}
        <EventParticipationSection eventId={eventId} event={event} />

        {/* ── The submission call to action ──────────────────────────────────
            ⚠️ DELIBERATELY OUTSIDE `EventParticipationSection`, because that
            section is about REGISTRATION and this is about submissions. Putting
            them together would mean a member who has already registered — and
            whose panel therefore replaces the register button — loses the
            submission affordance entirely, which is the one thing they still
            need. */}
        {submissionTarget.kind === 'in-app' ? (
          <section className="flex flex-col items-start gap-4 rounded-2xl border border-border bg-card px-5 py-6 sm:px-6 md:flex-row md:items-center md:justify-between md:px-8 md:py-7">
            <div className="flex min-w-0 items-start gap-3">
              <Send className="mt-0.5 size-6 shrink-0 text-header" aria-hidden="true" />
              <div className="flex min-w-0 flex-col gap-1">
                <h2 className="text-xl font-bold text-foreground md:text-2xl">
                  Submit your project
                </h2>
                {/* ⚠️ THE COPY DIFFERS BY WINDOW STATE, NOT BY SYMMETRY WITH THE
                    REGISTRATION CTA. The three sentences answer three different
                    questions: can I submit now, has it not opened yet, or is it too
                    late — in which case the link still goes somewhere useful, because
                    a member whose window has closed most wants to confirm what they
                    filed. The "coming soon" sentence names `opensAt`, never the
                    closing instant: the state is decided by when the window OPENS, so
                    the instant that explains it has to be that one. */}
                <p className="break-words text-muted-foreground">
                  {submissionState.open
                    ? 'Finished building? Submit your project through this site.'
                    : submissionState.state === 'coming-soon'
                      ? submissionOpensCopy ??
                        'Submissions have not opened yet.'
                      : 'Finished building? You can still review what you submitted.'}
                </p>
              </div>
            </div>

            {/* ⚠️ ALWAYS AN INTERNAL ROUTE HERE, SO ALWAYS `next/link`. The
                EXTERNAL LINK RULE in `src/lib/hackathon.js` applies to
                admin-supplied OUTBOUND targets; this is one of its documented
                exemptions, and there is no external branch to reach because the
                schema has no submission-form field on a non-hackathon event. */}
            <Link
              href={`/event/${eventId}/submit`}
              className="inline-flex min-h-[2.75rem] w-full shrink-0 items-center justify-center gap-2 rounded-lg bg-header px-6 py-3 text-center text-sm font-bold text-white transition-colors hover:bg-header-hover md:min-h-0 md:w-auto"
            >
              {submissionState.open ? 'Submit project' : 'View submission'}
            </Link>
          </section>
        ) : null}

        {/* ── The published shortlist ───────────────────────────────────────
            Gated on participation being switched on at all, so an event that has
            never used it never pays for a request that can only 404. See the
            `skip` note on the component. */}
        <EventWinnersGallery eventId={eventId} enabled={participationEnabled} />

        {/* ── Remaining admin links ───────────────────────────────────────── */}
        {outboundLinks.length ? (
          <section className="flex flex-col gap-3">
            <h2 className="text-xl font-bold text-foreground md:text-2xl">
              <span className="inline-flex items-center gap-2">
                <Info className="size-5 text-header" aria-hidden="true" />
                Links
              </span>
            </h2>
            <ul className="flex flex-col gap-2">
              {outboundLinks.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex max-w-full items-center gap-2 break-all font-medium text-header underline underline-offset-4 hover:text-header-hover"
                  >
                    {link.label}
                    <span className="sr-only">(opens in a new tab)</span>
                    <ExternalLink className="size-4 shrink-0" aria-hidden="true" />
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </article>
  );
}
