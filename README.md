# Semantic Phrase API

NestJS API for the shared phrase list. F001 exposes `GET /api/v1/phrases`; the starter `GET /` remains available.

## Local setup

Use Node.js 22 and pnpm. From the repository root, start PostgreSQL with `docker compose up -d postgres`. From `apps/backend`:

```sh
pnpm install
cp .env.example .env
```

Set `DATABASE_URL` to the local PostgreSQL URL. `.env.example` matches the repository Compose credentials. The application loads `.env` automatically through `ConfigModule` in `DatabaseModule`; existing shell variables take precedence. Drizzle CLI keeps its separate configuration and requires `DATABASE_URL` to be exported or supplied by an environment loader. `PORT` defaults to `3000`.

```sh
DATABASE_URL=postgresql://semantic:semantic@localhost:5432/semantic_phrase pnpm run db:migrate
pnpm run start:dev
```

Migrations run only when requested. `pnpm run db:generate` generates a new Drizzle migration from the schema; review generated SQL before applying it, particularly pgvector extension ordering.

## API

`GET /api/v1/phrases?page=1&limit=20` returns `data` with `id`, `text`, and `createdAt`, plus `meta` with `page`, `limit`, `total`, and `totalPages`. `page` starts at 1, `limit` ranges from 1 to 100, and only decimal digits are accepted. Invalid query input returns 400; database unavailability returns 503; unexpected failures return 500. Errors use `application/problem+json`.

## Checks

```sh
pnpm run build
pnpm test
pnpm run test:e2e
```

See [F001 quickstart](specs/001-list-phrases/quickstart.md) for manual acceptance scenarios.
