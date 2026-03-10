# System Architecture

## Overview
The CPCCU Client is built as a modern Single Page Application (SPA) using a component-based architecture. It emphasizes modularity, data-driven rendering, and efficient state management.

## Architecture Layers

### 1. Presentation Layer (Components)
- Built with **React.js**.
- Uses **Functional Components** and **Hooks**.
- Styled with **Tailwind CSS** for a responsive and consistent UI.
- Organized into atomic units (Global, Home, Profile, etc.).

### 2. State & Context Layer
- Uses **React Context API** for global state management (e.g., scroll targets).
- Local state managed via `useState` and `useRef` within components.

### 3. Data Layer
- Currently relies on **Static JSON Files** located in the `data/` directory.
- Components import these JSON files directly to render dynamic content.
- This architecture allows for easy transition to a REST API backend in the future.

### 4. Routing Layer
- Powered by **React Router DOM v6**.
- Implements nested routing and catch-all routes for a seamless navigation experience.

## Design Patterns
- **Provider Pattern**: Used with Context API to broadcast state to the component tree.
- **Layout Pattern**: Centralized Layout components for consistent header/footer across pages.
- **Utility-First CSS**: Leveraging Tailwind CSS for rapid UI development and maintenance.
