# CPCCU Frontend API Documentation

This document describes the API integrations currently used by `cpccu-client`. All paths are relative to the base URL `/api/v1`.

> **The API is this application.** The routes under `src/app/api/**` are Next.js App Router route handlers in this same repository, reached **same-origin**. There is no separate backend service, no second host, and no environment variable naming it.

> **Verified against source.** If a documented endpoint does not appear in the code below, it has been removed. `test/client-endpoint-parity.test.js` enforces the join between the two sides of this document: every URL declared under `src/features/**` and `src/lib/**` must resolve to a real `route.js` that exports the method the client uses.

## 1. Global Configuration

### 1.1 Main RTK Query Base API (`baseApi`)

Defined in `src/services/baseApi.js`.

- **Base URL**: `/api/v1` — a hard-coded **relative** literal. There is no environment variable for it; `NEXT_PUBLIC_API_BASE_URL` was deleted during the cutover and adding an env read back is a test failure.
- **Credentials**: `include`, so the browser attaches the `httpOnly` session cookies
- **Default Content-Type**: `application/json`
- **Authorization**: **none.** The client holds no token and attaches no `Authorization` header. The session is the `httpOnly` `accessToken` cookie, which the server reads before it will consider an `Authorization` header at all. See §1.3.
- **Multipart exceptions**: `Content-Type` is intentionally not forced for:
  - `userImageUpload`
  - `uploadAdminImage`
- **Tag Types**:
  ```
  Auth, Users, Posts, Projects, PublicContent, AdminOverview, AdminMembers,
  AdminContent, AdminContributors, AdminStatistics, AdminCertificates,
  AdminSystemSettings, AdminRoles
  ```

> The `Members` tag type is **not** registered in `baseApi.tagTypes`, and nothing declares it. It used to: `memberApi.fetchMemberById` provided `[{ type: 'Members', id }]`, which would have thrown on the unknown tag type the moment it was used. The endpoint is gone (§3), so the tag is gone with it. Use `Users` for anything member-shaped.

### 1.2 Public Certificate Verification — no separate instance

**There is no second API instance.** Certificate verification is reached through the same `baseApi` as every other endpoint; `grep -rn "createApi(" src/` returns exactly one hit, `src/services/baseApi.js`.

| Endpoint | Method | Auth |
| :--- | :--- | :--- |
| `/certificates/verify/:certificateId` | `GET` | None — the route handler is declared `public: true`, and being same-origin the request carries the session cookie whether or not the route needs it |

> **Historical note (removed during the Express → Next.js migration).** This section previously documented a `publicApi` instance defined in `src/features/certificate/certificateApi.js`, with a base URL derived by stripping `/api/v1` — `(NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000').replace('/api/v1', '')` — so it could hit the unauthenticated route `/verify/:certificateId` *without* auth headers, "hence the separate instance". **Why it existed:** the Express backend mounted verification at the **root** path, outside the `/api/v1` base URL every other endpoint used — `app.get('/verify/:certificateId', asyncHandler(verifyCertificatePublic))` at `cpccu-server/src/app.js:76`. With no `/api/v1` route for it, a second instance with a rewritten base URL was the only way to reach that one endpoint; its `useVerifyCertificatePublicQuery` hook had no call sites, and the instance was still wired into the store as an empty reducer plus a second middleware.
>
> **Why it is gone:** the migrated backend serves verification at `/api/v1/certificates/verify/:certificateId` on the ordinary base URL, and the root path is no longer served. The root path also **cannot** be migrated — `src/app/verify/[certificateId]/page.jsx` already occupies that segment and App Router forbids a `page.jsx` and a `route.js` at the same segment. The by-id route runs the same `verifyCertificatePublic` controller, so the response is unchanged. Both the instance and its store registration have been deleted.

### 1.3 The session model

This is the one thing to get right when reading the endpoint tables below.

