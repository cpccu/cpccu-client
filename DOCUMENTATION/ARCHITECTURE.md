# CPCCU Frontend Architecture Documentation

This document summarizes the current architecture of the cpccu-client repository.

## 1. Technology Stack

The versions below are based on the current package configuration.

* **Framework**: Next.js 16 (App Router)
* **Runtime UI**: React 19
* **Language**: JavaScript (ES modules, JSX)
* **State Management**: Redux Toolkit
* **Server State / Data Fetching**: RTK Query
* **Styling**: Tailwind CSS 4
* **Animation**: Framer Motion
* **UI Primitives**: Radix UI (plus a components/ui design system layer)
* **Icons**: Font Awesome, Lucide React, React Icons
* **Validation**: Zod

## 2. Repository Layout

Top-level layout (simplified):

```
data/              Static JSON content sources
DOCUMENTATION/     Project docs
public/            Static assets
scripts/           Utility scripts
src/
	app/             Next.js App Router pages/layouts
	components/      Feature and shared UI components
	Context/         Scroll and context helpers
	features/        Redux slices and RTK Query endpoint modules
	hooks/           Reusable hooks
	lib/             Utilities and helper modules
	services/        RTK Query base API setup
```

## 3. Routing Architecture (App Router)

### 3.1 Root Shell

* Root layout in src/app/layout.jsx wraps the app with the Redux Provider wrapper.
* Global styles are loaded from src/app/globals.css.

### 3.2 Main Public Route Group

* Route group: src/app/(main)/
* Shared shell for public pages in src/app/(main)/layout.jsx:
	* Header
	* NavBar
	* Footer
	* GoToTop
	* ScrollToTop behavior
* Current pages include:
	* home, blog, event, gallery, committee, alumni, contributors, donators
	* member, history, certificate, contact, job-pipeline
	* bootcamp-leaderboard
	* dynamic profile routes: profile/[id], users/profile/[id]

### 3.3 Auth and Utility Routes

Outside the main group, the app includes:

* login
* signup
* reset-password/[code]/[token]
* verify/[certificateId]
* not-found page

### 3.4 Admin Routes

* Admin area under src/app/admin/
* Separate admin layout at src/app/admin/layout.jsx
* Admin sections include:
	* dashboard page
	* members, posts, messages, events, gallery, jobs
	* alumni, contributors, donators, committees
	* certificates, statistics, audit-logs
	* settings/account, settings/system

## 4. State Management and Data Flow

### 4.1 Active Store Configuration

The active store is configured in src/app/redux/store.js.

Registered reducers:

* api: RTK Query reducer from baseApi
* publicApi: RTK Query reducer for public certificate verification
* auth: auth slice
* certificate: certificate slice

Middleware:

* baseApi.middleware
* publicApi.middleware
* serializableCheck is disabled

### 4.2 Auth Hydration Flow

ProviderWrapper in src/app/redux/ProviderWrapper.js performs hydration on app load:

1. Reads user and token from localStorage.
2. Dispatches setCredentials when values are valid.
3. Dispatches setHydrated in all cases (success/failure) to unblock auth-aware UI.

### 4.3 Slice Responsibilities

* auth slice:
	* user, token, hydrated, loading, error
	* persistence helpers for localStorage
* certificate slice:
	* certificate search form state
	* certificate verification result state

## 5. API Layer Design

### 5.1 Base API

baseApi in src/services/baseApi.js defines:

* Base URL from NEXT_PUBLIC_API_BASE_URL (fallback localhost)
* credentials: include
* automatic Bearer token injection from Redux auth state
* JSON content-type by default, except multipart upload endpoints
* centralized tag types for cache invalidation

### 5.2 Endpoint Injection Modules

Feature modules inject endpoints into baseApi:

* authApi
* userApi
* memberApi
* certificateApi (private endpoints)
* contentApi
* adminApi
* contactApi

Additionally:

* publicApi (separate createApi instance) handles unauthenticated certificate verification route.

### 5.3 Non-RTK Fetch Calls

A small number of components use direct fetch:

* visitor counter (external hosted endpoint)
* bootcamp leaderboard endpoint

## 6. UI Composition Patterns

* Feature-focused component folders under src/components (for example BLOG, EVENT, GALLERY, PROFILE).
* Shared primitives in src/components/ui built on Radix and utility helpers.
* Client-side interactive pages/components are widely used where stateful behavior is required.

## 7. Content Strategy

The frontend uses a hybrid content strategy:

* Static JSON files in data/ for seeded and public content.
* API-driven content through contentApi and adminApi for dynamic and managed content.

## 8. Current Notes and Inconsistencies

These are implementation details visible in the current repo:

* The certificate slice filename is certificateSlise.js (typo in filename, but currently wired and working).
* src/features/posts/postApi.js exists but is currently empty.
* src/app/redux/rootReducer.js appears stale and is not the reducer used by the active store configuration.
