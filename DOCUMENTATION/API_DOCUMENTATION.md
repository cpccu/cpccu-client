# CPCCU Frontend API Documentation

This document describes the API integrations currently used by `cpccu-client`.

## 1. Global Configuration

### 1.1 Main RTK Query Base API (`baseApi`)

* **Base URL**: `NEXT_PUBLIC_API_BASE_URL` (fallback: `http://localhost:5000/api/v1`)
* **Credentials**: `include`
* **Default Content-Type**: `application/json`
* **Authorization**: `Bearer <token>` is automatically attached when `auth.token` exists
* **Multipart exceptions**: `Content-Type` is intentionally not forced for:
  * `userImageUpload`
  * `uploadAdminImage`
* **Tag Types**: `Auth`, `Users`, `Posts`, `Projects`, `PublicContent`, `AdminOverview`, `AdminMembers`, `AdminContent`, `AdminStatistics`, `AdminCertificates`, `AdminSystemSettings`, `AdminRoles`

### 1.2 Public Certificate API (`publicApi`)

* **Base URL derivation**: `(NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000').replace('/api/v1', '')`
* This is used to call the public certificate verification route at `/verify/:certificateId`.
* **Note**: This is a separate `createApi` instance (not injected into `baseApi`) so it can operate without authentication headers.

## 2. Authentication (`authApi`)

| Endpoint | Method | Purpose | Payload 
| :--- | :--- | :--- | :--- | 
| `/auth/login` | `POST` | User login | `{ email, password }` |
| `/auth/register` | `POST` | New user registration | `userData` |
| `/auth/send-otp` | `POST` | Request registration OTP | `{ email }` |
| `/auth/verify-registration` | `POST` | Verify registration OTP | `{ email, otp }` |
| `/auth/logout` | `GET` | Logout current user/session | None |
| `/auth/reset-link/:email` | `GET` | Send password reset link | Path param: encoded `email` |
| `/auth/reset-password` | `PATCH` | Reset password | `resetData` |
| `/auth/refresh-token` | `GET` | Refresh access token using refresh token cookie | None |
| `/auth/google-signin` | `POST` | Sign in with Google OAuth (Firebase ID token) | `{ idToken }` |
| `/auth/google-signup` | `POST` | Sign up with Google OAuth (Firebase ID token) | `{ idToken }` |
| `/users/user` | `GET` | Fetch current authenticated user | None |

## 3. Users (`userApi`)

| Endpoint | Method | Purpose | Payload / Params |
| :--- | :--- | :--- | :--- |
| `/users/user` | `GET` | Fetch users list | None |
| `/users/user/:id` | `GET` | Fetch user by ID | Path param: `id` |
| `/users/user` | `POST` | Create user | `userData` |
| `/users/userInfo-update` | `PATCH` | Update current user profile | `userData` |
| `/users/user/upload-image/:key` | `PATCH` | Upload user image (avatar/cover by key) | `FormData` (`imageData`) |
| `/users/job-pipeline-request` | `POST` | Request job pipeline profile | Optional body |
| `/users/job-pipeline-request` | `DELETE` | Remove job pipeline profile request | None |
| `/users/:id` | `DELETE` | Delete user by ID (admin flow) | Path param: `id` |
| `/users/password` | `PATCH` | Change current user password | `body` |
| `/users/user` | `DELETE` | Delete own account | None |
| `/users/member` | `GET` | List all registered members | None |

## 3.1 Projects (`userApi`)

Projects are managed through userApi endpoints (injected into `baseApi`):

| Endpoint | Method | Purpose | Auth |
| :--- | :--- | :--- | :--- |
| `/projects` | `GET` | Fetch own projects | Required |
| `/projects` | `POST` | Create a new project | Required |
| `/projects/:id` | `PATCH` | Update own project | Required |
| `/projects/:id` | `DELETE` | Delete own project | Required |
| `/projects/user/:userId` | `GET` | Fetch public projects by user ID | No |

## 4. Members (`memberApi`)

