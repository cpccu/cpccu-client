import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';


const baseUrl = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000/api/v1';
export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({ baseUrl, prepareHeaders: (headers) => {
    headers.set('Content-Type', 'application/json');
  }}),
  tagTypes: ['Auth', 'Users', 'Posts'],
  endpoints: () => ({})
});


