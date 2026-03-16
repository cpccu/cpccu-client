# Contribution Guide

Thank you for contributing to this project.
This document explains the **branching strategy, development workflow, and pull request process** to keep the repository organized and maintainable.

---

**`CONTRIBUTION.md`** overview:

* `main` → production
* `dev` → development integration
* `feature branches` → created from `dev`
* `release` → release preparation

---


# Branching Strategy

The repository follows a structured Git workflow.

## Main Branches

### `main`

* Contains **stable production-ready code**
* Only updated during **official releases**
* Direct commits are **not allowed**

### `dev`

* Integration branch for **all ongoing development**
* All feature branches must be merged into `dev`
* Acts as the base branch for new development work

### `release`

* Used for preparing production releases
* Created from `main`
* Only used for **release-related updates**

---

# Development Workflow

The development flow is:

```
main → dev → feature branches
```

### Step 1 — Start Development

Always create a new branch from **`dev`**.

Example:

```bash
git checkout dev
git pull origin dev
git checkout -b feat-user-authentication
```

Important rule:

**Every new feature branch must be created from `dev`.**

Even if your previous feature was already merged, the next feature must still branch from `dev`.

Example scenario:

1. You create `feat-1` from `dev`
2. You open a PR from `feat-1` → `dev`
3. The PR gets approved and merged
4. Now you start another feature

Correct workflow:

```
dev → feat-2
```

Not:

```
feat-1 → feat-2  ❌
```

---

# Feature Branch Naming

Use clear and descriptive names.

Format:

```
feat-{feature-name}
```

Examples:

```
feat-login-system
feat-payment-integration
feat-user-profile
```

Other types may include:

```
fix-{bug-name}
refactor-{module}
chore-{task}
```

---

# Commit Message Guidelines

Use clear commit messages.

Format:

```
type: short description
```

Examples:

```
feat: add login api
fix: resolve payment validation bug
refactor: optimize user service logic
```

---

# Pull Request Process

1. Push your branch to the repository.

```bash
git push origin feat-user-authentication
```

2. Create a Pull Request:

```
feat-branch → dev
```

3. Add a clear description of:

* What the feature does
* Why it was implemented
* Any related issue or task

4. Wait for code review.

5. Once approved, it will be merged into `dev`.

---

# Release Workflow

Release flow:

```
main → release
```

Steps:

1. Create release branch from `main`

```bash
git checkout main
git pull origin main
git checkout -b release-v1.0
```

2. Perform release preparations:

* version bump
* final testing
* documentation updates

3. Merge release into `main`.

---

# Important Rules

* Never commit directly to `main`
* Never commit directly to `dev`
* Always create a branch for your work
* Always open a Pull Request for merging
* Keep PRs small and focused

---

# Example Full Workflow

*Development:*

``` 
main
  ↓
dev
  ↓
feat-user-login
  ↓
PR → dev
  ↓
merged
  ↓
dev
  ↓
feat-payment
```

*Release:*

```
dev
  ↓
PR → main
  ↓
merged
  ↓
main
  ↓
release -> deploy
```

---

# Thank You

Following this contribution workflow helps keep the repository stable, maintainable, and collaborative.

Happy coding.
