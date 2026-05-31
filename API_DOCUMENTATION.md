# CPCCU Frontend API Documentation

This document describes the API endpoints consumed by the `cpccu-client` and how they are integrated via RTK Query.

## 1. Global Configuration

*   **Base API URL**: `NEXT_PUBLIC_API_BASE_URL` (Default: `http://localhost:5000/api/v1`)
*   **Authentication**: Bearer Token in `Authorization` header.
*   **Credentials**: `include` (for cross-site cookie support).

## 2. Authentication (`authApi`)

| Endpoint | Method | Purpose | Payload |
| :--- | :--- | :--- | :--- |
| `/auth/login` | `POST` | User login | `{ email, password }` |
| `/auth/register` | `POST` | New user registration | `{ fullName, email, password, ... }` |
| `/auth/send-otp` | `POST` | Request email verification OTP | `{ email }` |
| `/auth/verify-registration` | `POST` | Verify registration OTP | `{ email, otp }` |
| `/auth/logout` | `POST` | Invalidate session | None |

## 3. User Management (`userApi`)

| Endpoint | Method | Purpose | Payload |
| :--- | :--- | :--- | :--- |
| `/users/user` | `GET` | Fetch all users | None |
| `/users/user/:id` | `GET` | Fetch specific user profile | None |
| `/users/userInfo-update` | `PATCH` | Update current user profile | `{ fullName, phone, github, ... }` |
| `/users/user/upload-image/:key` | `PATCH` | Upload avatar/cover image | `FormData` (field: `image`) |
| `/users/:id` | `DELETE` | Delete a user account | None |

## 4. Members (`memberApi`)

| Endpoint | Method | Purpose |
| :--- | :--- | :--- |
| `users/member` | `GET` | Fetch list of validated club members |
| `/users/member/:id` | `GET` | Fetch detailed member profile |

## 5. Certificates (`certificateApi`)

### Private API (Authenticated)
| Endpoint | Method | Purpose | Params |
| :--- | :--- | :--- | :--- |
| `/certificates/verify` | `GET` | Search/Verify certificates | `certificateId`, `recipientName`, `recipientId` |
| `/certificates/stats` | `GET` | Fetch certificate statistics | None |
| `/certificates/recent` | `GET` | Fetch recently issued certificates | None |

### Public API (Unauthenticated)
| Endpoint | Method | Purpose |
| :--- | :--- | :--- |
| `/verify/:certificateId` | `GET` | Public certificate verification page |

## 6. Data Models (Frontend Interfaces)

### User / Member
```typescript
interface User {
  _id: string;
  fullName: string;
  email: string;
  phone?: string;
  avatar?: string;
  coverImage?: string;
  uniID?: string;
  batch?: string;
  section?: string;
  skills: string[];
  github?: string;
  linkedin?: string;
  roles: {
    role: 'admin' | 'moderator' | 'mentor' | 'member';
    position: number;
    positionName: string;
  };
  isValid: boolean;
}
```

### Certificate
```typescript
interface Certificate {
  certificateId: string;
  recipientName: string;
  recipientId: string;
  issueDate: string;
  event: string;
  // ... other fields
}
```
