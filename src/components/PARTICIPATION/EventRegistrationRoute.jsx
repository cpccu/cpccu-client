"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useSelector } from "react-redux";
import { AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import ParticipationShell from "@/components/PARTICIPATION/ParticipationShell";
import ParticipationSignInPrompt from "@/components/PARTICIPATION/ParticipationSignInPrompt";
import EventRegistrationForm from "@/components/PARTICIPATION/EventRegistrationForm";
import {
  useGetEventParticipationWindowQuery,
  useGetMyRegistrationsQuery,
} from "@/features/participation/participationApi";
import { useGetPublicEventQuery } from "@/features/content/contentApi";
import { toPublicEventDetail } from "@/lib/public-content";
import { findActiveRegistration } from "@/lib/participation";

/**
 * `/event/[eventId]/register` — resolve the event, then hand off to the form.
 *
 * ⚠️ THIS COMPONENT'S REAL JOB IS TO ANSWER FOUR QUESTIONS IN ORDER, AND THE
 * ORDER IS THE DESIGN. Each question can end the page, and an earlier one must
 * never be skipped because a later one would also have been true:
 *
 *   1. does this event exist?            → not found
 *   2. is anyone signed in?              → sign-in prompt (NOT a redirect)
 *   3. does this member already hold a live registration? → a summary + Edit
 *   4. is registration open?             → the form, or the closed notice
 *
 * Getting the order wrong is what produces the two bugs this file is shaped
 * around. Asking (3) before (2) means a signed-out visitor is briefly shown
 * somebody's "you are registered" panel before the prompt replaces it. Asking (4)
 * before (3) means a member who already registered is shown a create form that
 * will 409 — and, worse, one that would let them believe they had registered
 * twice.
 *
 * ⚠️ THE EVENT TITLE COMES FROM THE EVENT ENDPOINT, NOT THE WINDOW. The window
 * payload does carry a title, but it is a six-field allowlist scoped to the
 * participation fields; taking the display title from the event document is what
 * keeps the heading identical to the one on the detail page.
 */
export default function EventRegistrationRoute({ eventId }) {
  const user = useSelector((state) => state.auth.user);
  const hydrated = useSelector((state) => state.auth.hydrated);

  const { data: eventData, isLoading: isEventLoading } =
    useGetPublicEventQuery(eventId, { skip: !eventId });

  const {
    data: windowResponse,
    isLoading: isWindowLoading,
  } = useGetEventParticipationWindowQuery(eventId, { skip: !eventId });

  const {
    data: registrationsResponse,
    isFetching,
  } = useGetMyRegistrationsQuery(eventId, {
    skip: !hydrated || !user || !eventId,
  });

  const event = useMemo(
    () => (eventData?.data ? toPublicEventDetail(eventData.data) : null),
    [eventData]
  );

  const window = windowResponse?.data;

  const existing = useMemo(
    () => findActiveRegistration(registrationsResponse?.data, eventId),
    [registrationsResponse, eventId]
  );

  if (isEventLoading || isWindowLoading) {
    return (
      <div className="flex grow min-h-[50svh] flex-col gap-8 px-4 py-12 sm:px-6 md:px-10">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-64 w-full rounded-3xl" />
      </div>
    );
  }

  if (!event) {
    return <NotAvailable />;
  }

  return (
    <ParticipationShell
      eventId={eventId}
      title="Register"
      subtitle={event.title}
    >
      {/* ── (2) Signed out ────────────────────────────────────────────────
          An inline prompt, not a redirect — see `ParticipationSignInPrompt` for
          why bouncing a member off a public page loses them. */}
      {hydrated && !user ? (
        <ParticipationSignInPrompt
          title="Sign in to register"
          message={`Sign in with your CPCCU account to register for ${event.title}.`}
        />
      ) : null}

      {/* ⚠️ `hydrated &&` GUARDS BOTH BRANCHES BELOW, not just this one. Before
          the auth slice has rehydrated, `user` is `null` for a member who IS
          signed in — so an unguarded `!user` renders the prompt for a frame, and
          an unguarded `!existing` renders the create form for a member who is
          already registered. Both are flicker that reads as a bug. */}
      {hydrated && user && existing ? (
        <AlreadyRegistered
          eventId={eventId}
          registration={existing}
          isFetching={isFetching}
        />
      ) : null}

      {hydrated && user && !existing ? (
        <EventRegistrationForm
          eventId={eventId}
          window={window}
          eventTitle={event.title}
        />
      ) : null}
    </ParticipationShell>
  );
}

/**
 * Shown instead of the create form when a live registration already exists.
 *
 * ⚠️ THIS IS NOT THE DETAIL PAGE'S "YOU ARE REGISTERED" PANEL, AND IT IS
 * DELIBERATELY DIFFERENT. On the detail page that panel is a summary; here the
 * member arrived intending to REGISTER, so a summary alone would look like the
 * page ignored them. This one says what is already in place, and offers the two
 * things that are actually useful from this URL: go back, or change the team.
 *
 * The roster is safe to render because this row came from
 * `GET /me/registrations`, which populates members. The same fields are empty
 * strings in the create and withdraw responses, which is the documented reason
 * those bodies cannot be used for this.
 */
function AlreadyRegistered({ eventId, registration, isFetching }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-bold text-foreground md:text-2xl">
          You are already registered
        </h2>
        <p className="break-words text-muted-foreground">
          {registration.kind === 'team'
            ? `${registration.name} · ${registration.memberCount} participants`
            : 'Registered as an individual participant.'}
        </p>
      </div>

      <ul className="flex flex-col gap-2">
        {registration.members.map((member) => (
          <li
            key={member._id}
            className="flex items-center gap-3 rounded-xl border border-border px-4 py-3"
          >
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
              {member.fullName || member.uniID}
            </span>
            {member.role === 'captain' ? (
              <span className="shrink-0 rounded-full bg-header/10 px-2.5 py-0.5 text-xs font-medium text-header">
                Captain
              </span>
            ) : null}
          </li>
        ))}
      </ul>

      {/* ⚠️ `isOwner`, NOT "they are on the list". Reads of a registration are open
          to every member of the team, so a co-member lands here too — and a PATCH
          is owner-only, so offering them the Edit link would produce a page whose
          every save 404s. */}
      {registration.isOwner ? (
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href={`/event/${eventId}/submit`}
            className="inline-flex min-h-[2.75rem] items-center justify-center gap-2 rounded-lg bg-header px-5 py-3 text-center text-sm font-bold text-white transition-colors hover:bg-header-hover md:min-h-0"
          >
            {registration.submission ? 'View your submission' : 'Go to submission'}
          </Link>
          <Link
            href={`/event/${eventId}`}
            className="inline-flex min-h-[2.75rem] items-center justify-center gap-2 rounded-lg border border-header px-5 py-3 text-center text-sm font-bold text-header transition-colors hover:bg-header/10 md:min-h-0"
          >
            Edit your team
          </Link>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Only the captain can change this registration. Ask{' '}
          {registration.members.find((member) => member.role === 'captain')
            ?.fullName ?? 'the captain'}
          {' '}if something needs to change.
        </p>
      )}

      {isFetching ? (
        <p className="text-xs text-muted-foreground" role="status">
          Checking for updates…
        </p>
      ) : null}
    </div>
  );
}

