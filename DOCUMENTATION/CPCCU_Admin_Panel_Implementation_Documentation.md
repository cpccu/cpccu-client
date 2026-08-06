# CPCCU Admin Panel Implementation Documentation

## Overview

The admin panel is a role-based management area under `/admin`. It uses Next.js pages on the client and protected Express routes under `/api/v1/admin` on the server.

The panel is API-first. Admin screens no longer load fake demo data from `src/lib/demo-data.js`. When a database collection is empty, admin screens show an empty state so administrators know what still needs to be added.

The admin area is client-side guarded in `src/app/admin/layout.jsx`: unauthenticated users are redirected to `/login`, and users whose role is not `admin`/`moderator`/`mentor` see an "Admin access required" screen. Navigation is role-filtered in `src/components/admin-sidebar.jsx`.

## Roles

### Admin
Full access to all admin modules and all write actions. Can also manage dynamic roles.

### Moderator
Can manage content-focused modules (per the admin sidebar):
- Dashboard
- Posts
- Events
- Gallery
- Site Statistics
- Account Settings

Moderators can create, update, and delete allowed content resources. (`gallery-events` is not a separate sidebar module — it is a generic content resource used to group gallery items and is managed within the Gallery module.)

### Mentor
Read-oriented access (per the admin sidebar):
- Dashboard
- Members
- Certificates
- Site Statistics
- Account Settings

Mentors can view operational data but backend rules block write actions.

## Dynamic Role Management

Admins can manage official CPCCU position titles (e.g., President, Vice President, General Secretary, Treasurer) via the admin panel. These roles are separate from system permissions (admin/moderator/mentor/member) and are used for display on member profiles.

### Endpoints
- `GET /admin/roles` — List all roles
- `POST /admin/roles` — Create a new role
- `GET /admin/roles/active` — List only active roles
- `PATCH /admin/roles/:id` — Update a role
- `PATCH /admin/roles/:id/toggle` — Toggle role active/inactive

### Where the UI lives
There is **no dedicated `/admin/roles` page**. Role management UI (role dropdown, create role, activate/deactivate) lives inside the Members module (`src/components/members-content.jsx`), which uses `useGetAdminRolesQuery`, `useCreateAdminRoleMutation`, and `useUpdateAdminRoleMutation`.

## Main Routes

| Route | Purpose |
| --- | --- |
| `/admin` | Live dashboard from database overview counts |
| `/admin/alumni` | Alumni profile management |
| `/admin/audit-logs` | Read-only admin action log viewer |
| `/admin/members` | Member approval, role, and status management |
| `/admin/committees` | Running and previous committee management |
| `/admin/posts` | Blog/news/content management |
| `/admin/events` | Event, contest, link, and reward management |
| `/admin/gallery` | Gallery and featured media management |
| `/admin/certificates` | Certificate issue, bulk issue, view, and export |
| `/admin/contributors` | Website contributor records |
| `/admin/donators` | Donator recognition records |
| `/admin/jobs` | Developer profile/job pipeline management |
| `/admin/messages` | Contact message triage |
| `/admin/statistics` | Public statistics management |
| `/admin/settings/account` | Admin account settings |
| `/admin/settings/system` | Site metadata, maintenance, and appearance settings |

## Data Flow

The frontend uses `src/features/admin/adminApi.js`. All admin requests go through the shared RTK Query `baseApi` (Bearer token from `localStorage`, `credentials: include`).

Generic content modules use:
- `GET /api/v1/admin/content/:resource`
- `POST /api/v1/admin/content/:resource`
- `PATCH /api/v1/admin/content/:resource/:id`
- `DELETE /api/v1/admin/content/:resource/:id`

Supported generic resources include:
- `committees`
- `contributors`
- `donators`
- `events`
- `gallery`
- `messages`
- `posts`
- `profiles`

Specialized admin endpoints (not generic content):
- `GET /api/v1/admin/overview` — dashboard data
- `GET /api/v1/admin/members` — member list
- `POST /api/v1/admin/members` — create member
- `PATCH /api/v1/admin/members/:id` — update member
- `DELETE /api/v1/admin/members/:id` — delete member
- `GET /api/v1/admin/certificates` — certificate list
- `POST /api/v1/admin/certificates` — create certificate
- `PATCH /api/v1/admin/certificates/:id` — update certificate
- `DELETE /api/v1/admin/certificates/:id` — delete certificate
- `GET /api/v1/admin/statistics` — editable statistics
- `PATCH /api/v1/admin/statistics` — update statistics
- `GET /api/v1/admin/system-settings` — system settings
- `PATCH /api/v1/admin/system-settings` — update system settings
- `POST /api/v1/admin/uploads/image` — Cloudinary image upload

