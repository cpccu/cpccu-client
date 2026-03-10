# Branching Strategy

The project follows a modified GitHub Flow strategy to ensure a stable main branch and organized feature development.

## Branches

### `main`
- The production-ready branch.
- Always deployable.
- Direct commits to `main` are discouraged.

### `feature/*`
- Used for developing new features.
- Example: `feature/login-validation`, `feature/alumni-search`

### `fix/*`
- Used for bug fixes.
- Example: `fix/header-overlap`, `fix/mobile-menu-scroll`

### `docs/*`
- Used for documentation-only changes.
- Example: `docs/api-updates`, `docs/setup-guide`

## Commit Messages
We follow the conventional commits specification:
- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation only changes
- `style`: Changes that do not affect the meaning of the code (white-space, formatting, etc.)
- `refactor`: A code change that neither fixes a bug nor adds a feature
- `test`: Adding missing tests or correcting existing tests
- `chore`: Changes to the build process or auxiliary tools and libraries
