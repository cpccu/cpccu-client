"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useSelector } from "react-redux";
import { AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import ParticipationShell from "@/components/PARTICIPATION/ParticipationShell";
import ParticipationSignInPrompt from "@/components/PARTICIPATION/ParticipationSignInPrompt";
import EventSubmissionForm from "@/components/PARTICIPATION/EventSubmissionForm";
import {
  useGetEventParticipationWindowQuery,
  useGetMyRegistrationsQuery,
} from "@/features/participation/participationApi";
import { useGetPublicEventQuery } from "@/features/content/contentApi";
import { toPublicEventDetail } from "@/lib/public-content";
import { findActiveRegistration } from "@/lib/participation";

/**
 * `/event/[eventId]/submit` — resolve event → resolve registration → show the form.
 *
 * ⚠️ THIS IS THE STEP WHERE THE EVENT ID IN THE URL BECOMES A REGISTRATION ID IN
 * THE REQUEST, and that resolution is the whole reason this component exists.
 *
 * The submission endpoints are `/participation/registrations/:registrationId/
 * submission`. There is no event-scoped submission endpoint and there cannot be
 * one: `EventSubmission.registrationId` carries a unique index, so "the submission
 * for event X" is ambiguous the moment two teams enter the same event. The URL
 * stays event-scoped anyway, because that is what the detail page links to and
 * what a captain can paste into a chat message — and both of those need a stable
 * link that does not require knowing a registration id.
 *
 * The resolution itself is one request: `GET /me/registrations` already returns
 * each row with its `submission` INLINE, so there is no second round trip to
 * discover whether work has already been filed. That is why this page shows the
 * form immediately on load rather than fetching, discovering it is an edit, and
 * then swapping.
 *
 * ⚠️ A MEMBER WITH NO REGISTRATION GETS A LINK TO REGISTER, NOT A FORM. Creating a
 * registration as a side effect of opening a submission page would turn a mistyped
 * or shared link into a signup — and submission is a commitment (it is permanent,
 * and there is exactly one per registration), so it should never be reachable as a
 * side effect of navigation.
 */
export default function EventSubmissionRoute({ eventId }) {
  const user = useSelector((state) => state.auth.user);
  const hydrated = useSelector((state) => state.auth.hydrated);

  const { data: eventData, isLoading: isEventLoading } =
    useGetPublicEventQuery(eventId, { skip: !eventId });

  const { data: windowResponse, isLoading: isWindowLoading } =
    useGetEventParticipationWindowQuery(eventId, { skip: !eventId });

  const {
    data: registrationsResponse,
    isLoading: isRegistrationsLoading,
  } = useGetMyRegistrationsQuery(eventId, {
    // Skipped, not guarded, so a signed-out visitor spends none of the
    // participation rate-limit budget and receives no 401 to render as an error on
    // what is otherwise a public page.
    skip: !hydrated || !user || !eventId,
  });

  const event = useMemo(
    () => (eventData?.data ? toPublicEventDetail(eventData.data) : null),
    [eventData]
  );

  const window = windowResponse?.data;

  const registration = useMemo(
    () => findActiveRegistration(registrationsResponse?.data, eventId),
    [registrationsResponse, eventId]
  );

  // ⚠️ THE HYDRATION GATE IS PART OF THE LOADING CONDITION, not a separate branch.
  // Before `hydrated` flips, `user` is `null` even for a signed-in member, so an
  // ungated `!user` check renders the sign-in prompt for a frame and then swaps to
  // the form. Including it here means a signed-in member sees one continuous
  // skeleton instead.
  const isLoading =
    isEventLoading ||
    isWindowLoading ||
    (hydrated && Boolean(user) && isRegistrationsLoading);

  if (isLoading) {
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
      title="Submit your project"
      subtitle={event.title}
    >
      {hydrated && !user ? (
        <ParticipationSignInPrompt
          title="Sign in to submit"
          message={`Sign in with your CPCCU account to submit your project for ${event.title}.`}
        />
      ) : null}

      {hydrated && user && !registration ? (
        <NotRegisteredYet eventId={eventId} eventTitle={event.title} />
      ) : null}

      {hydrated && user && registration ? (
        <EventSubmissionForm
          registrationId={registration._id}
          registration={registration}
          submission={registration.submission ?? null}
          window={window}
          eventTitle={event.title}
        />
      ) : null}
    </ParticipationShell>
  );
}

/**
 * No live registration for this event.
 *
 * ⚠️ "Not registered" IS NOT AN ERROR AND IS NOT RENDERED AS ONE. The member may
 * simply be new, or may have registered for a different event, or may have
 * withdrawn from this one — all ordinary states, none of which the client can
 * distinguish and all of which the same sentence answers correctly. `role="status"`
 * rather than `role="alert"` for the same reason as the closed notice: nothing
 * failed, and training members to ignore red panels is what hides the real ones.
 */
function NotRegisteredYet({ eventId, eventTitle }) {
  return (
    <div
      role="status"
      className="flex flex-col items-start gap-4"
    >
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-bold text-foreground md:text-2xl">
          You have not registered for this event
        </h2>
        <p className="break-words text-muted-foreground">
          You need a registration before you can submit a project for {eventTitle}.
          Register first — you can add your whole team in one go.
        </p>
      </div>
      <Link
        href={`/event/${eventId}/register`}
        className="inline-flex min-h-[2.75rem] items-center justify-center gap-2 rounded-lg bg-header px-5 py-3 text-center text-sm font-bold text-white transition-colors hover:bg-header-hover md:min-h-0"
      >
        Register for this event
      </Link>
    </div>
  );
}

/**
 * ⚠️ IDENTICAL COPY TO `EventRegistrationRoute`'s equivalent, deliberately.
 *
 * Three pages that render three different "no such event" screens is how a member
 * concludes the site is broken — and the inconsistency is invisible in review
 * because each screen is individually reasonable. This is the second of the two
 * copies; if the wording needs to change, change it in both, or extract it. It is
 * left duplicated rather than extracted only because a shared module for two
 * call sites in two route components would itself be the thing a reader has to
 * chase.
 *
 * The copy is deliberately non-committal about WHY. A member following a shared
 * link should not be able to distinguish "expired" from "wrong link" from
 * "hackathon", and neither should an attacker probing for valid event ids.
 */
function NotAvailable() {
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
