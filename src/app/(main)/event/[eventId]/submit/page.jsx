import { notFound } from 'next/navigation';
import EventSubmissionRoute from '@/components/PARTICIPATION/EventSubmissionRoute';
import { IS_EVENT_ID } from '@/lib/participation-routes';

/**
 * `/event/[eventId]/submit` — the in-app project submission form.
 *
 * ⚠️ THIS ROUTE IS ADDRESSED BY EVENT ID BUT SUBMITS BY REGISTRATION ID, and the
 * gap between those two is the interesting part of the whole feature.
 *
 * The server's submission endpoints are
 * `/participation/registrations/:registrationId/submission` — there is no
 * `?eventId=` on them, and there cannot be one, because a submission belongs to a
 * REGISTRATION (its `registrationId` carries a unique index) and not to an event.
 * Two registrations for one event are two separate entries, each with its own
 * submission.
 *
 * So the URL a member can be sent to is event-scoped — it is what the detail page
 * links to, and it is what a captain can put in a chat message — while the
 * resolution from "this event" to "my registration for it" has to happen in the
 * client. `EventSubmissionRoute` does that with `GET /me/registrations`, which
 * already carries each row's submission inline.
 *
 * ⚠️ CONSEQUENCE, AND IT IS A DESIGN CONSTRAINT RATHER THAN A BUG: a signed-in
 * member who is not registered for this event cannot submit, and this route has
 * no form to show them. It says so and links to `/register`. That is the only
 * sensible outcome — inventing a "register and submit in one step" flow would
 * mean creating a registration as a side effect of opening a submission form,
 * which nobody asked for and which would make a mistyped link into a signup.
 *
 * As with `/register`: no route guard, and no server-side data fetching. See
 * `ParticipationSignInPrompt` for why signed-out visitors are prompted rather
 * than redirected.
 */
export default async function EventSubmitPage({ params }) {
  const { eventId } = await params;

  if (!IS_EVENT_ID(eventId)) {
    notFound();
  }

  return <EventSubmissionRoute eventId={eventId} />;
}
