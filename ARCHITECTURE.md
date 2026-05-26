# CPCCU Frontend Architecture Documentation

This document provides a detailed overview of the technical architecture, directory structure, and data flow of the `cpccu-client` project.

## 1. Technology Stack

*   **Framework**: [Next.js 15+](https://nextjs.org/) (App Router)
*   **Language**: JavaScript (ES6+)
*   **State Management**: [Redux Toolkit](https://redux-toolkit.js.org/)
*   **Data Fetching**: [RTK Query](https://redux-toolkit.js.org/rtk-query/overview)
*   **Styling**: [Tailwind CSS 4](https://tailwindcss.com/)
*   **Animations**: [Framer Motion](https://www.framer.com/motion/)
*   **UI Components**: [Radix UI](https://www.radix-ui.com/) (Headless primitives)
*   **Icons**: FontAwesome & Lucide React
*   **Validation**: [Zod](https://zod.dev/)

## 2. Directory Structure

```
src/
├── app/
│   ├── (main)/
│   │   ├── alumni/
│   │   ├── blog/
│   │   ├── certificate/
│   │   ├── committee/
│   │   ├── profile/
│   │   └── ... (contact, contributors, donators, event, gallery, history, job-pipeline, member, users)
│   ├── login/
│   ├── signup/
│   ├── verify/
│   └── redux/
├── components/
│   ├── ABOUT/
│   ├── ALERT/
│   ├── BLOG/
│   ├── CERTIFICATE/
│   ├── CONTACT/
│   ├── CONTRIBUTORS/
│   ├── DONATORS/
│   ├── EVENT/
│   ├── GALLERY/
│   ├── Global/
│   ├── Layout/
│   └── PROFILE/
├── features/
│   ├── auth/
│   ├── certificate/
│   ├── members/
│   ├── posts/
│   └── users/
├── Context/
├── hooks/
├── lib/
└── services/

```

## 3. State Management & Data Flow

### 3.1 Redux Store Configuration
The application uses a centralized Redux store located in `src/app/redux/store.js`. It manages both local state (slices) and server state (RTK Query).

*   **`auth`**: Manages user authentication state, tokens, and hydration from `localStorage`.
*   **`certificate`**: Manages search state and results for the certificate verification feature.
*   **`api`**: The root RTK Query reducer for all server-side interactions.

### 3.2 RTK Query Integration
The application follows a **Single Base API** pattern. All feature-specific APIs (auth, users, posts) inject their endpoints into the `baseApi` defined in `src/services/baseApi.js`.

*   **Base URL**: Configurable via `NEXT_PUBLIC_API_BASE_URL`.
*   **Authentication**: Automatically attaches the JWT token to headers if present in the Redux state.
*   **Tag Invalidation**: Used for automatic cache synchronization (e.g., updating the user list after a profile edit).

## 4. Authentication & Hydration

The `ProviderWrapper` and `AuthHydrator` in `src/app/redux/` handle the persistence of authentication state.
1.  On application boot, `AuthHydrator` checks `localStorage` for a stored `user` and `token`.
2.  If found, it dispatches `setCredentials` to populate the Redux state.
3.  The `hydrated` flag is set to `true` to signal that the auth state is ready, preventing UI flickers or incorrect hook calls.

## 5. Routing Strategy

*   **Route Groups**: Uses Next.js `(main)` group to apply a consistent shell (NavBar/Footer) to public pages while keeping auth pages (`/login`, `/signup`) clean.
*   **Dynamic Routes**: Used for profiles (`/profile/[id]`) and other dynamic content.
*   **Client Components**: Most pages are marked with `"use client"` as they heavily rely on Redux state and interactive UI components.

## 6. Styling & UI Patterns

*   **Utility-First**: Uses Tailwind CSS for all styling, ensuring responsiveness and consistent design.
*   **Responsive Navigation**: The `NavBar` component handles mobile and desktop views using conditional rendering and Framer Motion for transitions.
*   **Accessible UI**: Leverages Radix UI primitives for complex components like Accordions, Dialogs, and Dropdowns to ensure accessibility (WAI-ARIA).
