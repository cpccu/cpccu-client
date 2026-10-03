# CPCCU Frontend API Documentation

This document describes the API integrations currently used by `cpccu-client`. All paths are relative to the backend base URL.

> **Verified against source.** If a documented endpoint does not appear in the code below, it has been removed.

## 1. Global Configuration

### 1.1 Main RTK Query Base API (`baseApi`)

Defined in `src/services/baseApi.js`.

- **Base URL**: `NEXT_PUBLIC_API_BASE_URL` (fallback: `http://localhost:5000/api/v1`)
- **Credentials**: `include`
- **Default Content-Type**: `application/json`
- **Authorization**: `Bearer <token>` is automatically attached when `auth.token` exists
- **Multipart exceptions**: `Content-Type` is intentionally not forced for:
  - `userImageUpload`
  - `uploadAdminImage`
- **Tag Types**:
  ```
  Auth, Users, Posts, Projects, PublicContent, AdminOverview, AdminMembers,
  AdminContent, AdminContributors, AdminStatistics, AdminCertificates,
  AdminSystemSettings, AdminRoles, Participation
  ```

> ⚠️ `memberApi.js` provides a `Members` tag for `fetchMemberById`, but `Members` is **not** registered in `baseApi.tagTypes`.

### 1.2 Public Certificate API (`publicApi`)

Defined in `src/features/certificate/certificateApi.js` (separate `createApi` instance).

- **Base URL derivation**: `(NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000').replace('/api/v1', '')`
- Used for the unauthenticated certificate verification route `/verify/:certificateId`.
- Runs without authentication headers, hence the separate instance.

## 2. Authentication (`authApi`)

| Endpoint | Method | Purpose | Payload |
| :--- | :--- | :--- | :--- |
| `/auth/login` | `POST` | User login | `{ email, password }` |
| `/auth/register` | `POST` | New user registration | `userData` |
| `/auth/send-otp` | `POST` | Request registration OTP | `{ email }` |
| `/auth/verify-registration` | `POST` | Verify registration OTP | `{ email, otp }` |
| `/auth/logout` | `GET` | Logout current user/session | None |
| `/auth/reset-link/:email` | `GET` | Send password reset link | Path param: encoded `email` |
| `/auth/reset-password` | `PATCH` | Reset password | `resetData` |
| `/users/user` | `GET` | Fetch current authenticated user (session validation) | None |

