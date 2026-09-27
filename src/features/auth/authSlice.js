import { createSlice } from "@reduxjs/toolkit";

// THERE IS NO `token` IN THIS SLICE, AND THAT IS THE MODEL, NOT AN OMISSION.
//
// The `accessToken` / `refreshToken` JWTs live only in `httpOnly` cookies
// (`src/lib/server/constants.js` — `COOKIE_OPTIONS`). `httpOnly` means this
// slice CANNOT read them, which is the point: a token that script cannot read
// cannot be stolen by an XSS. The previous shape kept a third copy in
// `localStorage` and had `baseApi.js` attach it as `Authorization: Bearer`,
// so the browser held a session credential that any injected script could read
// and exfiltrate, and the cookie that could not be read was ignored.
//
// CONSEQUENCE FOR THIS SLICE: `user` is no longer a client-side assertion of
// "am I logged in", it is a CACHE of what `GET /users/user` last returned.
// `setCredentials` is only ever dispatched with a user the server just
// authenticated, and `clearCredentials` is dispatched on a 401. `hydrated` — not
// `token` — is what tells the rest of the app the server has had its say.
const initialState = {
  user: null,
  loading: false,
  error: null,
  hydrated: false,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setCredentials: (state, action) => {
      // Only `user` is destructured. Callers that previously passed
      // `{ user, token }` were re-storing a value they can no longer read.
      const { user } = action.payload;

      state.user = user;
      state.loading = false;
      state.error = null;
      state.hydrated = true;

      // NO `localStorage.setItem("user", …)` HERE ANY MORE — REMOVED 2026-09.
      //
      // It used to sit here, justified as "a CACHE, not a credential: it exists
      // so a first paint can show the right nav without waiting for the round
      // trip". THAT BENEFIT DID NOT EXIST, AND THE JUSTIFICATION IS WHY IT
      // SURVIVED REVIEW. A repo-wide search for a reader found none: the only
      // `localStorage.getItem` calls in `src/` are a COMMENTED-OUT read of
      // `"token"` in `ProviderWrapper.js` and an unrelated `VISITOR_KEY` read in
      // `VisitorCounter.jsx`. Nothing ever read `"user"` back, so the write cost
      // a `JSON.stringify` of the whole user document on every login and every
      // profile save, and bought nothing.
      //
      // WHAT IT ACTUALLY COST, which is the reason it is not simply harmless
      // redundancy. It wrote `email`, `phone`, `uniID`, `roles` and both
      // Cloudinary `*PublicId` write primitives into a store that ANY XSS on the
      // origin can read. That is not a credential, and it is exactly the class of
      // exposure the `httpOnly` move was made to eliminate — the same data, in a
      // place the cookie migration deliberately emptied. The `httpOnly` cookies
      // are unreadable by script; this write put the profile back into script's
      // reach on every login.
      //
      // THE FIRST-PAINT ARGUMENT DOES NOT SURVIVE CONTACT WITH THE CODE. The
      // auth hydrator reads from the SERVER (`GET /users/user`), so a nav that
      // needed the cached copy would have had to read it — and there is no such
      // read, because nothing renders before the hydrator resolves in any case
      // (`hydrated`, not a cached `user`, is what the app waits on). A comment
      // asserting a benefit that no code depends on is worse than no comment: it
      // makes dead persistence look intentional, so the next reviewer reads past
      // it. If a first-paint optimisation is ever wanted, it belongs as an
      // explicit read with a measured reason — not as an invisible write.
    },

    clearCredentials: (state) => {
      state.user = null;
      state.loading = false;
      state.error = null;
      state.hydrated = true;

      // BOTH `removeItem` CALLS ARE ONE-TIME SCRUBS AND BOTH ARE KEPT, AND NEITHER
      // IS ABOUT THE CURRENT BUILD. Any browser that ran a pre-cutover build has
      // a `"token"` key sitting in `localStorage` holding a valid seven-day access
      // token; leaving it there means the XSS it was stored for still works
      // against users who never re-login. Removing it on the first post-cutover
      // sign-out is the cheapest point at which to scrub it, so this line is the
      // ONLY reason that credential does not survive the cutover — it must not be
      // "tidied up" as dead code.
      //
      // `"user"` IS NOW SCRUBBED RATHER THAN WRITTEN, which is a change in kind
      // rather than a leftover: `setCredentials` no longer persists it, so this
      // `removeItem` no longer has a matching `setItem` in this build, and its
      // whole purpose is to delete the PII (`email`, `phone`, `uniID`, `roles`)
      // that EARLIER builds of this same app left behind. It is kept for exactly
      // the same reason as the `"token"` scrub one line below it, and for the
      // same reason as the removal of the write above: the data should not be in
      // `localStorage`, and the first time any user signs out is the cheapest
      // moment to take it back out.
      if (typeof window !== "undefined") {
        localStorage.removeItem("user");
        localStorage.removeItem("token");
      }
    },

    setHydrated: (state) => {
      state.hydrated = true;
    },
  },
});

export const { setCredentials, clearCredentials, setHydrated } =
  authSlice.actions;

export default authSlice.reducer;
