import { baseApi } from "@/services/baseApi";

// Certificate verification is served by THIS instance and no other. The migrated
// API exposes it under `/api/v1/certificates/verify`, which this `baseApi`
// instance already reaches, so no second `createApi` instance is needed or
// wanted. The one that used to live here pointed at the ROOT path `/verify/:id`
// (by stripping `/api/v1` off the base URL), which only ever existed in the old
// Express backend (`cpccu-server/src/app.js:76`); the migrated API has no route
// there, so the endpoint could only ever have 404'd. Its hook
// (`useVerifyCertificatePublicQuery`) had no call sites, and the instance was
// still wired into the store — an empty reducer plus a second middleware. Do not
// reintroduce a second instance to reach the by-id route: it is already served
// by `src/app/api/v1/certificates/verify/[certificateId]/route.js` on the same
// base URL.
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

export const {
  useLazyVerifyCertificateQuery,
  useVerifyCertificateQuery,
  useGetCertificateStatsQuery,
  useGetRecentCertificatesQuery,
} = certificateApi;