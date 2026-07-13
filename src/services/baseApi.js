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
  tagTypes: ['Auth', 'Users', 'Posts', 'Projects', 'PublicContent', 'AdminOverview', 'AdminMembers', 'AdminContent', 'AdminStatistics', 'AdminCertificates', 'AdminSystemSettings'],
  endpoints: () => ({})
});


