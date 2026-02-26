import { baseApi } from "@/services/baseApi";

export const userApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    fetchUsers: builder.query({
        query: () => '/users',
        providesTags: ['Users'],
    }),
    fetchUserById: builder.query({
        query: (id) => `/users/${id}`,
        providesTags: (result, error, id) => [{ type: 'Users', id }],
    }),
    createUser: builder.mutation({
        query: (userData) => ({
            url: '/users',
            method: 'POST',
            body: userData,
        }),
        invalidatesTags: ['Users'],
    }),
    updateUser: builder.mutation({
        query: ({ id, ...userData }) => ({
            url: `/users/${id}`,
            method: 'PUT',
            body: userData,
        }),
        invalidatesTags: (result, error, { id }) => [{ type: 'Users', id }],
    }),
    deleteUser: builder.mutation({
        query: (id) => ({
            url: `/users/${id}`,
            method: 'DELETE',
        }),
        invalidatesTags: (result, error, id) => [{ type: 'Users', id }],
    }),
  }),
});


export const {
  useFetchUsersQuery,
  useFetchUserByIdQuery,
    useCreateUserMutation,
    useUpdateUserMutation,
    useDeleteUserMutation,
} = userApi;