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
    logout: builder.mutation({
        query: () => ({
            url: '/auth/logout',
            method: 'POST',
        }),
        invalidatesTags: ['Auth'],
    }),
  }),
});

export const {
  useLoginMutation,
  useRegisterMutation,
  useLogoutMutation,
} = authApi;