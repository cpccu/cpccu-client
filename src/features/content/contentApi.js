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
  }),
});

export const { useGetPublicContentQuery, useGetPublicStatisticsQuery } =
  contentApi;