/**
 * ⚠️ A HINT, NOT A BUTTON, AND THAT IS THE POINT.
 *
 * Editing an existing registration is a PATCH against a different endpoint than
 * the one this page's form POSTs to, and wiring both into one form is what makes
 * this page confusing: the create form asks for a name and teammates, and a PATCH
 * has three distinct meanings for `memberIds` (omit = unchanged, `[]` = drop
 * everyone, `[a,b]` = replace) which do not match the create form's mental model
 * at all.
 *
 * Rather than build one form with two modes and a mode flag — where "omit" versus
 * "empty" is a distinction invisible in the UI — the create form stays on this
 * route and the edit path is reached from the event page.
 *
 * ⚠️ THIS HINT IS THE ONLY PLACE THAT SAYS SO, AND IT SAYS NOTHING ABOUT
 * WITHDRAWING, because there is no withdraw UI anywhere yet.
 *
 * That is a known, deliberate omission rather than an oversight, and the two
 * reasons are worth writing down so nobody reads the absence as a bug:
 *
 *   * `withdrawRegistration` is a DELETE that leaves a TOMBSTONE — the document
 *     survives as `status: 'withdrawn'` — and it is PERMANENT for the member.
 *     There is no un-withdraw endpoint. The unique index is partial on
 *     `status: 'registered'`, so withdrawing frees the member to register again,
 *     but the old record stays in the collection forever and the member can only
 *     create a NEW one.
 *   * a registration that already has a submission CANNOT be withdrawn. The
 *     server answers 409 with "Contact an administrator", which is a genuine dead
 *     end for the member by design.
 *
 * A button whose two possible outcomes are "irreversible" and "always fails" is
 * one that needs a confirmation step and a real explanation, not a line in a
 * sidebar. That is a separate piece of work. Until it exists, this page makes no
 * promise about it — an earlier version said "You can withdraw from the event
 * page", which was true of nothing.
 */

/**
 * The event does not exist, is unpublished, or is a hackathon.
 *
 * ⚠️ SHARED BY ALL THREE PARTICIPATION ROUTES via `NotAvailable` in
 * `EventRegistrationRoute`'s sibling files, because three pages that render
 * three different "no such event" screens is how a member concludes the site is
 * broken. The copy is deliberately non-committal about WHY: a member following a
 * shared link should not be able to distinguish "expired" from "wrong link" from
 * "hackathon", and neither should an attacker.
 */
function NotAvailable() {
  return (
    <div className="flex grow min-h-[50svh] flex-col items-center justify-center gap-6 px-4 py-24 sm:px-6">
      <div className="flex size-20 items-center justify-center rounded-full bg-red-50">
        <AlertTriangle className="size-10 text-red-500" aria-hidden="true" />
      </div>
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-bold text-gray-900">This event is not available</h1>
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