### Public Content API
Public content is exposed through `/api/v1/content/:resource`.

Public pages try live database content first and keep their previous JSON files as fallback when the database collection is empty. Ordered public resources are sorted by `order` first so migrated data keeps the same page order as the original JSON arrays.

Public resources include:
- `alumni`
- `committees`
- `donators`
- `events`
- `gallery`
- `profiles`

### Frontend Hooks
- `useAdminContent(resource, fallback)` — manages CRUD state for generic admin content tables with local state and fallback JSON data.
- `useIsMobile()` — mobile breakpoint detection (768px) for responsive admin layouts.
- `useToast()` / `toast()` — global toast notifications for admin actions.

## Committee Management

Committee management is available at `/admin/committees`.

Each committee member stores:
- Name
- Email
- Phone
- Position
- Image URL
- Committee type: `running` or `previous`
- Term, such as `Running Committee` or `Founding Committee 2022-2024`
- Sort order

The public `/committee` page groups previous committee members by `term`.

## Alumni Management

Alumni management is available at `/admin/alumni`.

Each alumni record stores:
- Name
- Position
- Batch
- Technology
- Job history object
- Email
- Phone
- Photo
- Social links
- Sort order

The public `/alumni` page reads live data from `/api/v1/content/alumni` and falls back to `data/Alumni.json` only when no database data is available.

## Event Management

Events are managed at `/admin/events` and shown publicly with the same `UpComingEventCard` structure used by the previous JSON data.

Important event fields:
- `eventHeadLine1`: public card headline
- `description`: public card body text
- `date`: event start time
- `endDate`: event end time
- `eventHeadLine2`: reward heading
- `reward`: reward/prize details
- `eventHeadLine3`: rules heading
- `rules1`, `rules2`, `rules3`, `rules4`: public card rules
- `btnText`, `btnLink`: first public card button
- `btnText1`, `btnLink1`: second public card button
- `order`: page display order

The public card still computes the three phases from `date` and `endDate`:
- `remaining`
- `running`
- `ended`

## Gallery Management

Gallery is managed at `/admin/gallery` via the generic content API (`resource: gallery`).

Gallery items support:
- Image upload via Cloudinary (`admin-image-upload-field`)
- Title and description
- Sort order
- Featured/public visibility flags

## Posts Management

Posts are managed at `/admin/posts` via the generic content API (`resource: posts`).

Posts support:
- Title, content, and excerpt
- Cover image upload
- Author attribution
- Published/draft status
- Publication date
- Sort order

## Contributors & Donators Management

Contributors (`/admin/contributors`) and Donators (`/admin/donators`) are managed via the generic content API.

Contributor fields:
- Name
- GitHub username
- Avatar (uploaded or URL)
- Contribution type
- Sort order

Donator fields:
- Name
- Amount or recognition tier
- Avatar (uploaded or URL)
- Message or note
- Sort order

## Messages Management

Contact messages are managed at `/admin/messages` via the generic content API (`resource: messages`).

Admins can:
- View submitted contact messages
- Mark messages as read/unread
- Delete old messages

## Cloudinary Uploads

Admin image fields now support direct file upload to Cloudinary through:

- `POST /api/v1/admin/uploads/image`

The upload endpoint uses the existing multer middleware and Cloudinary utility. The frontend reusable field is:

- `src/components/admin-image-upload-field.jsx`

It is used by:

- Gallery image management
- Event image management
- Committee member photos
- Contributor avatars
- Donator avatars
- Alumni photos
- Post cover images

Admins can still paste an existing image URL if needed.

## Gallery Events Management

Gallery events (`gallery-events`) are a separate content resource managed via the generic content API. They represent event groupings for gallery items. Each gallery event has:
- Title
- Description
- Event date
- Featured toggle
- Sort order

Gallery items can be linked to a gallery event via `eventId`.

## JSON Data Migration

The data migration script lives in the **backend** repository (`cpccu-server`):

- `cpccu-server/scripts/seedDataFromJson.js`

Package scripts (run from `cpccu-server`, not this frontend repo):

- `npm run data:export` creates ready MongoDB JSON files in `docs/mongodb-import`.
- `npm run data:seed` upserts mapped data into the configured MongoDB database.

The migration excludes `contributors.json` by request.

Known mappings:

- `Alumni.json` -> `Alumni`
- `Committee.json` and `PreviousCommittee.json` -> `CommitteeMember`
- `donators.json` -> `Donator`
- `upcomingEvent.json` -> `Event`
- `GallaryCard.json` -> `GalleryItem`
- `job-pipeline/Info.json` -> `DeveloperProfile`
- Every valid JSON file except `contributors.json` -> `SiteData` raw backup

