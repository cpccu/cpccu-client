import { baseApi } from "@/services/baseApi";

/**
 * Tag invalidation shared by create / update / delete of any admin content
 * resource.
 *
 * Three jobs, all of them load-bearing:
 *
 *  1. `{ type: 'AdminContent', id: resource }` — refreshes the admin table.
 *  2. `{ type: 'PublicContent', id: resource }` — refreshes the public view of
 *     the same collection.
 *  3. `'AdminOverview'` — why the admin dashboard counters move the instant
 *     any content is edited.
 *
 * ⚠️ The hackathon needs TWO EXTRA entries, and it is the reason this is a
 * function rather than a literal array. The hackathon is an `Event` document
 * with `type: 'hackathon'`, but it is published over its own two routes
 * (`/content/hackathon`, `/content/hackathon/problem-set`) which are cached
 * under their own tag ids — `'hackathon'` and `'hackathon-problem-set'` — NOT
 * under `'events'`. A plain `{ type: 'PublicContent', id: resource }` array
 * therefore leaves both hackathon cache entries stale after an events write,
 * and the public nav entry would survive an admin toggling the hackathon off
 * until a reload. The conditional spread below fixes that — for the tab that
 * PERFORMED the write.
 *
 * ⚠️ SCOPE, STATED PRECISELY: tag invalidation is per-browser, per-tab. It
 * evicts the cache entry in the Redux store of the client instance that made
 * the mutation. It does NOT push anything to a visitor sitting on another tab,
 * who keeps the stale entry until the RTK Query `keepUnusedDataFor` window
 * elapses or they reload. So this is "the admin's own open tab updates
 * immediately", NOT "the admin panel and the public site are always in
 * agreement" — a second claim this comment used to make, and should not.
 */
const adminContentInvalidates = (result, error, { resource } = {}) => [
  { type: "AdminContent", id: resource },
  { type: "PublicContent", id: resource },
  ...(resource === "events"
    ? [
        { type: "PublicContent", id: "hackathon" },
        { type: "PublicContent", id: "hackathon-problem-set" },
        // ⚠️ AN EVENTS WRITE NOW CHANGES PARTICIPATION STATE, so the participation
        // caches have to be evicted too. This is the third consumer of the six
        // participation fields and it was added last, which means it is the one at
        // risk of being forgotten: an admin switching "in-app registration" on
        // presses Save, sees a success toast, and the very next click still shows
        // the closed window — because `GET /participation/events/:eventId` is
        // cached under its own tag and nothing invalidated it.
        //
        // `'Participation'` (no id) evicts EVERY participation entry, which is
        // broader than strictly necessary — a single event's window would do. That
        // is the right trade here: an admin events write is rare, the extra
        // refetches are two small anonymous GETs, and the alternative is a flat
        // tag design that has to be reasoned about per endpoint. A per-event write
        // (the review mutation) uses precise ids and is unaffected.
        "Participation",
      ]
    : []),
  "AdminOverview",
];

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
      invalidatesTags: adminContentInvalidates,
    }),
    updateAdminContent: builder.mutation({
      query: ({ resource, id, body }) => ({
        url: `/admin/content/${resource}/${id}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: adminContentInvalidates,
    }),
    deleteAdminContent: builder.mutation({
      query: ({ resource, id }) => ({
        url: `/admin/content/${resource}/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: adminContentInvalidates,
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
