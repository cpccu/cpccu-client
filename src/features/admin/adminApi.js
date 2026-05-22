import { baseApi } from "@/services/baseApi";

export const adminApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAdminOverview: builder.query({
      query: () => "/admin/overview",
      providesTags: ["AdminOverview"],
    }),
    getAdminMembers: builder.query({
      query: () => "/admin/members",
      providesTags: ["AdminMembers"],
    }),
    updateAdminMember: builder.mutation({
      query: ({ id, ...body }) => ({
        url: `/admin/members/${id}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: ["AdminOverview", "AdminMembers", "Users"],
    }),
  }),
});

export const {
  useGetAdminOverviewQuery,
  useGetAdminMembersQuery,
  useUpdateAdminMemberMutation,
} = adminApi;
