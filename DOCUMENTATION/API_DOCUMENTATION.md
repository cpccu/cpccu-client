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

### 1.2 Public Certificate API (`publicApi`)

* **Base URL derivation**: `(NEXT_PUBLIC_API_BASE_URL || 'http://localhost:5000').replace('/api/v1', '')`
* This is used to call the public certificate verification route at `/verify/:certificateId`.

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

## 4. Members (`memberApi`)

| Endpoint | Method | Purpose |
| :--- | :--- | :--- |
| `/users/member` | `GET` | Fetch validated members |
| `/users/member/:id` | `GET` | Fetch member details by ID |

## 5. Certificates

### 5.1 Private (`certificateApi`, authenticated)

| Endpoint | Method | Purpose | Params |
| :--- | :--- | :--- | :--- |
| `/certificates/verify` | `GET` | Search/verify certificates | Query params built from non-empty values: `certificateId`, `recipientName`, `recipientId` |
| `/certificates/stats` | `GET` | Fetch certificate statistics | None |
| `/certificates/recent` | `GET` | Fetch recently issued certificates | None |

### 5.2 Public (`publicApi`, unauthenticated)

| Endpoint | Method | Purpose |
| :--- | :--- | :--- |
| `/verify/:certificateId` | `GET` | Public certificate verification |

## 6. Content (`contentApi`)

| Endpoint | Method | Purpose |
| :--- | :--- | :--- |
| `/content/:resource` | `GET` | Fetch public content by resource key |
| `/content/statistics` | `GET` | Fetch public statistics payload |

## 7. Contact (`contactApi`)

| Endpoint | Method | Purpose | Payload |
| :--- | :--- | :--- | :--- |
| `/contact/messages` | `POST` | Submit contact message | `body` |

## 8. Admin (`adminApi`)

### 8.1 Overview

| Endpoint | Method | Purpose |
| :--- | :--- | :--- |
| `/admin/overview` | `GET` | Dashboard overview data |

### 8.2 Members

| Endpoint | Method | Purpose | Payload / Params |
| :--- | :--- | :--- | :--- |
| `/admin/members` | `GET` | List admin-managed members | Optional query `params` |
| `/admin/members` | `POST` | Create member | `body` |
| `/admin/members/:id` | `PATCH` | Update member | Path param `id`, `body` |
| `/admin/members/:id` | `DELETE` | Delete member | Path param `id` |

### 8.3 Content Management

| Endpoint | Method | Purpose | Payload / Params |
| :--- | :--- | :--- | :--- |
| `/admin/content/:resource` | `GET` | Fetch admin content list for resource | Optional query `params` |
| `/admin/content/:resource` | `POST` | Create content item | `body` |
| `/admin/content/:resource/:id` | `PATCH` | Update content item | Path param `id`, `body` |
| `/admin/content/:resource/:id` | `DELETE` | Delete content item | Path param `id` |

### 8.4 File Upload

| Endpoint | Method | Purpose | Payload |
| :--- | :--- | :--- | :--- |
| `/admin/uploads/image` | `POST` | Upload admin image asset | Multipart `body` |

### 8.5 Statistics

| Endpoint | Method | Purpose | Payload |
| :--- | :--- | :--- | :--- |
| `/admin/statistics` | `GET` | Fetch editable statistics | None |
| `/admin/statistics` | `PATCH` | Update statistics | `body` |

### 8.6 System Settings

| Endpoint | Method | Purpose | Payload |
| :--- | :--- | :--- | :--- |
| `/admin/system-settings` | `GET` | Fetch system settings | None |
| `/admin/system-settings` | `PATCH` | Update system settings | `body` |

### 8.7 Certificates

| Endpoint | Method | Purpose | Payload |
| :--- | :--- | :--- | :--- |
| `/admin/certificates` | `GET` | Fetch certificates for admin panel | None |
| `/admin/certificates` | `POST` | Create certificate | `body` |
| `/admin/certificates/:id` | `PATCH` | Update certificate | Path param `id`, `body` |
| `/admin/certificates/:id` | `DELETE` | Delete certificate | Path param `id` |

## 9. Direct Fetch Integrations (Non-RTK Query)

| Location | Endpoint | Method | Purpose |
| :--- | :--- | :--- | :--- |
| `src/components/HOME/VisitorCounter.jsx` | `https://cpccu-server.onrender.com/api/visitor` | `GET` | Fetch total visitor count |
| `src/components/BOOTCAMPLEADERBOARD/BootcampLeaderboard.jsx` | `${NEXT_PUBLIC_API_BASE_URL}/bootcamp-leaderboard` | `GET` | Fetch bootcamp leaderboard |