- **The `httpOnly` cookie is the only credential.** `POST /auth/login` and `GET /auth/refresh-token` set the `accessToken` / `refreshToken` cookies and return **no token in the body** — the login response is `{ user }` and the refresh response is `{ success: true }`.
- **The client holds no token.** Nothing in `src/` stores a session credential. `localStorage` holds only a cached `user` object, and that is a cache for first paint, never proof of a session. The stale `token` key is actively deleted on sign-out, because any browser that ran a pre-cutover build still has a live seven-day access token sitting in storage.
- **`GET /users/user` is the sole authority on session identity.** `ProviderWrapper` calls it on every page load with no `skip` gate; a 200 supplies the user, and anything else (401, 403, 5xx) dispatches `clearCredentials`. A failing auth check *is* this endpoint 401ing — there is no other place to look.
- **CORS is not a concern and `Authorization` is not a client requirement.** The browser never makes a cross-origin API request. The server does still accept an `Authorization: Bearer` header as a fallback after the cookie, and uses its presence as the CSRF exemption for non-browser callers (`curl`, CLI clients, integration tests) — but the first-party web client attaches no such header, deliberately, so that no token readable by XSS is ever the credential.
- **Unsafe methods are CSRF-checked in-process**, by `assertSameOrigin` in `src/lib/server/request.js`, against an allow-list seeded from `WEB_DOMAIN` and `NEXT_PUBLIC_SITE_URL`. A browser sends `Sec-Fetch-Site: same-origin` on a same-origin `fetch`, so the first-party client passes; a cross-site request is 403 `Cross-origin request rejected`.

## 2. Authentication (`authApi`)

| Endpoint | Method | Purpose | Payload |
| :--- | :--- | :--- | :--- |
| `/auth/login` | `POST` | User login | `{ email, password }` |
| `/auth/register` | `POST` | New user registration | `userData` |
| `/auth/send-otp` | `POST` | Request registration OTP | `{ email }` |
| `/auth/verify-registration` | `POST` | Verify registration OTP | `{ email, otp }` |
| `/auth/logout` | `POST` | Logout current user/session — revokes this device's refresh token and clears the cookies | None |
| `/auth/reset-link` | `POST` | Send password reset link | `{ email }` |
| `/auth/reset-password` | `PATCH` | Reset password | `resetData` |
| `/users/user` | `GET` | Fetch current authenticated user (session validation) | None |

> **`/auth/logout` is `POST`, and was `GET` until the cutover.** `GET` is exempt from the CSRF check, so a cross-site top-level `GET` — an `<img src>`, a redirect, a `<link rel=prefetch>` — could force-log a victim out *and* revoke their refresh token for the full seven days it is scoped to. `POST` brings the endpoint under `assertSameOrigin` for the first time. The verb is declared in exactly one place on the client (`src/features/auth/authApi.js`) and `test/route-method-declaration.test.js` asserts the client and server halves cannot drift. There is no `GET` fallback and there must not be one.

> **`/auth/reset-link` is `POST` with the address in the body, and was `GET /auth/reset-link/:email` until the cutover.** Both halves mattered. `GET` is exempt from the CSRF check, and with the target address in the **path** a bare cross-site `<img src>` or top-level navigation was enough — no XHR, no CORS, no form, no credential. Every hit sent a real CPCCU-branded password-reset email to an attacker-chosen address: a mail-bomb and Resend sender-quota-burn primitive, and a phishing lure. A `POST` body cannot be produced by an image tag or a link, so `assertSameOrigin` is armed and can refuse the request before any mail goes out. `authEmailRateLimiter` (5 / 15 min) is **not** the control here — its store is in-memory and per-instance, so on Vercel every warm lambda keeps its own counter. The response is **byte-identical** for "no such account" and "sent", which is what keeps the endpoint from being an account-existence oracle; `test/auth-reset-link.test.js` asserts that on both paths. Timing still differs and is an accepted residual. There is no `GET` fallback and there must not be one — a `GET` could only read the address from the path, which is the exploitable half of the old design.

> The client calls **no** refresh-token endpoint and there is **no** Google OAuth (Firebase) flow. `GET /auth/refresh-token` exists server-side and is not called by this app: transparent renewal happens inside the server, which re-issues the access-token cookie on any request whose token has expired. Sessions are validated by `GET /users/user` on hydration, and the cookie — not anything in the response body or in `localStorage` — is the credential.

## 3. Users (`userApi`)

