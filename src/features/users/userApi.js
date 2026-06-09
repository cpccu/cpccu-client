import { baseApi } from "@/services/baseApi";

export const userApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    fetchUsers: builder.query({
        query: () => '/users/user',
        providesTags: ['Users'],
    }),
    fetchUserById: builder.query({
        query: (id) => `/users/user/${id}`,
        providesTags: (result, error, id) => [{ type: 'Users', id }],
    }),
    createUser: builder.mutation({
        query: (userData) => ({
            url: '/users/user',
            method: 'POST',
            body: userData,
        }),
        invalidatesTags: ['Users'],
    }),
    updateUser: builder.mutation({
        query: (userData) => ({
            url: `users/userInfo-update`,
            method: 'PATCH',
            body: userData,
        }),
        invalidatesTags: (result, error, { id }) => [{ type: 'Users', id }],
    }),
    userImageUpload: builder.mutation({
        query: ({ key, imageData }) => ({
            url: `users/user/upload-image/${key}`,
            method: 'PATCH',
            body: imageData,
        }),
        invalidatesTags: ['Users'],
    }),
    deleteUser: builder.mutation({
        query: (id) => ({
            url: `/users/${id}`,
            method: 'DELETE',
        }),
        invalidatesTags: (result, error, id) => [{ type: 'Users', id }],
    }),
    changePassword: builder.mutation({
        query: (body) => ({
            url: '/users/password',
            method: 'PATCH',
            body,
        }),
    }),
    deleteOwnAccount: builder.mutation({
        query: () => ({
            url: '/users/user',
            method: 'DELETE',
        }),
        invalidatesTags: ['Users', 'Auth'],
    }),
  }),
});


export const {
  useFetchUsersQuery,
  useFetchUserByIdQuery,
    useCreateUserMutation,
    useUpdateUserMutation,
    useUserImageUploadMutation,
    useDeleteUserMutation,
    useChangePasswordMutation,
    useDeleteOwnAccountMutation,
} = userApi;
