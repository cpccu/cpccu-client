import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';


const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000/api/v1';
export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({ baseUrl,
    credentials: 'include',
     prepareHeaders: (headers, { getState, endpoint }) => {
    const token = getState().auth.token;
    if (endpoint !== 'userImageUpload') {
      headers.set('Content-Type', 'application/json');
    }
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    return headers;
  }}),
  tagTypes: ['Auth', 'Users', 'Posts'],
  endpoints: () => ({})
});