| Endpoint | Method | Purpose | Payload / Params |
| :--- | :--- | :--- | :--- |
| `/users/user` | `GET` | Fetch current authenticated user (session validation — same endpoint as `authApi.getCurrentUser`) | None |
| `/users/user/:id` | `GET` | Fetch user by ID | Path param: `id` |
| `users/userInfo-update` | `PATCH` | Update current user profile | `userData` |
| `users/user/upload-image/:key` | `PATCH` | Upload user image (avatar/cover by key) | `FormData` (`imageData`) |
| `users/job-pipeline-request` | `POST` | Request job pipeline profile | Optional body (`{ title }`) |
| `users/job-pipeline-request` | `DELETE` | Remove job pipeline profile request | None |
| `/users/password` | `PATCH` | Change current user password | `body` |
| `/users/user` | `DELETE` | Delete own account | None |

> Note: several `userApi` URLs omit the leading `/` (e.g. `users/userInfo-update`). This is functional but inconsistent with the rest of the codebase.
>
> ⚠️ **Removed dead definitions — do not reintroduce them.** `createUser` (`POST /users/user`), `deleteUser` (`DELETE /users/:id`) and `fetchMemberById` (`GET /users/member/:id`) were once declared here and had **no matching route in either backend**. All three are now **deleted**, with the reason recorded in place at `userApi.js:13` and `:71` and `memberApi.js:11`. Account self-service deletion is `DELETE /users/user` (it takes the id from the session, which is why it is safe); a single member's public data is `GET /users/user/:id` via `userApi`. (`GET /auth/refresh-token` likewise exists server-side and is never called by the client — see §2.)

### 3.1 Projects (`userApi`)

| Endpoint | Method | Purpose | Auth |
| :--- | :--- | :--- | :--- |
| `/projects` | `GET` | Fetch own projects | Required |
| `/projects` | `POST` | Create a new project | Required |
| `/projects/:id` | `PATCH` | Update own project | Required |
| `/projects/:id` | `DELETE` | Delete own project | Required |
| `/projects/user/:userId` | `GET` | Fetch public projects by user ID | No |

Tag: `Projects`.

## 4. Members (`memberApi`)

| Endpoint | Method | Purpose | Notes |
| :--- | :--- | :--- | :--- |
| `users/member` | `GET` | Fetch members (public fields) | The only member read. Returns the whole collection in one response, filtered server-side to `isValid: true` accounts and projected through the `PUBLIC_MEMBER_ITEM` allow-list. |

## 5. Certificates

### 5.1 Private (`certificateApi`, injected into `baseApi`)

| Endpoint | Method | Purpose | Params |
| :--- | :--- | :--- | :--- |
| `/certificates/verify` | `GET` | Search/verify certificates | Query params built from non-empty values: `certificateId`, `recipientName`, `recipientId` |
| `/certificates/stats` | `GET` | Fetch certificate statistics | None |
| `/certificates/recent` | `GET` | Fetch recently issued certificates | None |