> There is **no** refresh-token endpoint and **no** Google OAuth (Firebase) flow on the frontend. The access token is stored in `localStorage` and attached as a `Bearer` token; sessions are validated by `GET /users/user` on hydration.

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
> ⚠️ **Dead client-side definitions (no matching backend route):** `createUser` (`POST /users/user`) and `deleteUser` (`DELETE /users/:id`) in `userApi.js`, and `fetchMemberById` (`GET /users/member/:id`) in `memberApi.js`. The backend has no such routes — these are unused leftovers. (The backend's `GET /auth/refresh-token` likewise exists but is never called by the frontend.)

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
| `users/member` | `GET` | Fetch members (public fields) | — |
| `/users/member/:id` | `GET` | ⚠️ **Dead** — no backend route; provides a `Members` tag (not registered in `baseApi.tagTypes`) |

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

The same `/certificates/verify?certificateId=...` endpoint is called server-side by `src/lib/certificate-metadata.js` to generate dynamic metadata for `/certificate/[certificateId]` pages.

### 5.2 Public (`publicApi`, unauthenticated)

| Endpoint | Method | Purpose |
| :--- | :--- | :--- |
| `/verify/:certificateId` | `GET` | Public certificate verification by certificate ID |

## 6. Content (`contentApi`)

| Endpoint | Method | Purpose | Notes |
| :--- | :--- | :--- | :--- |
| `/content/:resource` | `GET` | Fetch public content by resource key | Provides `PublicContent` tag with resource ID |
| `/content/statistics` | `GET` | Fetch public statistics payload | Provides `PublicContent:statistics` tag |
| `/content/hackathon` | `GET` | Fetch the current hackathon | Provides `PublicContent:'hackathon'` tag. **404** when no hackathon is enabled — that 404 *is* the "not available" signal, which is why the nav bar needs no separate status endpoint |
| `/content/hackathon/problem-set` | `GET` | Fetch the problem-set URL | Provides `PublicContent:'hackathon-problem-set'` tag. Behind the backend's `verifyToken` **and** its start-time gate: `403` before the start, `404` when off or unset. Never part of the payload above |

**Supported public resources** (backend `content.controller.js` `publicModels`): `alumni`, `committees`, `contributors`, `donators`, `events`, `gallery`, `gallery-events`, `profiles` (only **approved** developer profiles are returned)

> ⚠️ **`hackathon` is NOT a `:resource` value.** It is not a key of the backend's `publicModels` map, and `GET /content/hackathon` is a dedicated fixed route on the content router (declared **above** the single-segment `/:resource` catch-all, which would otherwise swallow it and 404 from the wrong handler). The tag id is `'hackathon'`, not `'events'`: the record is an `Event`, but it is served over its own route with its own payload shape, so it gets its own cache entry.
>
> The generic `events` resource omits `type: 'hackathon'` documents and projects the gated `hackathonProblemSetUrl` field out of the result, so a hackathon never appears on `/event` or the homepage carousel.

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

| Location | Endpoint | Method | Purpose |
| :--- | :--- | :--- | :--- |
| `src/components/HOME/VisitorCounter.jsx` | `${NEXT_PUBLIC_API_BASE_URL}/visitor` (fallback `/api/visitor`) | `GET` | Fetch total visitor count |
| `src/components/HOME/VisitorCounter.jsx` | `${NEXT_PUBLIC_API_BASE_URL}/visitor/increment` | `POST` | Increment visitor count (throttled to once per hour via localStorage) |
| `src/components/BOOTCAMPLEADERBOARD/BootcampLeaderboard.jsx` | `${NEXT_PUBLIC_API_BASE_URL}/bootcamp-leaderboard` | `GET` | Fetch bootcamp leaderboard (`cache: no-store`) |
| `src/lib/certificate-metadata.js` | `${NEXT_PUBLIC_API_BASE_URL}/certificates/verify?certificateId=...` | `GET` | Server-side fetch for certificate detail page metadata |

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

### 12.1 The hackathon `invalidatesTags` coupling rule

`adminApi.js` uses a shared `adminContentInvalidates(result, error, { resource })` helper rather than a literal array, because `events` writes must invalidate **four** entries, not the usual three:

```
{ type: 'AdminContent',   id: resource }
{ type: 'PublicContent',  id: resource }          // the generic public list
{ type: 'PublicContent',  id: 'hackathon' }      // ← extra
{ type: 'PublicContent',  id: 'hackathon-problem-set' }  // ← extra
'AdminOverview'
```

⚠️ **Why the two extra entries are not optional.** The hackathon is an `Event` document, but it is published over its own two routes and cached under their own tag ids — not under `'events'`. Invalidating only `PublicContent: 'events'` leaves both hackathon cache entries stale after an events write, and the concrete failure is visible: an admin toggles the hackathon off, the write succeeds, and **the nav entry stays on screen** because the cached 200 that drives `requiresLiveHackathon` was never invalidated. The public page is equally stale in the other direction.

The rule generalises: **whenever an admin write changes data that is served over a route other than `/content/:resource`, that route's `PublicContent` tag id must be added to the invalidation set in the same change.** Adding a new public surface without the matching invalidation is a silent, cache-only bug — the request succeeds, the response is correct, and the UI lies.
- **Statistics mutations** invalidate `AdminStatistics` and `PublicContent:statistics`.
- **System settings mutations** invalidate `AdminSystemSettings`.
- **Admin role mutations** invalidate `AdminRoles`.
- **Project mutations** invalidate `Projects`.

## 13. Event Participation (`participationApi`)

Defined in `src/features/participation/participationApi.js` (injected into `baseApi`). All routes are JSON — there is **no `FormData`** on this surface (the server has no multer on this router). Responses are `ApiResponse` (`{ statusCode, data, message, success }`); failures are `{ status, message, errors }` with **no machine-readable error codes** — messages are written for participants and rendered verbatim via `getParticipationErrorMessage` (`src/lib/participation.js`).

### 13.1 Public (anonymous)

| Endpoint | Method | Purpose | Tag provided |
| :--- | :--- | :--- | :--- |
| `/participation/events/:eventId` | `GET` | The participation window for the event page (open/closed state, deadlines, team-size bounds) | `Participation: window:<eventId>` |
| `/participation/events/:eventId/winners` | `GET` | The published shortlist. Projection is deliberately tiny — `{ title, liveUrl, technologies, registrationName, kind }`, no `_id`, nothing enumerable. An empty array with a 200 is a **normal** state (every un-reviewed event looks like this) | `Participation: winners:<eventId>` |

### 13.2 Member

| Endpoint | Method | Purpose | Notes |
| :--- | :--- | :--- | :--- |
| `/participation/me/registrations` | `GET` | My registrations, newest first, **including withdrawn**; each row carries its `submission` inline | Optional `eventId` query filter — **not validated server-side** (a malformed value is silently ignored, 200 with the full list). Tag: `Participation: mine` |
| `/participation/registrations/:registrationId` | `GET` | One registration with its submission; readable by **any** member of the registration | Tags: `mine`, `reg:<registrationId>` |
| `/participation/events/:eventId/registrations` | `POST` | Create a registration — body `{ name?, memberIds? }` and nothing else. `memberIds` absent/empty → **solo** (`name` ignored, named after the member); non-empty → team (`name` required). `memberIds` are `uniID` values, resolved case-insensitively; every one must belong to an **approved** member or the whole request 400s naming them | Invalidates `mine`. ⚠️ the 201 body's `members` have empty `fullName`/`uniID`/`avatar` (no populate on the create path) — re-fetch via `getRegistration` to render names |
| `/participation/registrations/:registrationId` | `PATCH` | Update (owner only) — `memberIds` has **three shapes that are three different requests**: omitted = keep the team, `[]` = drop everyone but me, `[a, b]` = replace the roster. A solo cannot be renamed (400); a team grown from a solo must be named in the same request | Invalidates `mine`, `reg:<id>` |
| `/participation/registrations/:registrationId` | `DELETE` | Withdraw (owner only) — a **tombstone**, not a delete (`status: 'withdrawn'`); withdrawing frees the member to register again. A registration **with a submission cannot be withdrawn** (409 "Contact an administrator") — the UI must not offer the button in that state | Invalidates `mine`, `reg:<id>` |
| `/participation/registrations/:registrationId/submission` | `GET` | The one submission — **404 is the normal first-visit answer** ("No submission has been filed"), not a failure | Tags: `submission:<registrationId>`, `reg:<registrationId>` |
| `/participation/registrations/:registrationId/submission` | `POST` | File a submission — body `{ title, description?, repoUrl?, liveUrl?, technologies? }`. **Exactly one submission per registration, ever** (unique `registrationId` index): a second POST is a permanent 409, there is no member-facing replace or resubmit. `repoUrl`/`liveUrl` go through the server's URL policy; no file upload, no video field — a demo video is a link in `liveUrl` | Invalidates `mine`, `submission:<id>`, `reg:<id>` |
| `/participation/registrations/:registrationId/submission` | `PATCH` | Edit the submission — **only while `status === 'submitted'`** (shortlisted/rejected is a 409). A PATCH with no recognised field is a 400, so an unchanged form must not be submitted | Invalidates `mine`, `submission:<id>`, `reg:<id>` |
| `/participation/member-search` | `GET` | The co-member picker — `?q=` (≥ 2 chars). Matches `uniID`, `email` **and** `fullName`; returns only `{ _id, fullName, uniID, avatar }` (email is searchable but deliberately not returned) | Driven by `skipToken` (RTK Query 2.12 has no `lazyQuery`): the component holds the term in state starting at `skipToken`, so no request fires until there is a real value, and **debounces 300 ms** — the endpoint's per-user ceiling (60 per 15 min) is sized for a type-ahead, not per-keystroke requests |

### 13.3 Admin review

| Endpoint | Method | Purpose | Notes |
| :--- | :--- | :--- | :--- |
| `/admin/participation/registrations` | `GET` | Registration roster for one event | **`eventId` query is required** (400 without it). `status` defaults to `'registered'`; `'all'` disables the filter. Under-`teamMinSize` rows are **returned**, not filtered out — this is the review surface. Admin + moderator (any GET); mentor 403. Tag: `admin:<eventId>:registrations` |
| `/admin/participation/submissions` | `GET` | Submission review queue for one event | Same auth and `eventId` requirement, but `status` defaults to `'submitted'` (each list defaults to "the things waiting on me"). Tag: `admin:<eventId>:submissions` |
| `/admin/participation/submissions/:id` | `PATCH` | Shortlist or reject — **admin only** (a moderator reads both lists but 403s here, so review actions are gated on role, not on reaching the page) | Body honours **only `status`** (`submitted\|shortlisted\|rejected`) **and `reviewNote`** (≤500 chars); every other key is silently dropped, and `reviewedBy`/`reviewedAt` are set server-side from the acting admin and the clock. `shortlisted → submitted` is a **409** — shortlisting publishes the entry on the public gallery, so it is not quietly undoable. The path param is `:id` (not `:submissionId`) |

### 13.4 The tag-id scheme and invalidation rules

All tags are under the `Participation` type with **composite ids**, because the screens read several endpoints at once and a flat tag would evict unrelated data on every write:

```
window:<eventId>        public window (contains NO participant data)
winners:<eventId>       public shortlist
mine                    the member's own registrations
reg:<registrationId>    one registration with its submission
submission:<regId>      the submission alone
admin:<eventId>:<kind>  admin review lists (kind = registrations | submissions)
```

- **`window:` is invalidated by no member write** — intentional, not an oversight: the window is derived from the `Event` document, which only an admin changes, so a member registering cannot make it more or less open.
- **`reviewParticipationSubmission` is the only mutation that invalidates `winners:`** (plus `admin:<eventId>:submissions`, `admin:<eventId>:registrations`, `mine`) — shortlisting is the only action in the feature that changes what an anonymous visitor sees. It derives the event id from **`result?.data?.eventId ?? arg?.eventId`** (the response, not the request arg): `arg.eventId` is an extra field passed purely for the failure-case fallback, and a caller that forgets it produces a mutation that *succeeds and invalidates nothing*.
- Member mutations invalidate `mine` plus the precise `reg:`/`submission:` entries keyed by ids the caller already holds.

### 13.5 Error messages — `getParticipationErrorMessage`

`src/lib/participation.js` extracts the message from an RTK Query rejection. The server has no error codes, so the message is rendered **verbatim** (the wording is the contract — re-deriving it client-side would drift). The one substitution is the generic `500`:

```js
const isInternalFailure =
  message !== undefined && error?.data?.errors === undefined;
```

The global error handler has **two** 500 branches: one wraps a deliberate `ApiError` and always sends `{ status, message, errors }` (with a message written for a human); the catch-all sends `{ status, message }` where `message` is the raw Mongoose/driver error. Keying on the **presence of the `errors` key** — not on the status code — distinguishes them exactly: a 500 *with* `errors` is a participant-facing explanation and is shown; a 500 *without* one is an internal detail (collection name, schema path, CastError) and the `fallback` is shown instead. Do not collapse this distinction into a status-code check — it hides every deliberate 500's explanation.