`Member.json` is currently empty, so the migration skips it.

The latest generated import files are in:
- `docs/mongodb-import/committees.json`
- `docs/mongodb-import/alumni.json`
- `docs/mongodb-import/donators.json`
- `docs/mongodb-import/events.json`
- `docs/mongodb-import/gallery.json`
- `docs/mongodb-import/profiles.json`
- `docs/mongodb-import/siteData.json`

To move this local branch to the dev branch and seed the main MongoDB database:
1. Back up the target MongoDB database.
2. Merge this branch into `dev`.
3. Put the target database URI in `cpccu-server/.env` as `MONGODB_URI`.
4. From `cpccu-server`, run `npm run data:export` if you only need JSON import files.
5. From `cpccu-server`, run `npm run data:seed` once to upsert the JSON data into MongoDB.
6. Start the server and verify `/api/v1/content/events`, `/api/v1/content/committees`, `/api/v1/content/donators`, `/api/v1/content/gallery`, and `/api/v1/content/profiles`.

The seeder uses upserts, so re-running it updates matching records instead of blindly duplicating them. Events match by `title` and `date`; committees match by `email`, `position`, and `term`; developer profiles match by `email`.

## Job Pipeline

The public `/job-pipeline` page now reads approved developer profiles from MongoDB through `/api/v1/content/profiles`. It falls back to `data/job-pipeline/Info.json` only if the database request fails. It does not render JSON and database profiles together.

Member profile changes:
- Users can add `portfolio`.
- Skills use `skillName` plus `experience`, matching the job-pipeline card output.
- A profile owner can click `Show in Job Pipeline`.

Request flow:
1. User clicks `Show in Job Pipeline` on their profile.
2. Client calls `POST /api/v1/users/job-pipeline-request`.
3. Server creates or updates a `DeveloperProfile` with `status: pending`.
4. Admin reviews it at `/admin/jobs`.
5. When admin approves it, `status` becomes `approved` and the profile appears publicly.
6. The user sees `Shown in Job Pipeline` after approval.
7. Rejected or pending profiles stay hidden from `/job-pipeline`.
8. If admin rejects the request, the user sees the request button again and can submit a new request.

## Statistics Management

Public statistics are managed at `/admin/statistics`.

Statistics fields are editable and drive the public site display. Common statistic fields include:
- Total members
- Total alumni
- Total events held
- Total certificates issued
- Certificate verifications
- Failed certificate verifications

Changes are immediately reflected on the public site via the `/api/v1/content/statistics` endpoint.

## System Settings

System settings are managed at `/admin/settings/system`.

Settings include:
- Site metadata (title, description, keywords)
- Maintenance mode toggle
- Public appearance settings
- Contact information
- Social media links

## Audit Logs

Admin create/update/delete actions for generic content and certificates write to `AdminAuditLog`.

Audit logs are visible at `/admin/audit-logs`.

Each log stores:

- Admin id/name
- Action
- Resource
- Resource id
- Summary

## Certificate Verification Logs

Certificate verification attempts write to `CertificateVerificationLog`.

Statistics now include:

- `certificateVerifications`
- `failedCertificateVerifications`

The public certificate search supports:
- Exact certificate ID search
- Partial, case-insensitive recipient name search
- Case-insensitive recipient/student ID search

Name and student ID searches can return multiple certificates.

## Dashboard

`src/components/dashboard-content.jsx` is the active dashboard implementation (`src/components/ADMIN/AdminPanel.jsx` is unused). It maps `overviewResponse` from `/api/v1/admin/overview` into:
- Member Breakdown (Recharts **area** chart: verified / pending / admins)
- Content Overview (Recharts **bar** chart: posts, events, certificates, profiles)
- Member Status (Recharts **pie/donut** chart: verification distribution)
- Live operational cards (total members, pending approvals, active events, developer profiles, unread messages, certificates issued)
- Recent signals (pending membership requests, unread contact messages, developer profiles pending approval)

## Mobile Auth Button Fix

The mobile navbar now reads the authenticated Redux user instead of stale API cache data. Logged-out users see Login, normal logged-in users see Profile, and only logged-in users with `roles.role === "admin"` see the Admin Panel shortcut.

## Deployment

The frontend admin panel is part of the single Next.js app deployed on **Vercel** (production: https://cpccu.club/). The backend (all `/api/v1/admin/*` endpoints) is deployed on **Render** as `cpccu-server`. See [DEPLOYMENT.md](./DEPLOYMENT.md) for environment configuration.

## Notes For Future Work

The main public content JSON files are now mapped to MongoDB collections, and raw copies are preserved in `SiteData`. `contributors.json` remains intentionally JSON-backed (regenerated by GitHub Actions).
