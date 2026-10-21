<!--
Sync Impact Report
- Version change: 1.0.0 → 1.1.0 (expanded architecture principle).
- Modified principles: I. Feature Modules → I. Modular Hexagonal Architecture.
- Added sections: none.
- Removed sections: none.
- Follow-up TODOs: none.
-->
# Semantic Phrase App Backend Constitution

## Core Principles

### I. Modular Hexagonal Architecture
New capabilities MUST live in modules under `src/modules/<capability>/`, organized into domain,
application, and infrastructure layers. Domain rules MUST remain independent of NestJS, HTTP,
and persistence; application use cases MUST depend on ports rather than concrete adapters.
Infrastructure MUST implement those ports, and NestJS modules MUST compose the dependencies.
These boundaries keep business rules independent of tools.

### II. Explicit API Contracts
Routes MUST define their expected inputs, outputs, and error behavior. Changes to existing
contracts MUST be documented and reviewed for compatibility so clients can rely on them.

### III. Tested Behavior
Changed service or controller behavior MUST have nearby unit tests. New or changed HTTP behavior
MUST have end-to-end tests under `test/`. Both suites MUST pass before an API change is complete.

### IV. Simple Dependencies
Implementations MUST use the simplest structure that satisfies current requirements. New
abstractions or dependencies MUST have a concrete use case; this limits maintenance cost.

### V. Configuration and Secrets
Credentials MUST NOT be committed. New required environment variables MUST be documented with
safe example values so local setup remains reproducible.

## Technical Constraints

Use TypeScript, NestJS, and pnpm. Keep source in `src/`, unit tests beside source as `*.spec.ts`,
and HTTP tests in `test/` as `*.e2e-spec.ts`. Follow repository Prettier and ESLint settings.

## Development Workflow

For API changes, run `pnpm run build`, `pnpm test`, and `pnpm run test:e2e`. Review any edits made
by `pnpm run lint` before committing. Pull requests MUST explain behavior changes, list checks
run, and include request and response examples when the API contract changes.

## Governance

This constitution governs backend changes. Amendments MUST update this file, state the reason,
and receive review with the related change. Reviewers MUST check affected work against these
principles. Version amendments using semantic versioning: MAJOR for incompatible rule changes,
MINOR for added or materially expanded rules, and PATCH for clarifications.

**Version**: 1.1.0 | **Ratified**: 2026-10-21 | **Last Amended**: 2026-10-21
