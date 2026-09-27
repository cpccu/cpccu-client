import { baseApi } from "@/services/baseApi";

export const memberApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    fetchMembers: builder.query({
        query: () => 'users/member',
        
    }),
    fetchMemberById: builder.query({
        query: (id) => `/users/member/${id}`,
        providesTags: (result, error, id) => [{ type: 'Members', id }],
    }),
  }),
});

export const { useFetchMembersQuery, useFetchMemberByIdQuery } = memberApi;