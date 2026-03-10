# Contributing to CPCCU Client

First off, thank you for considering contributing to the CPCCU Client! It's people like you that make the open-source community such a great place.

## 🤝 Code of Conduct

As a community-driven project, we value **respect, collaboration, and constructive feedback**.
- Be respectful and inclusive in all communications.
- Provide constructive feedback in code reviews.
- Focus on the problem, not the person.

## How Can I Contribute?

### Reporting Bugs
- Check the [Known Issues](docs/issues/known-issues.md) list.
- If not listed, open a GitHub Issue with clear steps to reproduce.

### Suggesting Enhancements
- Check the [Roadmap](docs/roadmap/project-roadmap.md) to see if it's already planned.
- Open an Issue with the "enhancement" label.

### Pull Requests
1. **Fork** the repository and **Clone** it locally.
2. Create a feature branch: `git checkout -b feature/amazing-feature`.
3. Commit your changes: `git commit -m 'feat: Add some amazing feature'`.
4. Push to the branch: `git push origin feature/amazing-feature`.
5. Open a **Pull Request**.

## 🌲 Branching Strategy
We use a feature-branch workflow. **Never push directly to `main`.**

### Naming Convention:
- Features: `feature/feature-name` (e.g., `feature/login-page`)
- Bug Fixes: `fix/bug-description` (e.g., `fix/header-alignment`)
- Documentation: `docs/doc-update` (e.g., `docs/readme-update`)
- Hotfixes: `hotfix/critical-issue` (e.g., `hotfix/security-patch`)

## 💬 Commit Message Format
We follow [Conventional Commits](https://www.conventionalcommits.org/):
- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation changes
- `style`: Changes that do not affect the meaning of the code
- `refactor`: A code change that neither fixes a bug nor adds a feature
- `perf`: A code change that improves performance
- `test`: Adding missing tests
- `chore`: Maintenance tasks

## 🎨 Code Style Guidelines
- Follow the [Coding Standards](docs/development/coding-standards.md).
- Run `npm run lint` before submitting.
- Use functional React components with hooks.
- Use Tailwind CSS for styling.

---
*Thank you for your hard work and contribution!* 🚀
