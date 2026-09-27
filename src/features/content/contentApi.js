import { baseApi } from "@/services/baseApi";

export const contentApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getPublicContent: builder.query({
      query: (resource) => `/content/${resource}`,
      providesTags: (result, error, resource) => [
        { type: "PublicContent", id: resource },
      ],
    }),
    // NOTE: `getPublicStatistics` (`GET /content/statistics`) was DELETED in the
    // 2026-09 cutover. The route is still served
    // (`src/app/api/v1/content/statistics/route.js`) and is still public, but
    // `useGetPublicStatisticsQuery` had ZERO call sites — the site's stat tiles
    // are rendered from the admin statistics query or from static data, not from
    // this. It was an export nothing imported, not a call that was failing.
    // Re-adding it is trivial and the route is already there; do not read its
    // absence as "the public statistics endpoint is gone".
  }),
});

export const { useGetPublicContentQuery } = contentApi;
