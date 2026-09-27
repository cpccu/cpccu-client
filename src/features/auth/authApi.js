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
                method: 'GET',
            }),
            invalidatesTags: ['Auth'],
        }),
        sendPasswordResetLink: builder.mutation({
            query: ({ email }) => ({
                url: `/auth/reset-link/${encodeURIComponent(email)}`,
                method: 'GET',
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
