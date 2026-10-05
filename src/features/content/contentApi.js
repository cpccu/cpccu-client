import { baseApi } from "@/services/baseApi";

export const contentApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getPublicContent: builder.query({
      query: (resource) => `/content/${resource}`,
      providesTags: (result, error, resource) => [
        { type: "PublicContent", id: resource },
      ],
    }),
    getPublicStatistics: builder.query({
      query: () => "/content/statistics",
      providesTags: [{ type: "PublicContent", id: "statistics" }],
    }),
    // The current hackathon. `GET /content/hackathon` 404s with
    // "Hackathon is not currently available." whenever the admin toggle is off
    // — that 404 IS the "not live" signal, which is why the nav bar can decide
    // whether to show the entry from this one query and needs no separate
    // status endpoint. NOTE the tag id is 'hackathon', NOT 'events': the
    // hackathon is an Event document, but it is served over its own route with
    // its own payload shape, so it gets its own cache entry.
    getPublicHackathon: builder.query({
      query: () => "/content/hackathon",
      providesTags: [{ type: "PublicContent", id: "hackathon" }],
    }),
    // ONE event, for the detail page at `/event/[eventId]`.
    //
    // ⚠️ THE TAG ID IS `event:<eventId>`, NOT `events`. This is the one place the
    // two genuinely must not collide: `getPublicContent('events')` serves the whole
    // LIST and is used by `/event` and the homepage carousel, while this serves one
    // record. Sharing an id would mean an admin editing any event evicts the list
    // — which is correct — but ALSO that an admin editing one event evicts every
    // DETAIL page cache entry, and, worse, that a detail fetch could evict the list
    // the carousel is mid-render on. Per-id entries keep the blast radius to the
    // event that actually changed.
    //
    // ⚠️ IT 404s FOR A HACKATHON, and the client must treat that as "this event
    // does not exist" rather than "something broke" — the hackathon is published
    // on exactly one surface, its own phase-aware page at `/hackathon`.
    getPublicEvent: builder.query({
      query: (eventId) => `/content/events/${eventId}`,
      providesTags: (result, error, eventId) => [
        { type: "PublicContent", id: `event:${eventId}` },
      ],
    }),
    // The problem set URL is behind `verifyToken` AND the start time, and is
    // never included in the payload above. This query is therefore skipped
    // entirely before the hackathon starts (see HackathonProblemSet.jsx), so
    // an anonymous visitor cannot even probe for it.
    getPublicHackathonProblemSet: builder.query({
      query: () => "/content/hackathon/problem-set",
      providesTags: [{ type: "PublicContent", id: "hackathon-problem-set" }],
    }),
  }),
});

export const {
  useGetPublicContentQuery,
  useGetPublicEventQuery,
  useGetPublicStatisticsQuery,
  useGetPublicHackathonQuery,
  useGetPublicHackathonProblemSetQuery,
} = contentApi;
