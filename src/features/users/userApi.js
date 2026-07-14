import { baseApi } from "@/services/baseApi";

export const userApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    fetchUsers: builder.query({
      query: () => "/users/user",
      providesTags: ["Users"],
    }),
    fetchUserById: builder.query({
      query: (id) => `/users/user/${id}`,
      providesTags: (result, error, id) => [{ type: "Users", id }],
    }),
    createUser: builder.mutation({
      query: (userData) => ({
        url: "/users/user",
        method: "POST",
        body: userData,
      }),
      invalidatesTags: ["Users"],
    }),
    updateUser: builder.mutation({
      query: ({ userData }) => ({
        url: "users/userInfo-update",
        method: "PATCH",
        body: userData,
      }),
      invalidatesTags: (result, error, arg) => [
        "Auth",
        { type: "Users", id: result?._id },
        { type: "Users", id: arg?.id },
      ],
    }),
    userImageUpload: builder.mutation({
      query: ({ key, imageData }) => ({
        url: `users/user/upload-image/${key}`,
        method: "PATCH",
        body: imageData,
      }),
      invalidatesTags: ["Auth", "Users"],
    }),
    requestJobPipelineProfile: builder.mutation({
      query: (body = {}) => ({
        url: "users/job-pipeline-request",
        method: "POST",
        body,
      }),
      invalidatesTags: [
        "Auth",
        "Users",
        { type: "PublicContent", id: "profiles" },
      ],
    }),
    removeJobPipelineProfile: builder.mutation({
      query: () => ({
        url: "users/job-pipeline-request",
        method: "DELETE",
      }),
      invalidatesTags: [
        "Auth",
        "Users",
        { type: "PublicContent", id: "profiles" },
      ],
    }),
    deleteUser: builder.mutation({
      query: (id) => ({
        url: `/users/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: (result, error, id) => [{ type: "Users", id }],
    }),
    changePassword: builder.mutation({
      query: (body) => ({
        url: "/users/password",
        method: "PATCH",
        body,
      }),
      invalidatesTags: ["Auth"],
    }),
    deleteOwnAccount: builder.mutation({
      query: () => ({
        url: "/users/user",
        method: "DELETE",
      }),
      invalidatesTags: ["Auth", "Users"],
    }),
    // Project CRUD
    getProjects: builder.query({
      query: () => "/projects",
      providesTags: ["Projects"],
    }),
    getPublicProjects: builder.query({
      query: (userId) => `/projects/user/${userId}`,
      providesTags: (result, error, userId) => [{ type: "Projects", id: userId }],
    }),
    createProject: builder.mutation({
      query: (projectData) => ({
        url: "/projects",
        method: "POST",
        body: projectData,
      }),
      invalidatesTags: ["Projects"],
    }),
    updateProject: builder.mutation({
      query: ({ id, ...projectData }) => ({
        url: `/projects/${id}`,
        method: "PATCH",
        body: projectData,
      }),
      invalidatesTags: ["Projects"],
    }),
    deleteProject: builder.mutation({
      query: (id) => ({
        url: `/projects/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Projects"],
    }),
  }),
});

export const {
  useFetchUsersQuery,
  useFetchUserByIdQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
  useUserImageUploadMutation,
  useRequestJobPipelineProfileMutation,
  useRemoveJobPipelineProfileMutation,
  useDeleteUserMutation,
  useChangePasswordMutation,
  useDeleteOwnAccountMutation,
  useGetProjectsQuery,
  useGetPublicProjectsQuery,
  useCreateProjectMutation,
  useUpdateProjectMutation,
  useDeleteProjectMutation,
} = userApi;
