# CPCCU - Competitive Programming Camp City University

The official web portal for the Competitive Programming Camp at City University. This platform supports community engagement, member management, public content publishing, certificate verification, and a full-featured admin panel.

[Live View](https://cpccu.club/)

## 🚀 Features

### Public Site
*   **Homepage**: Hero section, visitor counter, mission & responsibility, upcoming events, gallery preview, contributors carousel, donators carousel.
*   **Member Management**: Public member directory with profiles, skill tracking, academic details, and admin-managed member records.
*   **Authentication**: Login, registration, OTP verification, password reset, and persistent session hydration with email OTP verification.
*   **Certificate System**: Public and authenticated certificate verification flows, certificate statistics, and recent certificate display.
*   **Dynamic Content**: Blog posts, event pages, galleries, contributors, donators, and public site content managed via admin panel.
*   **Job Pipeline**: Public developer profile showcase with approval workflow. Members can request to display their profile in the job pipeline.
*   **Bootcamp Leaderboard**: Live leaderboard integration for bootcamp participants.
*   **Alumni & Committee**: Dedicated pages for alumni profiles and current/previous committees.
*   **Contact Page**: Public contact form with message submission.
*   **History Page**: Club history and legacy information.
*   **Not Found (404)**: Custom 404 error page.
*   **Scroll-to-Top**: Global scroll-to-top button on all pages.

### Admin Panel (`/admin`)
*   **Role-Based Access**: Three-tier roles — Admin (full access), Moderator (content management), Mentor (read-only operational data).
*   **Dashboard**: Live overview with member status charts, content charts, and operational cards from database.
*   **Members**: Member approval, role assignment, and status management.
*   **Content Management**: Generic CRUD for committees, contributors, donators, events, gallery, messages, posts, and profiles.
*   **Alumni Management**: Alumni profile CRUD with fallback to static JSON.
*   **Event Management**: Event creation with date phases (remaining, running, ended), reward rules, and button links.
*   **Gallery Management**: Image upload and gallery organization.
*   **Certificates**: Certificate issue, bulk issue, update, delete, and public verification.
*   **Statistics**: Editable public statistics displayed on the site.
*   **System Settings**: Site metadata, maintenance mode, and appearance configuration.
*   **Audit Logs**: Read-only log viewer for admin create/update/delete actions.
*   **Job Pipeline Admin**: Review and approve/reject member job pipeline requests.
*   **Messages**: Contact message triage and management.
*   **Cloudinary Uploads**: Direct image upload support for admin-managed content.
*   **Account Settings**: Admin profile and password management.

### UI & UX
*   **Responsive UI**: Optimized for desktop, laptop, and mobile using Tailwind CSS, Framer Motion, and Radix UI primitives.
*   **Animations**: Framer Motion scroll animations, page transitions, and interactive effects.
*   **Toast Notifications**: Global toast system using Sonner and SweetAlert2.
*   **Image Handling**: Cloudinary-backed image uploads with Upload.js support.
*   **Carousel Components**: Embla Carousel for home page contributors and donators.
*   **Charts**: Recharts-powered dashboard charts for admin analytics.
*   **Accessibility**: Radix UI primitives for accessible dialogs, dropdowns, accordions, and more.

## 🛠️ Tech Stack

*   **Framework**: Next.js 16 (App Router)
*   **Runtime UI**: React 19
*   **Language**: JavaScript (ES modules, JSX)
*   **State Management**: Redux Toolkit
*   **Server State / Data Fetching**: RTK Query
*   **Styling**: Tailwind CSS 4, Tailwind CSS Animate, Tailwind Merge
*   **UI Component System**: Radix UI primitives + `class-variance-authority` for variants
*   **Animation**: Framer Motion
*   **Icons**: Font Awesome, Lucide React, React Icons
*   **Forms & Validation**: Zod, Zod Validation Error
*   **Date Handling**: date-fns, React Day Picker
*   **Charts**: Recharts
*   **Carousels**: Embla Carousel React
*   **Notifications**: Sonner, SweetAlert2
*   **Command Palette**: cmdk
*   **OTP Input**: input-otp
*   **Upload**: upload-js (Cloudinary)
*   **Scroll**: react-scroll, react-scroll-trigger
*   **Panels**: react-resizable-panels
*   **Counters**: react-countup
*   **Package Manager**: npm / Bun

## 📂 Project Structure

For a detailed explanation of the architecture, see [ARCHITECTURE.md](./DOCUMENTATION/ARCHITECTURE.md).

```
cpccu-client/
├── data/                    # Static JSON content sources (fallback data)
├── DOCUMENTATION/           # Project documentation
├── public/                  # Static assets
├── scripts/                 # Utility scripts (e.g., update_contributors.py)
├── src/
│   ├── app/                 # Next.js App Router pages & layouts
│   │   ├── (main)/          # Public pages with shared layout
│   │   ├── admin/           # Admin panel routes
│   │   ├── login/           # Login page
│   │   ├── signup/          # Signup page
│   │   ├── redux/           # Redux store, ProviderWrapper, rootReducer
│   │   ├── not-found.jsx    # 404 page
│   │   └── ScrollToTop.jsx  # Global scroll-to-top behavior
│   ├── components/          # Feature and shared UI components
│   ├── Context/             # Scroll-based section contexts
│   ├── features/            # Redux slices and RTK Query endpoint modules
│   ├── hooks/               # Reusable hooks (use-admin-content, use-mobile, use-toast)
│   ├── lib/                 # Utilities (cn.js — tailwind-merge helper)
│   └── services/            # RTK Query base API setup
```

## 🚦 Getting Started

### Prerequisites

*   Node.js (v18+ recommended)
*   npm or [Bun](https://bun.sh/)

### Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/cpccu/cpccu-client.git
    cd cpccu-client
    ```

2.  Install dependencies:
    ```bash
    npm install
    # OR
    bun install
    ```

3.  Set up environment variables:
    Create a `.env` file in the root directory:
    ```env
    NEXT_PUBLIC_API_BASE_URL=http://localhost:5000/api/v1
    ```

### Running the Project

*   **Development Mode**:
    ```bash
    npm run dev
    # OR
    bun run dev
    ```
*   **Production Build**:
    ```bash
    npm run build
    npm run start
    # OR
    bun run build
    bun run start
    ```
*   **Linting**:
    ```bash
    npm run lint
    ```

## 📖 Documentation

*   [Architecture Overview](./DOCUMENTATION/ARCHITECTURE.md) — Deep dive into folder structure, routing, state management, and data flow.
*   [API Documentation](./DOCUMENTATION/API_DOCUMENTATION.md) — List of integrated endpoints and request contracts.
*   [Admin Panel Implementation](./DOCUMENTATION/CPCCU_Admin_Panel_Implementation_Documentation.md) — Admin roles, data flow, content management, and migration notes.
*   [Contribution Guide](./DOCUMENTATION/CONTRIBUTION.md) — Branching strategy, development workflow, and pull request process.

## 🤝 Contributing

We welcome contributions! Please follow the steps outlined in our [Contribution Guide](./DOCUMENTATION/CONTRIBUTION.md).

Quick reference:
1.  Fork the project.
2.  Create your feature branch from `dev`: (`git checkout -b feat/AmazingFeature`).
3.  Commit your changes (`git commit -m 'feat: add some AmazingFeature'`).
4.  Push to the branch (`git push origin feat/AmazingFeature`).
5.  Open a Pull Request to the `dev` branch.

## Preview

### Desktop
![Desktop](https://res.cloudinary.com/dfspekq6u/image/upload/v1781070746/desktop_ss_fosk3x.png)

### Laptop
![Laptop](https://res.cloudinary.com/dfspekq6u/image/upload/v1781070746/laptop_ss_vilzut.png)

### Mobile
![Mobile](https://res.cloudinary.com/dfspekq6u/image/upload/v1781070745/mobile_ss_od0z5y.png)

## Logos
https://i.ibb.co.com/Nm3q6c0/Artboard-1.png

## 📌 Notes

*   The app uses a shared public layout for main site pages and a separate admin area under `/admin`.
*   API requests are driven through RTK Query with a shared base API and a separate public certificate verifier.
*   Public content is split between static JSON data in `data/` and API-backed managed content. Admin-managed content falls back to JSON when the database is empty.
*   The `certificateSlise.js` filename contains a typo but is currently wired and working.
*   `src/features/posts/postApi.js` exists but is currently empty (posts are handled via generic admin content API).
*   `src/app/redux/rootReducer.js` appears stale and is not the reducer used by the active store configuration.
*   Admin image uploads go through Cloudinary via `POST /api/v1/admin/uploads/image`.
*   Certificate verification attempts are logged to `CertificateVerificationLog` for analytics.

## 📄 License

This project is licensed under the ISC License.

---
Collaborated & Developed with ❤️ by the [**Open Source Software Community City University**](https://ossccu.pro.bd/)