| Endpoint | Method | Purpose | Notes |
| :--- | :--- | :--- | :--- |
| `/users/member` | `GET` | Fetch validated members | — |
| `/users/member/:id` | `GET` | Fetch member details by ID | Provides `Members` tag with ID |

## 5. Certificates

### 5.1 Private (`certificateApi`, authenticated)

| Endpoint | Method | Purpose | Params |
| :--- | :--- | :--- | :--- |
| `/certificates/verify` | `GET` | Search/verify certificates | Query params built from non-empty values: `certificateId`, `recipientName`, `recipientId` |
| `/certificates/stats` | `GET` | Fetch certificate statistics | None |
| `/certificates/recent` | `GET` | Fetch recently issued certificates | None |

**Certificate search behavior**:
* `certificateId` — exact match search
* `recipientName` — partial, case-insensitive match
* `recipientId` — case-insensitive match
* Name and student ID searches can return multiple certificates.

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

### 8.3 Content Management

| Endpoint | Method | Purpose | Payload / Params | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `/admin/content/:resource` | `GET` | Fetch admin content list for resource | Optional query `params` | Provides `AdminContent` tag with resource ID |
| `/admin/content/:resource` | `POST` | Create content item | `body` | Invalidates `AdminContent`, `PublicContent`, `AdminOverview` |
| `/admin/content/:resource/:id` | `PATCH` | Update content item | Path param `id`, `body` | Invalidates `AdminContent`, `PublicContent`, `AdminOverview` |
| `/admin/content/:resource/:id` | `DELETE` | Delete content item | Path param `id` | Invalidates `AdminContent`, `PublicContent`, `AdminOverview` |

**Supported generic content resources**: `committees`, `contributors`, `donators`, `events`, `gallery`, `gallery-events`, `messages`, `posts`, `profiles`, `alumni`, `audit-logs`

### 8.4 Role Management

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
| `/admin/uploads/image` | `POST` | Upload admin image asset to Cloudinary | Multipart `body` | Used by gallery, events, committees, contributors, donators |

### 8.6 Statistics

| Endpoint | Method | Purpose | Payload | Notes |
| :--- | :--- | :--- | :--- | :--- |
| `/admin/statistics` | `GET` | Fetch editable statistics | None | Provides `AdminStatistics` tag |
| `/admin/statistics` | `PATCH` | Update statistics | `body` | Invalidates `AdminStatistics`, `PublicContent:statistics` |

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

## 10. Direct Fetch Integrations (Non-RTK Query)

| Location | Endpoint | Method | Purpose |
| :--- | :--- | :--- | :--- |
| `src/components/HOME/VisitorCounter.jsx` | `https://cpccu-server.onrender.com/api/visitor` | `GET` | Fetch total visitor count |
| `src/components/BOOTCAMPLEADERBOARD/BootcampLeaderboard.jsx` | `${NEXT_PUBLIC_API_BASE_URL}/bootcamp-leaderboard` | `GET` | Fetch bootcamp leaderboard |

## 11. Certificate Verification Logs

Certificate verification attempts (both public and authenticated) are logged server-side to `CertificateVerificationLog`. The statistics now include:

* `certificateVerifications` — total successful verifications
* `failedCertificateVerifications` — failed verification attempts

## 12. Admin Audit Logs

Admin create/update/delete actions for generic content and certificates write to `AdminAuditLog`. These logs are visible at `/admin/audit-logs` and store:

* Admin ID/name
* Action type (`create`, `update`, `delete`)
* Resource name
* Resource ID
* Summary of changes

## 13. Cache Invalidation Strategy

RTK Query tag types are used aggressively for cache invalidation:

* **Auth operations** invalidate `Auth`, which triggers re-fetch of the current user.
* **User mutations** invalidate `Auth` and `Users` tags to keep member lists and profile data fresh.
* **Admin content mutations** invalidate `AdminContent`, `PublicContent`, and `AdminOverview` to keep both admin and public views in sync.
* **Statistics mutations** invalidate `AdminStatistics` and `PublicContent:statistics`.
* **System settings mutations** invalidate `AdminSystemSettings`.
* **Admin role mutations** invalidate `AdminRoles`.
* **Project mutations** invalidate `Projects`.
