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
  }),
});

export const {
  useLazyVerifyCertificateQuery,
  useVerifyCertificateQuery,
} = certificateApi;