# Security Guidelines

## Core Security Practices
As a frontend application, our security focus is on protecting user data and ensuring the integrity of the client-side experience.

### 1. Data Sanitization
- All dynamic content rendered from JSON is treated as data, not code.
- We use standard React patterns to prevent Cross-Site Scripting (XSS).

### 2. Dependency Management
- We use `npm audit` and Dependabot to monitor and fix vulnerabilities in third-party libraries.
- All dependencies are pinned to specific versions to prevent supply chain attacks.

### 3. Authentication (Future)
- Transitioning to secure HTTP-only cookies for token storage.
- Implementing CSRF protection for all mutating requests.

## Reporting a Vulnerability
If you discover a security vulnerability, please do **NOT** open a public issue. Instead, email the maintainers directly at `security@cpccu.org`.
