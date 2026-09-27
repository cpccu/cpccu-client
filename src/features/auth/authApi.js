import { baseApi } from "@/services/baseApi";

export const authApi = baseApi.injectEndpoints({
    endpoints: (builder) => ({
        login: builder.mutation({
            query: (credentials) => ({
                url: '/auth/login',
                method: 'POST',
                body: credentials,
            }),
            invalidatesTags: ['Auth'],
        }),
        register: builder.mutation({
            query: (userData) => ({
                url: '/auth/register',
                method: 'POST',
                body: userData,
            }),
            invalidatesTags: ['Auth'],
        }),
        sendOtp: builder.mutation({
            query: ({ email }) => ({
                url: '/auth/send-otp',
                method: 'POST',
                body: { email },
            }),
        }),
        otpVerify: builder.mutation({
            query: ({ email, otp }) => ({
                url: '/auth/verify-registration',
                method: 'POST',
                body: { email, otp },
            }),
        }),
        getCurrentUser: builder.query({
            query: () => '/users/user',
            providesTags: ['Auth'],
        }),
        logout: builder.mutation({
            query: () => ({
                url: '/auth/logout',
                // `POST`, CHANGED 2026-09 IN THE CUTOVER, and this is the ONLY
                // place the verb is declared for this endpoint (it is also the
                // only place the client calls it). It was `GET`, and `GET` is in
                // `SAFE_METHODS`, so `assertSameOrigin` never ran on it — a
                // cross-site `<img src="/api/v1/auth/logout">` could force-log a
                // victim out AND revoke their refresh token for the full seven
                // days it is scoped to. `POST` brings it under the CSRF check
                // for the first time. See the docblock in
                // `src/app/api/v1/auth/logout/route.js`.
                //
                // There is no `GET` fallback and there must not be one: a
                // GET-shaped logout is exactly the hole this changed.
                method: 'POST',
            }),
            invalidatesTags: ['Auth'],
        }),
        sendPasswordResetLink: builder.mutation({
            query: ({ email }) => ({
                // `POST` with the address in the BODY, CHANGED 2026-09. It was
                // `GET /auth/reset-link/${encodeURIComponent(email)}` — the
                // verb in `SAFE_METHODS`, and the address in the PATH, so
                // `assertSameOrigin` was a no-op and a bare cross-site
                // `<img src>` or top-level navigation was enough to make the
                // server mail a real CPCCU-branded password-reset link to an
                // attacker-chosen address: a mail-bomb / sender-quota-burn
                // primitive and a phishing lure, needing no credential and no
                // CORS. `authEmailRateLimiter` does not cover it, because its
                // store is per-INSTANCE and so is close to unenforced on Vercel.
                //
                // A `POST` body cannot be produced by an image tag or a link, so
                // the same-origin check is armed. See the docblock in
                // `src/app/api/v1/auth/reset-link/route.js`.
                //
                // There is no `GET` fallback and there must not be one: a
                // `GET` could only read the address from the path, which is the
                // exploitable half of the old design. The `email` still arrives
                // here as `{ email }`, so the call site in `Login.jsx` is
                // unchanged.
                url: '/auth/reset-link',
                method: 'POST',
                body: { email },
            }),
        }),
        resetPassword: builder.mutation({
            query: (resetData) => ({
                url: '/auth/reset-password',
                method: 'PATCH',
                body: resetData,
            }),
        }),
    }),
});

export const {
    useLoginMutation,
    useRegisterMutation,
    useSendOtpMutation,
    useOtpVerifyMutation,
    useGetCurrentUserQuery,
    useLogoutMutation,
    useSendPasswordResetLinkMutation,
    useResetPasswordMutation,
} = authApi;
