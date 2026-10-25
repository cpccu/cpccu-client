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
    getCertificateTemplates: build.query({
      query: () => "/certificates/templates",
      providesTags: ["CertificateTemplates"],
    }),
    getCertificateSignatories: build.query({
      query: () => "/certificates/signatories",
    }),
    getMyCertificates: build.query({
      query: () => "/certificates/me",
      providesTags: ["MyCertificates"],
    }),
    // Returns the JSON credentials the browser needs to render the PDF itself
    // (certificate, template, the two PDF passwords, file name) — not a PDF. A
    // `queryFn` unwraps the envelope once so callers get `data.data` directly.
    downloadCertificateCredentials: build.query({
      queryFn: async (certificateId, _api, _extraOptions, baseQuery) => {
        if (!certificateId) {
          return {
            error: {
              status: 'CUSTOM_ERROR',
              error: 'A certificate id is required.',
            },
          };
        }

        const result = await baseQuery(
          `/certificates/${encodeURIComponent(certificateId)}/download`
        );

        if (result.error) return { error: result.error };

        const payload = result.data?.data;
        const pdf = payload?.pdf;

        if (!pdf) {
          return {
            error: {
              status: 'CUSTOM_ERROR',
              error: 'The server did not return download credentials.',
            },
          };
        }

        // ⚠️ THE USER PASSWORD IS EMPTY BY DESIGN — it is what lets the member
        // open the PDF with no prompt — so it only has to be a string. The
        // OWNER password is what locks the file against editing, so it has to be
        // there and it has to be non-empty.
        if (
          typeof pdf.userPassword !== 'string' ||
          typeof pdf.ownerPassword !== 'string' ||
          !pdf.ownerPassword
        ) {
          return {
            error: {
              status: 'CUSTOM_ERROR',
              error: 'The server did not return the PDF owner password.',
            },
          };
        }

        return { data: payload };
      },
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
  useGetCertificateTemplatesQuery,
  useGetCertificateSignatoriesQuery,
  useGetMyCertificatesQuery,
  useLazyDownloadCertificateCredentialsQuery,
} = certificateApi;