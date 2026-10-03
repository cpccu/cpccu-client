# CPCCU Admin Panel Implementation Documentation

## Overview

The admin panel is a role-based management area under `/admin`. It uses Next.js pages on the client and protected Express routes under `/api/v1/admin` on the server.

The panel is API-first. Admin screens no longer load fake demo data from `src/lib/demo-data.js`. When a database collection is empty, admin screens show an empty state so administrators know what still needs to be added.

The admin area is client-side guarded by `src/components/admin-layout.jsx`, which every admin page imports: unauthenticated users are redirected to `/login` (after auth hydration), and users whose role is not `admin`/`moderator`/`mentor` see an "Admin access required" screen. Navigation is role-filtered in `src/components/admin-sidebar.jsx`. (`src/app/admin/layout.jsx` is only a metadata pass-through.)

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

Moderators can create, update, and delete allowed content resources. (`gallery-events` is not a separate sidebar module — it is a generic content resource used to group gallery items and is managed within the Gallery module. The Hackathon module carries the identical `roles: ['admin', 'moderator']` list as Events, because it writes the same `events` records through the same endpoint.)

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
| `/admin/hackathon` | Hackathon publication toggle, rule book, problem set, CTA label, schedule |
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
- `GET /api/v1/admin/statistics` — live site statistics (computed from the real data sources; **read-only** — there is no `PATCH /admin/statistics`)
- `GET /api/v1/admin/system-settings` — system settings
- `PATCH /api/v1/admin/system-settings` — update system settings
- `POST /api/v1/admin/uploads/image` — Cloudinary image upload
- `GET /api/v1/admin/contributors` — GitHub-synced contributors (Contents API read)
- `PATCH /api/v1/admin/contributors/:githubUsername` — write `batch`/`linkedin` back to `data/contributors.json`

### Public Content API
Public content is exposed through `/api/v1/content/:resource`.

Public pages try live database content first and keep their previous JSON files as fallback when the database collection is empty. Ordered public resources are sorted by `order` first so migrated data keeps the same page order as the original JSON arrays.

> The hackathon page is a **singleton** resource, so it deliberately does *not* use the `chooseLiveItems` fallback pattern — that helper is array-shaped and its "show demo data on error" semantics are wrong for a page whose entire content is one record. It uses explicit loading / error / empty branches.

Public resources include:
- `alumni`
- `committees`
- `donators`
- `events` (excludes `type: 'hackathon'` rows)
- `gallery`
- `profiles`

The hackathon is published on its own two routes, not as a `:resource` value:

- `GET /api/v1/content/hackathon` — anonymous. `404` when no hackathon is enabled. Returns the title, description, image, venue, organiser, start/end instants, registration link, CTA label, rule book URL, an advisory `problemSetAvailable` flag, and a server-derived `phase`.
- `GET /api/v1/content/hackathon/problem-set` — requires a session **and** the start time having passed. `403` before the start, `404` when the hackathon is off or no problem set is set.

Admin writes to `events` invalidate both hackathon cache entries as well as the generic one — otherwise turning the toggle off would leave the public nav entry on screen.

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
- `eventStartAt`: event start time
- `eventEndAt`: event end time
- `eventHeadLine2`: reward heading
- `reward`: reward/prize details
- `eventHeadLine3`: rules heading
- `rules1`, `rules2`, `rules3`, `rules4`: public card rules
- `btnText`, `btnLink`: first public card button
- `btnText1`, `btnLink1`: second public card button
- `order`: page display order

The public card still computes the three phases from `eventStartAt` and `eventEndAt` (mapped to `startAt`/`endAt` by `toPublicEvent`, which is what the card actually reads):
- `remaining`
- `running`
- `ended`

