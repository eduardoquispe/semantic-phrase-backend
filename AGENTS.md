# Repository Guidelines

## Project Structure & Module Organization

This directory is the NestJS 11 backend. It currently contains the starter `GET /` route: `src/main.ts` starts the server, `src/app.module.ts` composes dependencies, and `src/app.controller.ts` delegates to `src/app.service.ts`.

Place new capabilities under `src/modules/<capability>/` and compose them in `app.module.ts`. Follow `.agents/skills/backend-architecture/SKILL.md` for layer and file placement; consult `.specify/memory/constitution.md` for project principles.

Unit tests sit beside source files as `*.spec.ts`; HTTP end-to-end tests live in `test/` as `*.e2e-spec.ts`. Build output goes to `dist/`, and coverage reports go to `coverage/`; neither belongs in commits.

## Build, Test, and Development Commands

Use pnpm, as indicated by `pnpm-lock.yaml`.

- `pnpm install` installs dependencies.
- `pnpm run start:dev` starts the server with file watching; it listens on `PORT` or defaults to `3000`.
- `pnpm run build` compiles the application into `dist/`.
- `pnpm run start:prod` runs the compiled application after a build.
- `pnpm run lint` checks and fixes TypeScript lint issues; review its edits before committing.
- `pnpm run format` formats TypeScript files in `src/` and `test/`.
- `pnpm test`, `pnpm run test:e2e`, and `pnpm run test:cov` run unit tests, HTTP tests, and coverage respectively.

## Coding Style & Naming Conventions

Write TypeScript with two-space indentation. Follow the repository's Prettier settings: single quotes and trailing commas. ESLint uses type-aware TypeScript rules and checks Prettier formatting. Use NestJS decorators and dependency injection for controllers and services. Name files in lowercase dot-separated form, such as `phrases.controller.ts`, with matching classes such as `PhrasesController`.

## Testing Guidelines

Jest and `ts-jest` run tests in Node. Add nearby `*.spec.ts` tests for changed behavior and `test/*.e2e-spec.ts` tests for new or changed HTTP behavior. Run `pnpm run build`, `pnpm test`, and `pnpm run test:e2e` for API changes. `pnpm run test:cov` generates a report; no coverage threshold is configured, so review coverage for the code you change.

## Commit & Pull Request Guidelines

Use a short, imperative commit subject that describes the change. In pull requests, explain the behavior changed, note commands run, and link a relevant issue when one exists. Include request and response examples for API contract changes; screenshots are useful only for changes with visible output.

## Feature Specifications

Spec Kit files live in `.specify/`, with related skills in `.agents/skills/`. For specification-driven work, use the relevant skill and keep the feature's spec, plan, and tasks aligned with `.specify/memory/constitution.md`. Define inputs, outputs, and error behavior for API routes, and document compatibility changes before implementation.

## Configuration & Secrets

Keep credentials out of commits. Local `.env` files are ignored by Git. Document any new required environment variable and provide a safe example value; the current server only reads `PORT`.
