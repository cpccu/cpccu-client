import { notFound } from 'next/navigation';
import EventRegistrationRoute from '@/components/PARTICIPATION/EventRegistrationRoute';
import { IS_EVENT_ID } from '@/lib/participation-routes';

/**
 * `/event/[eventId]/register` — the in-app registration form.
 *
 * ⚠️ A SEPARATE ROUTE, NOT A SECTION OF THE DETAIL PAGE, and the reasons are
 * worth keeping in mind before anyone "simplifies" this back into an inline form:
 *
 *   * it is BOOKMARKABLE, which is what lets a captain send it to their team in
 *     chat. An inline form on a scrolling detail page cannot be shared;
 *   * a form inline in a long page loses its scroll position and its typed values
 *     on every validation error;
 *   * a member who already registered and later opens the same link lands on a
 *     page that can explain that, rather than on a form that 409s.
 *
 * The data and validation live in `EventRegistrationRoute`; this file does only
 * what a server component should — validate the parameter and render the child.
 *
 * ⚠️ NO ROUTE GUARD. A signed-out visitor is NOT redirected here; the child renders
 * a sign-in prompt in place. See `ParticipationSignInPrompt` for why redirecting
 * would be wrong on a public surface. Authorisation is not this file's business —
 * and in any case there is nothing to protect: every write re-checks the window,
 * the member's approval status and the uniqueness index server-side.
 */
export default async function EventRegisterPage({ params }) {
  const { eventId } = await params;

  if (!IS_EVENT_ID(eventId)) {
    notFound();
  }

  return <EventRegistrationRoute eventId={eventId} />;
}
