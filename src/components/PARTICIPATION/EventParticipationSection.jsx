"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useSelector } from "react-redux";
import {
  AlertTriangle,
  CalendarDays,
  MapPin,
  Send,
  UploadCloud,
  UserRound,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import ParticipationSignInPrompt from "@/components/PARTICIPATION/ParticipationSignInPrompt";
import {
  useGetEventParticipationWindowQuery,
  useGetMyRegistrationsQuery,
} from "@/features/participation/participationApi";
import {
  ACTION_STATES,
  findActiveRegistration,
  resolveRegistrationTarget,
  resolveWindowAction,
} from "@/lib/participation";
import { describeParticipationWindow } from "@/lib/event-schedule";
import { DHAKA_TIME_ZONE_LABEL } from "@/lib/dhaka-time";

/**
 * THE PART OF THE EVENT DETAIL PAGE THAT IS ABOUT PARTICIPATION.
 *
 * This is the component that turns an event listing into an event you can enter.
 * It renders one of four things, and deciding which is the whole job:
 *
 *   1. the event's schedule, plus the call to action appropriate to its state
 *   2. a sign-in prompt, when there is something to do and nobody is signed in
 *   3. "you are registered" with a link to submit, when a live registration exists
 *   4. nothing at all, when the admin has not switched participation on
 *
 * ⚠️ WHY THE REGISTRATION FORM IS NOT RENDERED HERE.
 * The form lives at `/event/[eventId]/register`, not inline. Three reasons, and
 * the third is the one that decided it:
 *
 *   * a form that lives inside a scrolling detail page loses its scroll position
 *     and its typed values on every validation error;
 *   * a member who registered and then shared the link would land on a form that
 *     409s, rather than on the page that tells them they are already in;
 *   * and — the decisive one — `/event/[eventId]/register` is BOOKMARKABLE. A
 *     captain can send it to their team in chat, and the people who open it see
 *     the form. An inline form on a detail page cannot be shared.
 *
 * ⚠️ THE REGISTER / SUBMIT SPLIT IS NOT SYMMETRIC, AND THE ASYMMETRY IS THE API'S.
 * Submission is addressed by REGISTRATION id, not by event id
 * (`/participation/registrations/:registrationId/submission`), because a
 * registration is what a submission belongs to. So the submit route cannot be
 * built from the event id alone — it has to resolve "my registration for this
 * event" first, which is exactly what `useGetMyRegistrationsQuery` does here.
 *
 * ⚠️ BOTH PRIVATE QUERIES ARE SKIPPED, NOT GUARDED. `skip` rather than an early
 * return, for the reason `HackathonProblemSet` documents: the decision is derived
 * only from the store and the id, never from render order, so a re-render cannot
 * re-fire a request. An anonymous visitor must not spend the per-IP participation
 * budget, and must not receive a 401 that would be rendered as an error on a
 * public page.
 */
export default function EventParticipationSection({ eventId, event }) {
  const user = useSelector((state) => state.auth.user);
  const hydrated = useSelector((state) => state.auth.hydrated);

  // ⚠️ THE WINDOW IS ITS OWN ENDPOINT, AND THIS COMPONENT FETCHES IT ITSELF
  // rather than receiving it as a prop. Two reasons, and the second is the one
  // that settles it:
  //
  //   * the server's detail projection deliberately EXCLUDES the six participation
  //     fields, so the event payload cannot carry them — see
  //     `PUBLIC_EVENT_DETAIL_PROJECTION` and the note in `toPublicEventDetail`.
  //     Re-emitting them there would give the client two sources for one fact;
  //   * the window is RESOLVED state (`open`, not just `enabled`), and it changes
  //     on a schedule rather than on an admin save. Fetching it separately means
  //     the detail page and the window agree without the page having to know the
  //     resolution rules at all.
  const {
    data: windowResponse,
    isLoading: isWindowLoading,
    isError: isWindowError,
  } = useGetEventParticipationWindowQuery(eventId, { skip: !eventId });

  const { data, isFetching } = useGetMyRegistrationsQuery(eventId, {
    // Not fetched for a signed-out visitor at all. The route argument is also
    // passed through as the server-side `?eventId=` filter, but that filter is
    // unvalidated server-side, so `findActiveRegistration` re-filters locally —
    // a malformed id is silently ignored there, and a client that trusted that
    // would show the wrong team's registration.
    skip: !hydrated || !user || !eventId,
  });

  const registration = useMemo(
    () => findActiveRegistration(data?.data, eventId),
    [data, eventId]
  );

  const window = windowResponse?.data;

  // ⚠️ A WINDOW 404 DOES **NOT** RETURN `null`, AND THIS IS THE ONE PLACE THE
  // OBVIOUS EARLY RETURN IS WRONG.
  //
  // A 404 from the window endpoint means "this event has never had participation
  // configured" — which is precisely the state in which the admin's EXTERNAL
  // registration link is the live path. Returning null here would drop the section
  // entirely and, with it, the only Register affordance on the page: the event card
  // links to `/event/<id>`, the detail mapper exposes `registrationUrl`, and if
  // this component bails out then nothing on the detail page renders it. An event
  // that has had a Google Form for a year and no in-app participation would gain a
  // detail page with no way to register at all.
  //
  // So a 404 falls through with `window` as `undefined`, which makes
  // `resolveRegistrationTarget` take its external branch. That is the correct
  // answer for this state, reached by the same rule that handles every other one.
  //
  // What it does NOT do is surface the error. Nothing failed — the event loaded
  // fine, and the window simply has nothing to say about it.

  // ⚠️ NOTHING TO SHOW IS A NORMAL, EXPECTED STATE, NOT AN ERROR.
  //
  // The overwhelming majority of events on this site will never have
  // participation switched on — the six fields default to `false` and an admin has
  // to turn them on deliberately. A panel reading "registration is closed" on
  // every one of them would be noise the organiser cannot switch off. So when
  // neither window is enabled AND there is no external link to fall back to, this
  // component returns `null` and the page is simply an event page.
  //
  // ⚠️ `isWindowError` IS DELIBERATELY NOT READ. A 404 is the documented
  // fall-through case above, and a 500 is not worth an error panel on a public
  // page either — the section degrades to the external link or to nothing, and in
  // both cases the event page itself is intact. Distinguishing the two statuses
  // here would change what a member sees in a way that helps nobody.
  const registrationState = resolveWindowAction(window, 'registration');
  const submissionState = resolveWindowAction(window, 'submission');
  const registrationWindow = describeParticipationWindow(registrationState);
  const submissionWindow = describeParticipationWindow(submissionState);

  const participationEnabled =
    registrationState.enabled || submissionState.enabled;
  const hasExternalRegistration = Boolean(event.registrationUrl);

  if (!participationEnabled && !hasExternalRegistration) {
    return null;
  }

  if (isWindowLoading) {
    return (
      <section className="flex flex-col gap-6">
        <Skeleton className="h-8 w-1/3" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-20 w-full rounded-2xl" />
        </div>
        <Skeleton className="h-32 w-full rounded-2xl" />
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-6">
      <h2 className="text-2xl font-bold text-foreground md:text-3xl">
        Taking part
      </h2>

      {/* ── The schedule ────────────────────────────────────────────────────
          Rendered above the call to action because a member deciding whether to
          register needs the dates before the form, not after it.

          ⚠️ ONE TILE PER BOUND, AND ONLY FOR A WINDOW THAT IS CONFIGURED. The
          event's OWN start and end are deliberately NOT repeated here —
          `EventDetail`'s hero already renders the range, and two tiles saying
          "Starts 24 Oct" and "24 Oct 2026, 09:30" is the duplication that made
          this section unreadable before. What is NOT duplicated anywhere is the
          participation schedule: registration and submission open and close at
          different instants, and a member needs both before deciding.

          A window with no bound on one side renders only the other tile. "No
          cutoff" is a real configuration — the server treats an absent bound as
          "open until an admin turns it off" — and inventing a placeholder row
          for it would tell the member something the organisers did not. */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {registrationWindow.enabled && registrationWindow.opensCopy ? (
          <FactTile
            Icon={CalendarDays}
            label="Registration opens"
            value={registrationWindow.opensCopy}
          />
        ) : null}
        {registrationWindow.enabled && registrationWindow.closesCopy ? (
          <FactTile
            Icon={CalendarDays}
            label="Registration closes"
            value={registrationWindow.closesCopy}
          />
        ) : null}
        {submissionWindow.enabled && submissionWindow.opensCopy ? (
          <FactTile
            Icon={UploadCloud}
            label="Submissions open"
            value={submissionWindow.opensCopy}
          />
        ) : null}
        {submissionWindow.enabled && submissionWindow.closesCopy ? (
          <FactTile
            Icon={UploadCloud}
            label="Submissions close"
            value={submissionWindow.closesCopy}
          />
        ) : null}
        {event.location ? (
          <FactTile Icon={MapPin} label="Venue" value={event.location} />
        ) : null}
        {event.organizer ? (
          <FactTile Icon={UserRound} label="Organiser" value={event.organizer} />
        ) : null}
      </div>

      {event.location ||
      event.organizer ||
      registrationWindow.opensCopy ||
      registrationWindow.closesCopy ||
      submissionWindow.opensCopy ||
      submissionWindow.closesCopy ? (
        <p className="text-sm text-muted-foreground">
          All times shown in {DHAKA_TIME_ZONE_LABEL}.
        </p>
      ) : null}

      {/* ── Signed out ───────────────────────────────────────────────────────
          The prompt is rendered only when there is something to do. Signing in to
          an event with no open window is a wasted errand. */}
      {hydrated && !user ? (
        <ParticipationSignInPrompt
          title="Sign in to register"
          message={`Sign in with your CPCCU account to register for ${event.title} and submit your project.`}
        />
      ) : null}

      {/* ── Already registered ─────────────────────────────────────────────── */}
      {user && registration ? (
        <RegisteredPanel
          registration={registration}
          eventId={eventId}
          eventTitle={event.title}
          submissionState={submissionState}
          isFetching={isFetching}
        />
      ) : null}

      {/* ── Not registered yet ────────────────────────────────────────────── */}
      {/* ⚠️ `!registration` IS NOT THE SAME AS "SIGNED OUT". Both are handled, but
          they lead to different panels, and collapsing them into one condition is
          how a signed-out visitor ends up looking at a register button that 401s. */}
      {user && !registration ? (
        <RegistrationCallToAction
          eventId={eventId}
          window={window}
          registrationState={registrationState}
          registrationWindow={registrationWindow}
          externalUrl={event.registrationUrl}
        />
      ) : null}
    </section>
  );
}

/**
 * The "you are in" panel.
 *
 * ⚠️ `isFetching` IS RENDERED AS A SUBTLE HINT, NOT A SKELETON, because the panel
 * it replaces is the same panel. Replacing it with a skeleton on a background
 * refetch makes the page jump and hides information the member is reading.
 *
 * ⚠️ THE SUBMIT LINK IS SHOWN EVEN WHEN SUBMISSIONS ARE CLOSED, because the
 * member's own submission is still readable and they need somewhere to go to see
 * it. Hiding the link would strand someone whose deadline has passed — which is
 * precisely when they most want to confirm what they submitted.
 */
function RegisteredPanel({
  registration,
  eventId,
  eventTitle,
  submissionState,
  isFetching,
}) {
  const isTeam = registration.kind === 'team';
  const hasSubmission = Boolean(registration.submission);

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card px-5 py-6 sm:px-6 md:px-8">
      <div className="flex flex-col gap-1">
        <h3 className="text-xl font-bold text-foreground md:text-2xl">
          You are registered
        </h3>
        <p className="break-words text-muted-foreground">
          {isTeam
            ? `${registration.name} · ${registration.memberCount} participants`
            : 'Registered as an individual participant.'}
        </p>
        {/* The roster. Safe to render here because this row came from
            `GET /me/registrations`, which POPULATES members. The same fields are
            EMPTY STRINGS in the 201 create response and in the 200 withdraw
            response, which is the documented reason those bodies cannot be used to
            render a team. */}
        {isTeam ? (
          <ul className="mt-2 flex flex-wrap gap-2">
            {registration.members.map((member) => (
              <li
                key={member._id}
                className="rounded-full bg-responsibility px-3 py-1 text-sm text-foreground"
              >
                {member.fullName || member.uniID}
                {member.role === 'captain' ? (
                  <span className="ml-1 text-xs text-muted-foreground">
                    (captain)
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {isFetching ? (
        <p className="text-xs text-muted-foreground" role="status">
          Checking for updates…
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Link
          href={`/event/${eventId}/submit`}
          className="inline-flex min-h-[2.75rem] items-center justify-center gap-2 rounded-lg bg-header px-5 py-3 text-center text-sm font-bold text-white transition-colors hover:bg-header-hover md:min-h-0"
        >
          <Send className="size-4" aria-hidden="true" />
          {hasSubmission ? 'View your submission' : 'Submit your project'}
        </Link>

        /* ⚠️ THE EDIT LINK IS ONLY OFFERED TO THE OWNER. Reads of a registration
           are open to any member of the team, so a co-member sees "You are
           registered" above and would otherwise be offered an Edit button whose
           every action 404s. `isOwner` is emitted instead of `ownerId` precisely
           so the client can make this distinction without holding the raw id.

           It points at `/register`, which renders the ALREADY-REGISTERED panel —
           a summary plus a link onward — rather than a second mode of the create
           form. That is deliberate: a PATCH and a POST are different endpoints with
           incompatible `memberIds` semantics, and folding them into one form with a
           mode flag would hide the difference between "unchanged" and "empty". See
           the long note on `EventRegistrationRoute`. */
        {registration.isOwner ? (
          <Link
            href={`/event/${eventId}/register`}
            className="inline-flex min-h-[2.75rem] items-center justify-center gap-2 rounded-lg border border-header px-5 py-3 text-center text-sm font-bold text-header transition-colors hover:bg-header/10 md:min-h-0"
          >
            Manage team
          </Link>
        ) : null}
      </div>

      {submissionState.state === ACTION_STATES.CLOSED ? (
        <p className="text-sm text-muted-foreground">
          Submissions for {eventTitle} are closed. You can still review what you
          submitted.
        </p>
      ) : null}
    </div>
  );
}

/**
 * The register call to action.
 *
 * ⚠️ THIS IS WHERE THE "ADMIN PICKS PER EVENT" DECISION REACHES THE UI, and it is
 * a decision this component does NOT make. `resolveRegistrationTarget` in
 * `@/lib/participation.js` makes it, in one place, from the window plus the
 * event's external URL. Copying that branch here would produce a second rule that
 * can disagree with the first — and the disagreement would be invisible until an
 * event had both configured, which is exactly the case where it matters most.
 *
 * Two shapes, and the difference is which page the button goes to:
 *
 *   `in-app`   → `next/link` to `/event/[eventId]/register`. An INTERNAL route,
 *                so `next/link` is correct here (the EXTERNAL LINK RULE exempts
 *                internal routes).
 *   `external` → a PLAIN ANCHOR to the admin's Google Form, because that is an
 *                outbound admin-supplied target.
 *
 * And a third outcome that is not a button at all: when participation is enabled
 * but shut, the button still points in-app so the register page can explain WHY it
 * is shut. Redirecting to a Google Form instead would claim that registration
 * happens somewhere it demonstrably does not.
 */
function RegistrationCallToAction({
  eventId,
  window,
  registrationState,
  registrationWindow,
  externalUrl,
}) {
  // ⚠️ THE DECISION IS NOT MADE HERE. `resolveRegistrationTarget` in
  // `@/lib/participation.js` owns it, and it needs BOTH the window and the
  // external URL — which is exactly why this component receives the window as a
  // prop and does not recompute `enabled` itself. Copying the branch here would
  // produce a second rule that can disagree with the first, and the disagreement
  // would be invisible until an event had both configured, which is the one case
  // where it matters most.
  const target = useMemo(
    () => resolveRegistrationTarget({ window, externalUrl }),
    [window, externalUrl]
  );

  if (target.kind === 'external') {
    return (
      <div className="flex flex-col items-start gap-4 rounded-2xl bg-header px-5 py-6 text-white sm:px-6 md:flex-row md:items-center md:justify-between md:px-8">
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="text-xl font-bold md:text-2xl">Registrations are open</h3>
          <p className="break-words text-white/85">
            This event uses the club&apos;s own registration form.
          </p>
        </div>
        <a
          href={target.href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-[2.75rem] shrink-0 items-center justify-center gap-2 rounded-lg bg-white px-6 py-3 text-center font-bold text-header transition-transform hover:scale-[1.02] motion-reduce:transform-none motion-reduce:transition-none md:min-h-0"
        >
          Register now
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      </div>
    );
  }

  if (target.kind === 'in-app') {
    return (
      <div className="flex flex-col items-start gap-4 rounded-2xl bg-header px-5 py-6 text-white sm:px-6 md:flex-row md:items-center md:justify-between md:px-8">
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="text-xl font-bold md:text-2xl">
            {registrationState.open
              ? 'Registrations are open'
              : registrationState.state === ACTION_STATES.COMING_SOON
                ? 'Registration opens soon'
                : 'Registration is not open'}
          </h3>
          <p className="break-words text-white/85">
            {registrationState.open
              ? 'Register yourself, or add your teammates and enter as a team.'
              : registrationWindow?.unavailableCopy ??
                'The organisers have not opened registration yet.'}
          </p>
        </div>
        <Link
          href={`/event/${eventId}/register`}
          className="inline-flex min-h-[2.75rem] shrink-0 items-center justify-center gap-2 rounded-lg bg-white px-6 py-3 text-center font-bold text-header transition-transform hover:scale-[1.02] motion-reduce:transform-none motion-reduce:transition-none md:min-h-0"
        >
          Register now
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 items-start gap-3 rounded-2xl border border-border bg-card px-6 py-6">
      <AlertTriangle className="mt-0.5 size-6 shrink-0 text-header" aria-hidden="true" />
      <p className="break-words text-muted-foreground">
        Registration for this event is not available.
      </p>
    </div>
  );
}

/**
 * A labelled fact, skipped entirely when there is no value.
 *
 * ⚠️ `.filter(item => item.value)` WAS USED HERE ONCE AND IT WAS A BUG. The
 * status tile's fallback was the string `"—"`, which is TRUTHY, so the filter let
 * it through and rendered a permanently meaningless "Status —". The rule this
 * encodes is the corrected one: build the list conditionally and drop empties, so
 * a missing field produces no tile at all rather than a decorative one.
 */
function FactTile({ Icon, label, value }) {
  if (!value) return null;

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card px-5 py-4">
      <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Icon className="size-3.5 shrink-0" aria-hidden="true" />
        {label}
      </span>
      {/* `break-words`: venue and organiser are free-text admin fields and one
          long unbroken string would force a horizontal scroll on a phone. */}
      <span className="break-words text-base font-semibold text-foreground">
        {value}
      </span>
    </div>
  );
}
