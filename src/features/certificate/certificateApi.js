import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

const publicApi = createApi({
  reducerPath: 'publicApi',
  baseQuery: fetchBaseQuery({
    baseUrl: (process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000').replace('/api/v1', ''),
  }),
  endpoints: (build) => ({
    verifyCertificatePublic: build.query({
      query: (certificateId) => `/verify/${certificateId}`,
    }),
  }),
});

import { baseApi } from "@/services/baseApi";

export const certificateApi = baseApi.injectEndpoints({
  endpoints: (build) => ({
    verifyCertificate: build.query({
      query: ({ certificateId, recipientName, recipientId }) => {
        const params = new URLSearchParams();

        if (certificateId?.trim()) {
          params.append("certificateId", certificateId.trim());
        }

        if (recipientName?.trim()) {
          params.append("recipientName", recipientName.trim());
        }

        if (recipientId?.trim()) {
          params.append("recipientId", recipientId.trim());
        }

        return `/certificates/verify?${params.toString()}`;
      },
    }),
    getCertificateStats: build.query({
      query: () => "/certificates/stats",
    }),
    getRecentCertificates: build.query({
      query: () => "/certificates/recent",
    }),
  }),
});

export { publicApi };

export const {
  useVerifyCertificatePublicQuery,
} = publicApi;

export const {
  useLazyVerifyCertificateQuery,
  useVerifyCertificateQuery,
  useGetCertificateStatsQuery,
  useGetRecentCertificatesQuery,
} = certificateApi;