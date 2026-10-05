import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';


const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000/api/v1';
export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({ baseUrl,
    credentials: 'include',
    prepareHeaders: (headers, { getState, endpoint }) => {
      const token = getState().auth.token;
      // For image uploads, we don't set Content-Type to let the browser set it with the boundary
      if (!['userImageUpload', 'uploadAdminImage'].includes(endpoint)) {
        headers.set('Content-Type', 'application/json');
      }
      // Always set Authorization if token exists
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      return headers;
    },
  }),
  // ⚠️ `Participation` IS A NEW TAG TYPE, ADDED FOR THE EVENT PARTICIPATION
  // FEATURE, and it exists for one specific reason: a registration is written on
  // ONE screen and read on another.
  //
  // The member registers at `/event/<id>/register` and is then redirected to
  // `/event/<id>/submit`, which has to know that a registration now exists AND
  // what its id is. Without a tag, the second screen issues its own
  // `GET /me/registrations` and depends on the first one's cache entry having
  // expired — i.e. on `keepUnusedDataFor`, a 60-second default that is a
  // performance setting, not a correctness mechanism. A redirect that
  // intermittently says "you have not registered yet" straight after a successful
  // registration is precisely the class of bug that cannot be reproduced on
  // demand and therefore never gets fixed.
  //
  // ⚠️ THE TAG IDS ARE COMPOSITE (`mine`, `reg:<id>`, `submission:<id>`,
  // `window:<eventId>`) RATHER THAN ONE FLAT `'Participation'`, because several
  // of these are read on the same screen at the same time and evicting one must
  // not evict the others. `window:<eventId>` in particular is ANONYMOUS public
  // data containing no participant information, while `mine` is private: a flat
  // tag would let a registration write evict the public window and trigger a
  // refetch of a page the member never asked to reload. The full id scheme is
  // documented in `features/participation/participationApi.js`.
  tagTypes: ['Auth', 'Users', 'Posts', 'Projects', 'PublicContent', 'Participation', 'AdminOverview', 'AdminMembers', 'AdminContent', 'AdminContributors', 'AdminStatistics', 'AdminCertificates', 'AdminSystemSettings', 'AdminRoles'],
  endpoints: () => ({})
});