**Certificate search behavior:**
- `certificateId` — exact match search
- `recipientName` — partial, case-insensitive match
- `recipientId` — case-insensitive match (used by the profile Certificates section with the member's `uniID`)
- Name and student ID searches can return multiple certificates.

> **Correction (cutover).** This line previously said the same `/certificates/verify?certificateId=...` endpoint is called server-side by `src/lib/certificate-metadata.js`. It no longer is. That module now reads the database directly through `src/lib/server/services/certificate.service.js` — an HTTP round trip to its own origin was a silent failure waiting to happen, because a wrong base URL did not throw: the fetch failed, the `catch` ran, and every certificate page silently degraded to `robots: { index: false, follow: false }` while the site served 200s and logged nothing. See also the note in ARCHITECTURE.md §8.1.

### 5.2 Public verification by ID (`certificateApi`, unauthenticated)

| Endpoint | Method | Purpose |
| :--- | :--- | :--- |
| `/certificates/verify/:certificateId` | `GET` | Public certificate verification by certificate ID |

> **Correction (migration cleanup).** This table previously read `### 5.2 Public (publicApi, unauthenticated)` with the row `/verify/:certificateId`. The endpoint is now reached through `certificateApi` on the normal `/api/v1` base URL, at the path above. The root `/verify/:certificateId` is gone and is not coming back: it would have to be `src/app/verify/[certificateId]/route.js`, and `src/app/verify/[certificateId]/page.jsx` already occupies that segment — App Router forbids a `page.jsx` and a `route.js` at the same segment, so the build fails. ⚠️ That also means the root path does **not** 404: it resolves to the client-side verification page and returns **HTML with HTTP 200**, which a JSON client will silently mis-parse. See §1.2 for the history of `publicApi`.

## 6. Content (`contentApi`)

| Endpoint | Method | Purpose | Notes |
| :--- | :--- | :--- | :--- |
| `/content/:resource` | `GET` | Fetch public content by resource key | Provides `PublicContent` tag with resource ID |
| `/content/statistics` | `GET` | Fetch public statistics payload | Provides `PublicContent:statistics` tag |

**Supported public resources** (backend `content.controller.js`): `alumni`, `committees`, `contributors`, `donators`, `events`, `gallery`, `gallery-events`, `profiles` (only **approved** developer profiles are returned)

## 7. Contact (`contactApi`)

| Endpoint | Method | Purpose | Payload |
| :--- | :--- | :--- | :--- |
| `/contact/messages` | `POST` | Submit contact message | `body` |

## 8. Admin (`adminApi`)

### 8.1 Overview

| Endpoint | Method | Purpose | Notes |
| :--- | :--- | :--- | :--- |
| `/admin/overview` | `GET` | Dashboard overview data (counts, charts, recent signals) | Provides `AdminOverview` tag |

### 8.2 Members

| Endpoint | Method | Purpose | Payload / Params | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `/admin/members` | `GET` | List admin-managed members | Optional query `params` | Provides `AdminMembers` tag |
| `/admin/members` | `POST` | Create member | `body` | Invalidates `AdminOverview`, `AdminMembers`, `Users` |
| `/admin/members/:id` | `PATCH` | Update member | Path param `id`, `body` | Invalidates `AdminOverview`, `AdminMembers`, `Users` |
| `/admin/members/:id` | `DELETE` | Delete member | Path param `id` | Invalidates `AdminOverview`, `AdminMembers`, `Users` |

### 8.3 Content Management (generic)

| Endpoint | Method | Purpose | Payload / Params | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `/admin/content/:resource` | `GET` | Fetch admin content list for resource | Optional query `params` | Provides `AdminContent` tag with resource ID |
| `/admin/content/:resource` | `POST` | Create content item | `body` | Invalidates `AdminContent`, `PublicContent`, `AdminOverview` |
| `/admin/content/:resource/:id` | `PATCH` | Update content item | Path param `id`, `body` | Invalidates `AdminContent`, `PublicContent`, `AdminOverview` |
| `/admin/content/:resource/:id` | `DELETE` | Delete content item | Path param `id` | Invalidates `AdminContent`, `PublicContent`, `AdminOverview` |

**Supported generic content resources** (used by admin modules): `committees`, `contributors`, `donators`, `events`, `gallery`, `gallery-events`, `messages`, `posts`, `profiles`, `alumni`, `audit-logs`

### 8.4 Role Management (dynamic official roles)

| Endpoint | Method | Purpose | Notes |
| :--- | :--- | :--- | :--- |
| `/admin/roles` | `GET` | List all dynamic roles | Provides `AdminRoles` tag |
| `/admin/roles` | `POST` | Create a new role | |
| `/admin/roles/active` | `GET` | List only active roles | |
| `/admin/roles/:id` | `PATCH` | Update a role | |
| `/admin/roles/:id/toggle` | `PATCH` | Toggle role active/inactive | |

### 8.5 File Upload

| Endpoint | Method | Purpose | Payload | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `/admin/uploads/image` | `POST` | Upload admin image asset to Cloudinary | Multipart `body` | Used by gallery, events, committees, contributors, donators, alumni, posts |

### 8.6 Statistics

| Endpoint | Method | Purpose | Payload | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `/admin/statistics` | `GET` | Fetch live derived site statistics — `{ members, photos, events, totalVisitors, certificatesIssued, certificateVerifications, failedCertificateVerifications, contestsHeld, winnersRecognized }` — computed server-side from real data (members, gallery, events, visitor counter, certificates, verification logs). Read-only; there is no `PATCH /admin/statistics`. | None | Provides `AdminStatistics` tag |
| `/content/statistics` | `GET` | Public site statistics — same live values as the admin endpoint | None | Public |

### 8.7 GitHub-Synced Contributors (admin)

| Endpoint | Method | Purpose | Payload | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `/admin/contributors` | `GET` | List contributors — backend reads `data/contributors.json` live from GitHub (Contents API) | None | Provides `AdminContributors` tag; requires `CONTRIBUTOR_GITHUB_TOKEN` on the backend (503 otherwise) |
| `/admin/contributors/:githubUsername` | `PATCH` | Update contributor metadata — **only `batch` and `linkedin`** are writable; written back to `data/contributors.json` on the `release` branch | `{ batch?, linkedin? }` (at least one required) | Invalidates `AdminContributors`; admin-only; 404 if the username is not in the file |

### 8.8 System Settings

| Endpoint | Method | Purpose | Payload | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `/admin/system-settings` | `GET` | Fetch system settings | None | Provides `AdminSystemSettings` tag |
| `/admin/system-settings` | `PATCH` | Update system settings | `body` | Invalidates `AdminSystemSettings` tag |

**System settings include**: site metadata, maintenance mode, appearance settings.

### 8.9 Certificates

| Endpoint | Method | Purpose | Payload | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `/admin/certificates` | `GET` | Fetch certificates for admin panel | None | Provides `AdminCertificates` tag |
| `/admin/certificates` | `POST` | Create certificate | `body` | Invalidates `AdminCertificates`, `AdminOverview` |
| `/admin/certificates/:id` | `PATCH` | Update certificate | Path param `id`, `body` | Invalidates `AdminCertificates` |
| `/admin/certificates/:id` | `DELETE` | Delete certificate | Path param `id` | Invalidates `AdminCertificates`, `AdminOverview` |

## 9. Direct Fetch Integrations (Non-RTK Query)

Three sites bypass RTK Query. Two are raw `fetch` from a Client Component; the third no longer makes an HTTP request at all.

| Location | Endpoint | Method | Purpose |
| :--- | :--- | :--- | :--- |
| `src/components/HOME/VisitorCounter.jsx` | `/api/v1/visitor` | `GET` | Fetch total visitor count |
| `src/components/HOME/VisitorCounter.jsx` | `/api/v1/visitor/increment` | `POST` | Increment visitor count (throttled to once per hour via a `localStorage` timestamp) |
| `src/components/BOOTCAMPLEADERBOARD/BootcampLeaderboard.jsx` | `/api/v1/bootcamp-leaderboard` | `GET` | Fetch bootcamp leaderboard (`cache: no-store`) |
| `src/lib/certificate-metadata.js` | *(none — direct service call)* | — | Certificate detail page metadata, read from MongoDB via `verifyCertificateService` |

> All of these use the same **hard-coded relative** `/api/v1` literal. There is no environment variable and no fallback branch. `/api/visitor` and `/api/v1/visitor` are both served on the server as deliberate compatibility mounts, but the client now calls only the versioned one — the unversioned mount has no in-app consumer and is kept for external callers, not deleted.

## 10. Certificate Verification Logs

Certificate verification attempts (both public and authenticated) are logged server-side to `CertificateVerificationLog`. The statistics include:

- `certificateVerifications` — total successful verifications
- `failedCertificateVerifications` — failed verification attempts

## 11. Admin Audit Logs

Admin create/update/delete actions for generic content and certificates write to `AdminAuditLog`. These logs are visible at `/admin/audit-logs` (rendered via the generic content resource `audit-logs`) and store:

- Admin ID/name
- Action type (`create`, `update`, `delete`)
- Resource name
- Resource ID
- Summary of changes

## 12. Cache Invalidation Strategy

RTK Query tag types are used for cache invalidation:

- **Auth operations** invalidate `Auth`, which triggers re-fetch of the current user.
- **User mutations** invalidate `Auth` and `Users` tags to keep member lists and profile data fresh.
- **Admin content mutations** invalidate `AdminContent`, `PublicContent`, and `AdminOverview` to keep both admin and public views in sync.
- **Statistics mutations** invalidate `AdminStatistics` and `PublicContent:statistics`.
- **System settings mutations** invalidate `AdminSystemSettings`.
- **Admin role mutations** invalidate `AdminRoles`.
- **Project mutations** invalidate `Projects`.
