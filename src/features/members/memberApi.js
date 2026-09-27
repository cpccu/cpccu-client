import { baseApi } from "@/services/baseApi";

export const memberApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    // The only member read: the directory LIST. The migrated API serves
    // `GET /api/v1/users/member` and nothing per-id beneath it.
    fetchMembers: builder.query({
        query: () => 'users/member',

    }),
    // NOTE: `fetchMemberById` (`GET /users/member/:id`) is deliberately absent.
    // That route exists in NEITHER backend. It was also unusable as written: it
    // declared `providesTags: [{ type: 'Members', id }]`, and `'Members'` is not
    // in `baseApi.js`'s `tagTypes`, so RTK Query throws on the unknown tag type
    // the moment the endpoint is actually used. A single member's public data is
    // fetched by id through `userApi`'s `fetchUserById` instead. Do not
    // reintroduce this without both a real route and a registered tag type.
  }),
});

export const { useFetchMembersQuery } = memberApi;