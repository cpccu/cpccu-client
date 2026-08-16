import { baseApi } from "@/services/baseApi";

export const adminApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAdminOverview: builder.query({
      query: () => "/admin/overview",
      providesTags: ["AdminOverview"],
    }),
    getAdminMembers: builder.query({
      query: (params) => ({
        url: "/admin/members",
        params,
      }),
      providesTags: ["AdminMembers"],
    }),
    createAdminMember: builder.mutation({
      query: (body) => ({
        url: "/admin/members",
        method: "POST",
        body,
      }),
      invalidatesTags: ["AdminOverview", "AdminMembers", "Users"],
    }),
    updateAdminMember: builder.mutation({
      query: ({ id, ...body }) => ({
        url: `/admin/members/${id}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: ["AdminOverview", "AdminMembers", "Users"],
    }),
    deleteAdminMember: builder.mutation({
      query: (id) => ({
        url: `/admin/members/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["AdminOverview", "AdminMembers", "Users"],
    }),
    getAdminContent: builder.query({
      query: ({ resource, params } = {}) => ({
        url: `/admin/content/${resource}`,
        params,
      }),
      providesTags: (result, error, arg) => [
        { type: "AdminContent", id: arg?.resource || arg },
      ],
    }),
    createAdminContent: builder.mutation({
      query: ({ resource, body }) => ({
        url: `/admin/content/${resource}`,
        method: "POST",
        body,
      }),
      invalidatesTags: (result, error, { resource }) => [
        { type: "AdminContent", id: resource },
        { type: "PublicContent", id: resource },
        "AdminOverview",
      ],
    }),
    updateAdminContent: builder.mutation({
      query: ({ resource, id, body }) => ({
        url: `/admin/content/${resource}/${id}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: (result, error, { resource }) => [
        { type: "AdminContent", id: resource },
        { type: "PublicContent", id: resource },
        "AdminOverview",
      ],
    }),
    deleteAdminContent: builder.mutation({
      query: ({ resource, id }) => ({
        url: `/admin/content/${resource}/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: (result, error, { resource }) => [
        { type: "AdminContent", id: resource },
        { type: "PublicContent", id: resource },
        "AdminOverview",
      ],
    }),
    uploadAdminImage: builder.mutation({
      query: (body) => ({
        url: "/admin/uploads/image",
        method: "POST",
        body,
      }),
    }),
    getAdminStatistics: builder.query({
      query: () => "/admin/statistics",
      providesTags: ["AdminStatistics"],
    }),
    getAdminSystemSettings: builder.query({
      query: () => "/admin/system-settings",
      providesTags: ["AdminSystemSettings"],
    }),
    updateAdminSystemSettings: builder.mutation({
      query: (body) => ({
        url: "/admin/system-settings",
        method: "PATCH",
        body,
      }),
      invalidatesTags: ["AdminSystemSettings"],
    }),
    getAdminContributors: builder.query({
      query: () => "/admin/contributors",
      providesTags: ["AdminContributors"],
    }),
    updateContributorMetadata: builder.mutation({
      query: ({ githubUsername, body }) => ({
        url: `/admin/contributors/${githubUsername}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: ["AdminContributors"],
    }),
    getAdminCertificates: builder.query({
      query: () => "/admin/certificates",
      providesTags: ["AdminCertificates"],
    }),
    createAdminCertificate: builder.mutation({
      query: (body) => ({
        url: "/admin/certificates",
        method: "POST",
        body,
      }),
      invalidatesTags: ["AdminCertificates", "AdminOverview"],
    }),
    updateAdminCertificate: builder.mutation({
      query: ({ id, body }) => ({
        url: `/admin/certificates/${id}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: ["AdminCertificates"],
    }),
    deleteAdminCertificate: builder.mutation({
      query: (id) => ({
        url: `/admin/certificates/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["AdminCertificates", "AdminOverview"],
    }),
    // ===== Role Management =====
    getAdminRoles: builder.query({
      query: () => "/admin/roles",
      providesTags: ["AdminRoles"],
    }),
    getActiveRoles: builder.query({
      query: () => "/admin/roles/active",
    }),
    createAdminRole: builder.mutation({
      query: (body) => ({
        url: "/admin/roles",
        method: "POST",
        body,
      }),
      invalidatesTags: ["AdminRoles"],
    }),
    updateAdminRole: builder.mutation({
      query: ({ id, ...body }) => ({
        url: `/admin/roles/${id}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: ["AdminRoles"],
    }),
    toggleAdminRole: builder.mutation({
      query: (id) => ({
        url: `/admin/roles/${id}/toggle`,
        method: "PATCH",
      }),
      invalidatesTags: ["AdminRoles"],
    }),
  }),
});

export const {
  useGetAdminOverviewQuery,
  useGetAdminMembersQuery,
  useCreateAdminMemberMutation,
  useDeleteAdminMemberMutation,
  useUpdateAdminMemberMutation,
  useCreateAdminCertificateMutation,
  useCreateAdminContentMutation,
  useDeleteAdminCertificateMutation,
  useDeleteAdminContentMutation,
  useGetAdminCertificatesQuery,
  useGetAdminContentQuery,
  useGetAdminContributorsQuery,
  useUpdateContributorMetadataMutation,
  useGetAdminStatisticsQuery,
  useUpdateAdminCertificateMutation,
  useUpdateAdminContentMutation,
  useGetAdminSystemSettingsQuery,
  useUpdateAdminSystemSettingsMutation,
  useUploadAdminImageMutation,
  useGetAdminRolesQuery,
  useGetActiveRolesQuery,
  useCreateAdminRoleMutation,
  useUpdateAdminRoleMutation,
  useToggleAdminRoleMutation,
} = adminApi;
