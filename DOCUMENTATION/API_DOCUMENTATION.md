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
  AdminContent, AdminStatistics, AdminCertificates, AdminSystemSettings, AdminRoles
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
| `/users/user` | `GET` | Fetch users list | None |
| `/users/user/:id` | `GET` | Fetch user by ID | Path param: `id` |
| `/users/user` | `POST` | Create user | `userData` |
| `users/userInfo-update` | `PATCH` | Update current user profile | `userData` |
| `users/user/upload-image/:key` | `PATCH` | Upload user image (avatar/cover by key) | `FormData` (`imageData`) |
| `users/job-pipeline-request` | `POST` | Request job pipeline profile | Optional body (`{ title }`) |
| `users/job-pipeline-request` | `DELETE` | Remove job pipeline profile request | None |
| `/users/:id` | `DELETE` | Delete user by ID (admin flow) | Path param: `id` |
| `/users/password` | `PATCH` | Change current user password | `body` |
| `/users/user` | `DELETE` | Delete own account | None |

> Note: several `userApi` URLs omit the leading `/` (e.g. `users/userInfo-update`). This is functional but inconsistent with the rest of the codebase.

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
| `users/member` | `GET` | Fetch validated members | — |
| `/users/member/:id` | `GET` | Fetch member details by ID | Provides a `Members` tag (not registered in `baseApi.tagTypes`) |

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

**Supported public resources**: `alumni`, `committees`, `donators`, `events`, `gallery`, `profiles`

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
| `/admin/statistics` | `GET` | Fetch live site statistics computed from the real data sources (members, gallery, events, visitors, certificates, verification logs) | None | Provides `AdminStatistics` tag |
| `/content/statistics` | `GET` | Public site statistics — same live values as the admin endpoint | None | Public |

### 8.7 System Settings

| Endpoint | Method | Purpose | Payload | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `/admin/system-settings` | `GET` | Fetch system settings | None | Provides `AdminSystemSettings` tag |
| `/admin/system-settings` | `PATCH` | Update system settings | `body` | Invalidates `AdminSystemSettings` tag |

**System settings include**: site metadata, maintenance mode, appearance settings.

### 8.8 Certificates

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
- **Statistics mutations** invalidate `AdminStatistics` and `PublicContent:statistics`.
- **System settings mutations** invalidate `AdminSystemSettings`.
- **Admin role mutations** invalidate `AdminRoles`.
- **Project mutations** invalidate `Projects`.
