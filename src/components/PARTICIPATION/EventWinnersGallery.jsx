"use client";

import { useMemo } from "react";
import { ExternalLink, Trophy, Users, UserRound } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useGetEventWinnersQuery } from "@/features/participation/participationApi";
import { toSafeHref } from "@/lib/hackathon";

/**
 * The published shortlist for an event.
 *
 * ⚠️ EVERY FIELD HERE IS DELIBERATELY NARROW, AND THE SERVER ENFORCES IT. The
 * endpoint emits `{ title, liveUrl, technologies, registrationName, kind }` and
 * NOTHING else — no `_id`, no student IDs, no member names, no `repoUrl`, no
 * `description`. There is no admin-facing variant of this endpoint, so there is no
 * way to widen it from the client.
 *
 * A component that reaches for a field not on that list is reading `undefined`,
 * and a component that treats the missing `_id` as a React key error is the
 * signal that it expected a different endpoint. `key` below is therefore the
 * INDEX, and the comment on it says why.
 *
 * ⚠️ AN EMPTY ARRAY IS A NORMAL 200, NOT AN ERROR. Every event that has not been
 * reviewed yet looks exactly like this. Distinguishing "no winners yet" from
 * "something broke" is the difference between a quiet page and a red one, so the
 * `isError` branch is separate and explicit.
 *
 * ⚠️ A SOLO FINALIST'S REAL NAME IS PUBLISHED, as `registrationName`. This is a
 * deliberate disclosure, not a leak: a solo entry has no team name to show, and
 * publishing finalists anonymously would be a worse outcome for them. There is no
 * contact detail here — only a name and an optional demo link.
 *
 * The gallery only queries once the event page knows the window resolved, because
 * every real event with participation switched on goes through it — but the
 * `skip` is on `eventId` alone, so an event that never had participation simply
 * 404s and renders nothing. That is the right shape: an unconfigured endpoint
 * returning 404 must not put an error on the page.
 */
export default function EventWinnersGallery({ eventId, enabled }) {
  // ⚠️ `skip` IS `!eventId || enabled === false`, NOT JUST `!eventId`. An event
  // that has never had participation configured has nothing on this endpoint and
  // answers 404, so fetching unconditionally would put one guaranteed-failing
  // request on every event page view for the majority of events on the site. The
  // caller already knows whether participation is switched on, so the decision is
  // made where the information is rather than inferred from a 404.
  //
  // `enabled === false` rather than `!enabled` so a caller that simply omits the
  // prop still fetches — the safe default for a component whose prop is optional.
  const { data, isLoading, isError } = useGetEventWinnersQuery(eventId, {
    skip: !eventId || enabled === false,
  });

  const winners = useMemo(
    () => (Array.isArray(data?.data) ? data.data : []),
    [data]
  );

  if (isLoading) {
    return (
      <section className="flex flex-col gap-3">
        <h2 className="text-2xl font-bold text-foreground">Winners</h2>
        <Skeleton className="h-32 w-full rounded-2xl" />
      </section>
    );
  }

  // ⚠️ SILENT, NOT AN ERROR PANEL. The overwhelmingly common cause is "this event
  // has no participation configured", which is not a failure and must not put an
  // error on a public page. `404` is also what a bad id returns, and a public page
  // has no way to distinguish the two — nor does it need to.
  if (isError || !winners.length) {
    return null;
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Trophy className="size-6 text-header" aria-hidden="true" />
        <h2 className="text-2xl font-bold text-foreground">Winners</h2>
      </div>

      {/* ⚠️ THE ENDPOINT IS CAPPED AT 200 AND SORTED OLDEST-FIRST with no
          pagination, sort or filter parameter. This list is therefore a
          representative gallery, not a complete roll, and there is nothing a
          client can do about the order. Rendered oldest-first on purpose: a
          shortlist reads as a narrative of the event, and reversing it locally
          would be a cosmetic difference from every other winner list the club
          publishes. */}
      <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {winners.map((winner, index) => (
          // ⚠️ `index` AS THE KEY, DELIBERATELY. The projection has no `_id`, so
          // there is nothing stable to key on. `index` is safe HERE specifically
          // because the list is a static, ordered, non-interactive collection of
          // cards that are never reordered, filtered or appended to — the usual
          // argument against index keys does not apply. If this list ever becomes
          // sortable or paginated, this must change.
          <li
            key={`${winner.title}-${index}`}
            className="flex h-full flex-col gap-2 rounded-2xl border border-border bg-card px-5 py-4"
          >
            <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {winner.kind === 'solo' ? (
                <UserRound className="size-3.5 shrink-0" aria-hidden="true" />
              ) : (
                <Users className="size-3.5 shrink-0" aria-hidden="true" />
              )}
              {winner.kind === 'solo' ? 'Solo entry' : 'Team entry'}
            </span>

            <h3 className="break-words text-lg font-bold text-foreground">
              {winner.title}
            </h3>

            {/* `break-words`: a registration name is chosen by a student and can
                be a single long token. */}
            <p className="break-words text-sm text-muted-foreground">
              {winner.registrationName}
            </p>

            {winner.technologies?.length ? (
              <ul className="flex flex-wrap gap-1.5 pt-1">
                {winner.technologies.map((technology) => (
                  <li
                    key={technology}
                    className="rounded-full bg-header/10 px-2.5 py-0.5 text-xs font-medium text-header"
                  >
                    {technology}
                  </li>
                ))}
              </ul>
            ) : null}

            {/* Re-validated on arrival even though the server stores it through
                the same `isSafeHttpUrl` validator: these are MEMBER-AUTHORED
                strings, and a poisoned value would otherwise reach React as a
                live `href`. Plain anchor, never `next/link` — the EXTERNAL LINK
                RULE in `src/lib/hackathon.js` applies to member-supplied URLs
                exactly as it does to admin-supplied ones. */}
            {toSafeHref(winner.liveUrl) ? (
              <a
                href={toSafeHref(winner.liveUrl)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-auto inline-flex max-w-full items-center gap-1 break-all pt-2 text-sm font-semibold text-header underline underline-offset-4 hover:text-header-hover"
              >
                View project
                <span className="sr-only"> (opens in a new tab)</span>
                <ExternalLink className="size-3.5 shrink-0" aria-hidden="true" />
              </a>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}