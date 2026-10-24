# Repository Guidelines

## Project Structure & Module Organization

This directory is the NestJS 11 backend. `src/main.ts` starts the server (`PORT`, default `3000`) and `src/configure-app.ts` centralizes the global setup: `api` prefix, `ValidationPipe` (`transform`, `whitelist`, `forbidNonWhitelisted`), CORS for `http://localhost:5173` and the global `ProblemDetailsFilter`. `src/app.module.ts` composes `ConfigurationModule`, `DatabaseModule` and `PhrasesModule`.

The only capability is `src/modules/phrases/`, split into `domain/`, `application/` and `infrastructure/` (`embeddings/`, `http/`, `persistence/drizzle/`). Cross-cutting code lives in `src/shared/` (configuration port, database provider, Problem Details). Place new capabilities under `src/modules/<capability>/` and compose them in `app.module.ts`. Follow `.agents/skills/backend-architecture/SKILL.md` for layer and file placement; consult `.specify/memory/constitution.md` for project principles.

HTTP API (prefix `/api/v1`): `GET /phrases`, `POST /phrases`, `DELETE /phrases/:id` (soft delete) and `POST /phrase-validations`. Errors use RFC 9457-style Problem Details (`application/problem+json`). The API contract is in `README.md`, `specs/` and `../../docs/03-architecture/openapi.yaml`.

Unit tests sit beside source files as `*.spec.ts`; HTTP end-to-end tests live in `test/` as `*.e2e-spec.ts` (ports are mocked, so they need neither Postgres nor the embeddings service). Build output goes to `dist/`, and coverage reports go to `coverage/`; neither belongs in commits.

## Build, Test, and Development Commands

Use pnpm, as indicated by `pnpm-lock.yaml`.

- `pnpm install` installs dependencies.
- `pnpm run start:dev` starts the server with file watching. It needs Postgres (with pgvector) and the TEI `embeddings` service: `docker compose up -d --wait` from the repository root. Boot fails if `DATABASE_URL` is missing, if `AI_EMBEDDING_DIMENSIONS` is not `384`, or if the embeddings service does not answer the startup probe.
- `pnpm run db:generate` creates a Drizzle migration from `*.model.ts` changes; `pnpm run db:migrate` applies migrations (`DATABASE_URL` comes from `.env` or the shell).
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

Spec Kit files live in `.specify/`, with related skills in `.agents/skills/`. Feature specs are in `specs/001-list-phrases`, `002-semantic-similarity-validation`, `003-register-phrases-hitl` and `004-soft-delete-phrases`. For specification-driven work, use the relevant skill and keep the feature's spec, plan, and tasks aligned with `.specify/memory/constitution.md`. Define inputs, outputs, and error behavior for API routes, and document compatibility changes before implementation. When code and a spec disagree, update the spec to match the implemented behavior.

## Configuration & Secrets

Keep credentials out of commits. Local `.env` files are ignored by Git; copy `.env.example` and adjust. Document any new required environment variable and provide a safe example value. Variables read today:

- `DATABASE_URL` (required), `PORT` (default `3000`).
- `AI_EMBEDDINGS_URL`, `AI_MODEL`, `AI_EMBEDDING_VERSION`, `AI_EMBEDDING_DIMENSIONS` (must be `384`), `AI_INFERENCE_TIMEOUT_MS`.
- `AI_SIMILARITY_THRESHOLD` (default `0.8538613695045911`) and `PHRASE_VALIDATION_TTL_MINUTES` (default `15`).

There is no schema validation of the configuration: only `DATABASE_URL`, the dimensions, `AI_MODEL` and `AI_EMBEDDING_VERSION` are checked.
