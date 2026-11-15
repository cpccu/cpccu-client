import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { setCsrfToken } from '@/features/auth/authSlice';

const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000/api/v1';
const rawBaseQuery = fetchBaseQuery({
  baseUrl,
  credentials: 'include',
  prepareHeaders: (headers, { getState, endpoint }) => {
    const token = getState().auth.token;
    if (!['userImageUpload', 'uploadAdminImage'].includes(endpoint)) {
      headers.set('Content-Type', 'application/json');
    }
    if (token) headers.set('Authorization', `Bearer ${token}`);
    return headers;
  },
});

const stateChangingGetPaths = [
  '/auth/logout',
  '/auth/refresh-token',
  '/auth/reset-link/',
  '/users/user',
];

const needsCsrfToken = ({ url, method = 'GET' }) => {
  const verb = method.toUpperCase();
  return !['GET', 'HEAD', 'OPTIONS'].includes(verb) ||
    (verb === 'GET' && stateChangingGetPaths.some((path) =>
      path.endsWith('/') ? url.startsWith(path) : url === path
    ));
};

const fetchCsrfToken = async (api, extraOptions) => {
  const result = await rawBaseQuery('/auth/csrf-token', api, extraOptions);
  const token = result.data?.data?.csrfToken;
  if (token) api.dispatch(setCsrfToken(token));
  return { result, token };
};

const baseQuery = async (args, api, extraOptions) => {
  const request = typeof args === 'string' ? { url: args } : { ...args };
  if (!needsCsrfToken(request)) return rawBaseQuery(args, api, extraOptions);

  let csrfToken = api.getState().auth.csrfToken;
  if (!csrfToken) {
    const fetched = await fetchCsrfToken(api, extraOptions);
    if (fetched.result.error) return fetched.result;
    csrfToken = fetched.token;
    if (!csrfToken) {
      return {
        error: {
          status: 'CUSTOM_ERROR',
          error: 'The server did not return a CSRF token.',
        },
      };
    }
  }

  const headers = new Headers(request.headers);
  headers.set('X-CSRF-Token', csrfToken);
  let result = await rawBaseQuery({ ...request, headers }, api, extraOptions);

  if (
    result.error?.status === 403 &&
    result.error.data?.code === 'CSRF_TOKEN_INVALID'
  ) {
    const fetched = await fetchCsrfToken(api, extraOptions);
    if (fetched.result.error) return fetched.result;
    if (fetched.token) {
      headers.set('X-CSRF-Token', fetched.token);
      result = await rawBaseQuery({ ...request, headers }, api, extraOptions);
    }
  }

  return result;
};

export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery,
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
  tagTypes: ['Auth', 'Users', 'Posts', 'Projects', 'PublicContent', 'Participation', 'AdminOverview', 'AdminMembers', 'AdminContent', 'AdminContributors', 'AdminStatistics', 'AdminCertificates', 'AdminSystemSettings', 'AdminRoles', 'AdminCertificateOptions'],
  endpoints: () => ({})
});


