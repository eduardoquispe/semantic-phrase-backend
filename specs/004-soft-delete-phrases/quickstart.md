# Quickstart: validar F004

## Prerrequisitos
- PostgreSQL + pgvector con `DATABASE_URL` en `.env` (ver `.env.example`).
- `pnpm install`

## Migración
```bash
pnpm run db:generate   # produce drizzle/migrations/0002_*.sql (status, deleted_at)
pnpm run db:migrate
```

## Checks automáticos
```bash
pnpm run build && pnpm test && pnpm run test:e2e
```

## Escenarios manuales (API en `pnpm run start:dev`)
Contrato: [contracts/delete-phrase.md](./contracts/delete-phrase.md).

1. Registrar frase (validar → `POST /api/v1/phrases`), anotar `id`.
2. `DELETE /api/v1/phrases/{id}` → **204** sin cuerpo.
3. `GET /api/v1/phrases` → la frase no aparece; `meta.total` baja en 1.
4. `DELETE` de nuevo → **404** `PHRASE_NOT_FOUND`.
5. `DELETE /api/v1/phrases/abc` → **400** `VALIDATION_ERROR`.
6. `POST /api/v1/phrase-validations` con el mismo texto → sin coincidencia textual/vectorial con la eliminada.
7. En SQL: `SELECT id, text, status, deleted_at FROM phrases WHERE id = '<id>'` → fila existe, `status = 2` y `deleted_at` no nulo, resto intacto (campos: [data-model.md](./data-model.md)).
8. Eliminar todas las frases y validar → colección vacía (éxito, sin 500).
