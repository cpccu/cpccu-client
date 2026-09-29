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
  useGetPublicStatisticsQuery,
  useGetPublicHackathonQuery,
  useGetPublicHackathonProblemSetQuery,
} = contentApi;