The public events list **excludes `type: 'hackathon'` rows**. A hackathon is published only on `/hackathon` (see [Hackathon Management](#hackathon-management)), which renders a server-derived lifecycle phase rather than the hand-set `status` this card reads. The admin Events page is intentionally **not** filtered — an admin must still be able to see that a hackathon exists.

⚠️ The server now validates all eight admin-writable event URL fields (`registrationLink`, `btnLink`, `btnLink1`, `contestLink`, `meetLink`, `vjudgeGroupLink`, and the two hackathon URLs) as absolute `http(s)` URLs, and rejects a hackathon whose `eventEndAt` is not strictly after its `eventStartAt`.

⚠️ **THE SAVE IS A FULL REPLACEMENT IN PRACTICE.** `updateAdminContent` applies `$set: req.body`, so any field absent from the payload is UNSET — with a `200` and no error anywhere. The Events form therefore sends all twelve schedule fields explicitly, with every boolean as a literal `false` rather than omitted. See [ARCHITECTURE.md §20.6](./ARCHITECTURE.md#206-the-event-schedule-form).

## Hackathon Management

The hackathon is managed at `/admin/hackathon` (`src/components/hackathon-content.jsx`).

**There is no new server endpoint.** The hackathon is an ordinary `Event` document with `type: 'hackathon'`, written through the existing generic content API (`resource: events`). The page therefore issues no path of its own, and `authorizeAdminAction` in the backend is unchanged — it inherits the `events` authorisation. That is why the sidebar entry carries the same roles as Events.

Fields managed:

- `hackathonEnabled` — the **visibility toggle** for the public `/hackathon` page. When off, `GET /content/hackathon` returns `404`.
- `hackathonRuleBookUrl` — the rule book document URL.
- `hackathonProblemSetUrl` — the problem set URL. **Never returned to anonymous callers**; served only by the gated `GET /content/hackathon/problem-set`.
- `hackathonCtaLabel` — the registration CTA label (default `Register Now`).
- `title`, `description`, `image`, `location`, `organizer` — the event details shown on the page.
- `eventStartAt` / `eventEndAt` — the live window, entered as `datetime-local` and interpreted as **Dhaka time (UTC+6, no DST since 2009)** via `src/lib/dhaka-time.js`, so the stored instant does not depend on the admin's device timezone. The generic Events form still uses `new Date(value).toISOString()` and is deliberately left alone: changing it would rewrite the stored instant of every historical event.
- The four participation instants (`registrationOpenAt`, `registrationCloseAt`, `submissionOpenAt`, `submissionCloseAt`) and their two switches, edited in the shared **Participation** section below. This form is a **full-replacement payload**: it must carry all twelve schedule fields, because `$set` cannot distinguish "not sent" from "cleared".

**Server-side guards on `events` writes** (all return `400` with a per-field error the form can render next to the input):

- All eight admin-writable URL fields must be absolute `http:`/`https:` URLs of at most 2048 characters with no embedded credentials. Empty means "cleared" and is accepted.
- A hackathon's `eventEndAt` must be **strictly after** its `eventStartAt`. A zero-width or inverted window is rejected. On edit this is checked against the merged post-update state, because the endpoint is a `$set` and any field may be omitted.
- `registrationCloseAt` must be strictly after `registrationOpenAt`, and `submissionCloseAt` strictly after `submissionOpenAt`. An **absent** bound is not an error — "no cutoff on that side" is a legitimate configuration and is what every document written before `registrationOpenAt` existed resolves to.

**The four "same as the event" toggles.** `registrationOpenFollowsEventStart`, `registrationCloseFollowsEventStart`, `submissionOpenFollowsEventStart` and `submissionCloseFollowsEventEnd` copy the event's own instant into the matching bound. They are resolved by the **server, at write time**, from the merged state — the client only sends the boolean, and the disabled input beside it is cleared when the box is ticked because its value would be stale the moment it arrived.

Ticking **both** registration toggles copies `eventStartAt` into both bounds and is refused with a `400` on `registrationCloseAt`: a window that opens and closes at the same instant can never open, and it would report `open: false` forever — which reads exactly like "registration is switched off". The hint text under each toggle says which instant it copies from.

The panel's "current hackathon" lookup mirrors the server's rule (`type: 'hackathon'`, `hackathonEnabled: true`, latest `eventStartAt` first). If those diverge, an admin would be editing a record the public site is not showing — so change both in the same commit.

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

## Contributors Management (GitHub-Synced)

Contributors (`/admin/contributors`) are **no longer generic content**. The page (`src/components/contributors-content.jsx`) reads from the backend's GitHub Contents API endpoints:

- `GET /api/v1/admin/contributors` — the backend fetches `data/contributors.json` (cpccu-client, `release` branch) live from GitHub.
- `PATCH /api/v1/admin/contributors/:githubUsername` — writes back **only `batch` and `linkedin`** to the same JSON file (admin-only; requires `CONTRIBUTOR_GITHUB_TOKEN` on the server).

Important constraints:
- GitHub-derived fields (name, username, avatar, commit count, GitHub profile) are **read-only** — they come from the daily GitHub Action sync.
- **Role is fixed as "Contributor"** and cannot be changed by an admin.
- There is **no second database source** — edits go straight back to the JSON that the public pages consume.
- If the live fetch fails (e.g. missing token), the page falls back to the bundled `data/contributors.json` and shows a warning banner.

## Donators Management

Donators (`/admin/donators`) are managed via the generic content API.

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

Site statistics are viewed at `/admin/statistics`.

All statistics are **calculated automatically** from the real CPCCU data sources and are read-only. The backend computes them live via `statistics.service.js` (`getSiteStatistics`) — there is no `SiteStatistics` collection anymore:
- Total members — `User` collection count
- Gallery photos — `GalleryItem` collection count
- Total events — `Event` collection count
- Contests held — events classified as `type: "contest"`
- Total visitors — the same visitor counter record the homepage uses
- Certificates issued — `Certificate` collection count
- Certificate verifications / failed verifications — `CertificateVerificationLog` counts
- Winners recognized — certificates with a winner certificate type (same definition as the public certificate page)

There is no manual edit form: values are derived from the data and cannot be overridden (there is no `PATCH /admin/statistics` route). There is intentionally **no "Total Awards" statistic** — that feature was removed. The public `/api/v1/content/statistics` endpoint serves the same live values as the admin endpoint.

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
