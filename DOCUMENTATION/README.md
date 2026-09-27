# CPCCU — Documentation

This is the documentation hub for `cpccu/cpccu-client`, which is the **whole platform**: the UI, the routing, the state, **and** the API. The docs describe the system **as it exists now**. When code and docs disagree, the code is correct — if you change the code, update the docs in the same PR.

---

## Getting Started

| Document | What you'll find |
| :--- | :--- |
| [Developer Onboarding](./DEVELOPER_ONBOARDING.md) | "I just joined the team — what do I do?" End-to-end setup, prerequisites, env vars, useful routes, common mistakes. |
| [README](../README.md) | Features, tech stack, quick start, and the notes section. |

## Architecture

| Document | What you'll find |
| :--- | :--- |
| [Architecture Overview](./ARCHITECTURE.md) | The frontend: folder structure, routing, state management (Redux/RTK Query), auth, profile/certificate/job-pipeline/contributor systems, admin panel, utilities. |
| [Backend Migration](./BACKEND_MIGRATION.md) | The API: how the Express backend was migrated into route handlers in this repo and cut over to same-origin. The 65-endpoint table, the security review outcome, the deliberate divergences, the preserved defects, the rate-limiting risk, and the frontend cutover checklist. **Read §8 before deploying.** |
| [Architecture Decision Records](./ADR.md) | Why the project is built this way (deployment, certificates, uniID lookup, GitHub contributors, dynamic roles, profile sections, job pipeline, RTK Query, security headers, auth, backend-enforced verification) — **including the decisions that have been superseded, and why.** |

## API

| Document | What you'll find |
| :--- | :--- |
| [API Documentation](./API_DOCUMENTATION.md) | Every endpoint the frontend consumes, grouped by module, with payloads, tags, the session model, and notes on removed dead endpoints. |

## Features

| Document | What you'll find |
| :--- | :--- |
| [Admin Panel Implementation](./CPCCU_Admin_Panel_Implementation_Documentation.md) | Admin roles, modules, data flow, GitHub-synced contributors, statistics, migration notes. |

## Operations

| Document | What you'll find |
| :--- | :--- |
| [Deployment](./DEPLOYMENT.md) | Single-origin Vercel deployment of the app and its API, env vars, the hosting constraint, and a post-deploy smoke test. |
| [Troubleshooting](./TROUBLESHOOTING.md) | Real project-specific problems and fixes (connectivity, env, CSRF 403s, OTP, sessions, deploys, tests). |
| [Security](./SECURITY.md) | Security architecture, the `httpOnly` session model, CSRF, email-verification enforcement, and known debt. |
| [Contribution Guide](./CONTRIBUTION.md) | Branching strategy and pull request workflow. |
| [CLAUDE.md](./CLAUDE.md) | Technical map for AI coding agents working in this repo. |

---

## On the old `cpccu-server` repository

`cpccu-server` was the Express + MongoDB backend. It was migrated into this repository as App Router route handlers and the frontend was cut over to them, so **`cpccu-server` is now a read-only archived baseline**: nothing in this repository depends on it at build time or runtime, and there is no reason to clone, run or deploy it.

Its own documentation is kept as the provenance for ported decisions — it is the best available answer to "why does this code look like that":

- [cpccu-server docs index](https://github.com/cpccu/cpccu-server/blob/dev/docs/INDEX.md)
- [cpccu-server architecture](https://github.com/cpccu/cpccu-server/blob/dev/docs/ARCHITECTURE.md)
- [cpccu-server API reference](https://github.com/cpccu/cpccu-server/blob/dev/docs/API_REFERENCE.md)

Where a document in this folder cites a `cpccu-server` file and line, it is citing **where a decision came from**, not where the code lives. [BACKEND_MIGRATION.md](./BACKEND_MIGRATION.md) is the authoritative account of what the port changed and what it deliberately preserved.

**Two things still reach outside this repository**, both recorded rather than hidden: there is no JSON→Mongo seed script here (it exists only in the archived repo and has not been ported), and `scripts/update_contributors.py` still fetches commit counts from `cpccu/cpccu-server` for the contributor statistics.

**Division of responsibility today:** this repo owns the UI, routing, state, static content (`data/`), the API, MongoDB access, authentication enforcement, email, uploads, and the GitHub contributor write-back.