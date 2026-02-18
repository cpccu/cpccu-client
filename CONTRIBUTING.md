# Contributing to CPCCU Web

Welcome to the **CPCCU Web** project! We're excited to have you on the team. This document provides guidelines for contributing to our private repository to ensure smooth collaboration and high-quality code.

## 🤝 Code of Conduct

As a private team, we value **respect, collaboration, and constructive feedback**.
- Be respectful and inclusive in all communications.
- Provide constructive feedback in code reviews.
- Focus on the problem, not the person.

## 🚀 Getting Started

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd cpccu-client
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Start the development server:**
    ```bash
    npm run dev
    ```

## 🌿 Branching Strategy

We use a feature-branch workflow. **Never push directly to `main` or `master`.**

1.  **Main Branch (`main`)**: The production-ready code.
2.  **Development Branch (`develop`)** (Optional): Staging area for the next release.
3.  **Feature Branches**: Created for new features or fixes.

**Naming Convention:**
- Features: `feature/feature-name` (e.g., `feature/login-page`)
- Bug Fixes: `fix/bug-description` (e.g., `fix/header-alignment`)
- Documentation: `docs/doc-update` (e.g., `docs/readme-update`)
- Hotfixes: `hotfix/critical-issue` (e.g., `hotfix/security-patch`)

### Workflow:
1.  **Pull the latest changes:**
    ```bash
    git checkout main
    git pull origin main
    ```
2.  **Create a new branch:**
    ```bash
    git checkout -b feature/my-new-feature
    ```
3.  **Make your changes.**

## 💾 Committing Changes

Write clear and concise commit messages.

**Format:** `[Type]: Description`

**Types:**
- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation only changes
- `style`: Changes that do not affect the meaning of the code (white-space, formatting, etc)
- `refactor`: A code change that neither fixes a bug nor adds a feature
- `perf`: A code change that improves performance
- `test`: Adding missing tests or correcting existing tests
- `chore`: Changes to the build process or auxiliary tools and libraries such as documentation generation

**Example:**
```bash
git commit -m "feat: add user authentication form"
```

## 📥 Pull Request (PR) Process

1.  **Push your branch:**
    ```bash
    git push origin feature/my-new-feature
    ```
2.  **Create a Pull Request** on GitHub.
3.  **Title**: clear and descriptive.
4.  **Description**:
    - What does this PR do?
    - How did you test it?
    - Screenshots (if UI changes).
5.  **Review**: Request a review from at least one team member.
6.  **Merge**: Once approved, merge the PR (squash and merge is often preferred to keep history clean).

## 🎨 Coding Standards

- **Linting**: Run `npm run lint` before committing to ensure code quality.
- **Formatting**: We use Prettier/ESLint rules defined in the project.
- **Component Structure**: Keep components small and reusable.
- **Comments**: Comment complex logic, but prefer self-documenting code.

## 🐛 Reporting Issues

If you find a bug, please create an Issue on GitHub with:
- Steps to reproduce.
- Expected behavior.
- Actual behavior.
- Screenshots/Logs.

---
**Thank you for your hard work and contribution!** 🚀
