import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';


// The API is SAME-ORIGIN: this app serves its own backend from 53 route
// handlers under `src/app/api/**`, so the base path is a relative `/api/v1` and
// nothing else.
//
// WHY THIS IS A HARDCODED LITERAL AND NOT AN ENVIRONMENT VARIABLE. Three
// reasons, each of which alone is enough:
//
//   1. THE API IS IN THIS APP. There is no second origin to configure. An
//      absolute origin is not configuration here, it is a liability: any
//      absolute value that disagrees with the deployment host turns every
//      request into a cross-origin one, which is exactly what the
//      same-origin cookie + CSRF design in `src/lib/server/request.js` assumes
//      cannot happen.
//   2. `NEXT_PUBLIC_*` IS INLINED AT BUILD TIME by Next.js, not read at
//      runtime. Editing such a variable therefore requires a REBUILD; an edit
//      that looks applied is not applied to any already-built bundle. The
//      previous five-site form (`baseApi.js`, `certificate-metadata.js`,
//      `BootcampLeaderboard.jsx`, `VisitorCounter.jsx`, and the deleted
//      `publicApi`) had to be changed in ONE COMMIT for that reason — leave one
//      and the stale origin is baked into the bundle with no runtime error.
//   3. THE `||` TRAP, WHICH IS WHY THE ENV READ IS DELETED RATHER THAN SWAPPED
//      FOR `??`. A present-but-EMPTY `NEXT_PUBLIC_API_BASE_URL=` is falsy, so
//      the `||` fell straight through to a hardcoded absolute URL pointing at
//      the retired Express app's local development port — cross-origin, in
//      PRODUCTION, from a variable that was visibly set and visibly correct.
//      That is a silent total failure: no build error, no dev warning, every
//      request rejected at a host that no longer exists. `??` would NOT have
//      fixed it — `''` is neither null nor undefined, so `??` would have kept
//      the empty string as the base URL instead. The only correct fix is to have
//      no env read at all, which is what the literal above is.
//
// `test/client-endpoint-parity.test.js` enforces both halves of this: the base
// path below is asserted to be exactly `/api/v1`, and this file is asserted to
// contain no environment read at all. Neither check can be satisfied by a
// comment, so the reasoning above cannot rot into a claim the code no longer
// makes. That test also asserts that no file under `src/` still names the
// retired origins — which is why the literals are described in prose above
// rather than quoted.
const baseUrl = '/api/v1';

export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl,
    // RETAINED DELIBERATELY, and it is a no-op for the same-origin requests
    // this app now makes. `include` is what a same-origin request does anyway;
    // removing it buys nothing today. It is kept because it is the one line
    // that keeps this `fetchBaseQuery` correct if `baseUrl` above is ever
    // pointed at a different origin, and deleting it would trade a harmless
    // no-op for a hard-to-diagnose "credentials missing" failure on the day
    // that happens. Cost of keeping: zero. Cost of removing it and needing it
    // back: a silent auth failure across the whole app.
    credentials: 'include',
    prepareHeaders: (headers, { endpoint }) => {
      // For image uploads, we don't set Content-Type to let the browser set it with the boundary
      if (!['userImageUpload', 'uploadAdminImage'].includes(endpoint)) {
        headers.set('Content-Type', 'application/json');
      }
      // NO `Authorization: Bearer` HEADER ANY MORE, AND THERE IS NO CLIENT-SIDE
      // TOKEN TO SEND. The `httpOnly` `accessToken` cookie is the credential;
      // `src/lib/server/auth.js:75-76` reads the cookie FIRST and only falls
      // back to the `Authorization` header when the cookie is absent, so the
      // header this block used to attach was always redundant on a same-origin
      // request. It became actively harmful when paired with a `localStorage`
      // token: a token readable by any XSS was being handed to the server on
      // every call while the un-readable cookie was already sufficient. The
      // server is now the only authority on who the caller is, which is the
      // entire point of `httpOnly`.
      return headers;
    },
  }),
  tagTypes: ['Auth', 'Users', 'Posts', 'Projects', 'PublicContent', 'AdminOverview', 'AdminMembers', 'AdminContent', 'AdminContributors', 'AdminStatistics', 'AdminCertificates', 'AdminSystemSettings', 'AdminRoles'],
  endpoints: () => ({})
});

// DO NOT "FIX" THE `injectEndpoints` DUPLICATE-ENDPOINT ERROR WITH
// `overrideExisting: true`. That flag is the tempting one-word patch and it is
// the wrong one, so this is recorded here rather than left to be rediscovered.
//
// WHAT THE ERROR IS. Under `next dev`, editing any `*Api.js` slice makes Fast
// Refresh re-execute THAT slice's module body while `baseApi`'s module instance
// is retained (Turbopack invalidates and re-runs the changed module only). The
// body therefore calls `baseApi.injectEndpoints` a second time against an
// instance that already holds those endpoint names, and RTK Query throws in dev
// for each of them. It is a DEV-ONLY Fast Refresh artefact: a cold `next dev`
// with no edits evaluates every slice exactly once and is silent.
//
// WHY `overrideExisting: true` IS THE WRONG FIX. It does not address a cause, it
// deletes the only signal that a module body ran twice. That signal is load
// bearing precisely because the failure mode it would hide is the one described
// in the `store.js` / `rootReducer.js` notes: two identities of this module
// means two `createApi` instances, and the second one's slice injection would
// then silently succeed while writing into a DIFFERENT cache behind a DIFFERENT
// middleware — so `resetApiState()`, `invalidateTags`, `refetch` and every hook
// bound to the first instance would quietly stop affecting the second, and the
// bug would surface as stale UI rather than as a console error. Trading a loud
// dev-time error for a silent cache-coherence bug is a bad trade.
//
// (For the record: the flag would in fact be *safe in this repository today*,
// because there is exactly one `createApi` call in `src/` and exactly two
// Turbopack identities for this module — `[app-client]` and `[app-ssr]` — so no
// second cache can exist. It is still not added: it buys nothing against the
// HMR artefact, and leaving it out keeps the invariant checkable.)
//
// The actual remedy for the artefact is to reload the page after editing a
// slice, or to restart `next dev`. It is noise, not a defect.


