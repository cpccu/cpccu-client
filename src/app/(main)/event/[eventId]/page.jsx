import { notFound } from 'next/navigation';
import EventDetail from '@/components/PARTICIPATION/EventDetail';
import { IS_EVENT_ID } from '@/lib/participation-routes';

/**
 * The event detail page: `GET /event/[eventId]` in the browser.
 *
 * ⚠️ THIS IS A SERVER COMPONENT THAT DOES NO DATA FETCHING, and that is a
 * deliberate choice rather than a shortcut.
 *
 * The obvious move is to fetch the event here with `fetch` — the pattern used by
 * `(main)/certificate/[certificateId]`, which does exactly that for its
 * `generateMetadata`. Two reasons it is wrong here:
 *
 *   1. `fetch` from a server component needs `credentials: 'include'` and the
 *      cookie jar, and this app's token lives in BOTH a cookie and Redux. Reading
 *      it server-side would create a second, independently-authenticated data path
 *      for one endpoint — and the participation window the page also needs is
 *      anonymous, so there would be two fetch paths for two parts of one page.
 *
 *   2. Every other public page in this app is client-rendered over RTK Query, and
 *      the whole `(main)` layout is a client component. A server fetch would be the
 *      only server-side data access on the public site, with its own loading,
 *      error and caching behaviour, for no benefit — the API is cross-origin and
 *      cannot be statically generated either way.
 *
 * So this file does the two things a server component is genuinely good at:
 * validating the route parameter, and rendering a client child.
 *
 * ⚠️ `params` IS A PROMISE IN NEXT 16, so it is awaited. Reading it without
 * `await` yields a Promise and every `typeof` check against it silently fails —
 * which is why the guard below is written against the awaited value.
 *
 * ⚠️ `notFound()` FOR A MALFORMED ID, and for nothing else. Whether the event
 * EXISTS is answered by the API, which 404s — and rendering the not-found page
 * from that keeps one source of truth for "this event does not exist" instead of
 * two that can disagree. Validating the SHAPE here is not duplicating that check;
 * it is avoiding a request that cannot succeed and cannot be distinguished from a
 * transport failure.
 */
export default async function EventDetailPage({ params }) {
  const { eventId } = await params;

  if (!IS_EVENT_ID(eventId)) {
    notFound();
  }

  return <EventDetail eventId={eventId} />;
}
