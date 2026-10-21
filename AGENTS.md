# Repository Guidelines

## Project Structure & Module Organization

This directory is a NestJS backend. Application code lives in `src/`: `main.ts` starts the server, `app.module.ts` wires dependencies, and the controller and service handle the starter route. Keep new modules, controllers, and services in `src/`, grouped by feature as the API grows. Unit tests sit beside source files as `*.spec.ts`; HTTP end-to-end tests live in `test/` as `*.e2e-spec.ts`. Build output goes to `dist/`, and coverage reports go to `coverage/`; neither belongs in commits.

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

Jest and `ts-jest` run tests in Node. Add a nearby `*.spec.ts` for service or controller behavior and a `test/*.e2e-spec.ts` for routes or request behavior. Run both test suites for API changes. `pnpm run test:cov` generates a report; no coverage threshold is configured, so review coverage for the code you change.

## Commit & Pull Request Guidelines

Git history currently contains only `Initial commit`, so no established commit-message format is evident. Use a short, imperative subject that describes the change. In pull requests, explain the behavior changed, note commands run, and link a relevant issue when one exists. Include request and response examples for API changes; screenshots are useful only for changes with visible output.

## Configuration & Secrets

Keep credentials out of commits. Local `.env` files are ignored by Git. Document any new required environment variable and provide a safe example value; the current server only reads `PORT`.
