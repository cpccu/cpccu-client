# Coding Standards

To maintain code quality and consistency across the project, all contributors are expected to follow these guidelines.

## General Principles
- **Clarity over Cleverness**: Write code that is easy to read and understand.
- **DRY (Don't Repeat Yourself)**: Extract reusable logic into components or utility functions.
- **Single Responsibility**: Each component should ideally do one thing well.

## React & JavaScript
- **Functional Components**: Use functional components with hooks over class components.
- **Naming Conventions**:
  - Components: `PascalCase` (e.g., `EventList.jsx`)
  - Utilities/Hooks: `camelCase` (e.g., `useAuth.js`)
  - Constants: `UPPER_SNAKE_CASE` (e.g., `API_BASE_URL`)
- **Prop Types**: Document component props using `prop-types` library.

## Styling (Tailwind CSS)
- Use standard Tailwind classes.
- Avoid large blocks of inline styles.
- Use the `cn()` utility for conditional class application.

## Linting
- Always run `npm run lint` before committing.
- Follow the rules defined in `.eslintrc.cjs`.
