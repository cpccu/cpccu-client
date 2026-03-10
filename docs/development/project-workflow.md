# Project Workflow

## Contribution Process

### 1. Identify a Task
Check the GitHub Issues or the internal Roadmap for tasks. Comment on an issue to let others know you're working on it.

### 2. Prepare Your Environment
- Pull the latest changes from the `main` branch.
- Run `npm install` to ensure all dependencies are up to date.

### 3. Implement Changes
- Create a feature branch (see [Branching Strategy](branching-strategy.md)).
- Follow the [Coding Standards](coding-standards.md).
- Test your changes locally using `npm run dev`.

### 4. Review & Merge
- Push your branch to the remote repository.
- Open a Pull Request (PR) against the `main` branch.
- Address any feedback from the maintainers.
- Once approved, your changes will be merged.

## Continuous Integration
- All PRs are automatically checked for linting errors.
- Ensure all automated checks pass before requesting a review.
