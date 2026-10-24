# Data Model: F004

## Tabla `phrases` (cambio)

| Columna | Tipo | Nulabilidad | Notas |
|---|---|---|---|
| `status` (NEW) | `smallint` + CHECK (`1`,`2`) | NOT NULL, default `1` | Estado de la frase; filtro de todas las consultas. Irreversible desde la API. |
| `deleted_at` (NEW) | `timestamptz` | NULL, sin default | Fecha de eliminación; la escribe `softDelete` junto con `status = 2` (no hay restricción en BD que ligue ambas columnas; el único CHECK es `status IN (1, 2)`). |

Resto de columnas sin cambios (`id`, `text`, `normalized_text`, `embedding`, `model_id`, `model_version`, `created_at`).

Migración: `ALTER TABLE "phrases" ADD COLUMN "status" smallint DEFAULT 1 NOT NULL, ADD COLUMN "deleted_at" timestamp with time zone;` (generada por `pnpm run db:generate`). Filas existentes quedan con `status = 1` y `deleted_at` NULL. Drizzle generó el CHECK `phrases_status_check` en `0002_*.sql` (definido en `drizzle-phrases.model.ts`); no hubo que añadirlo a mano.

## Estados

```text
Activa (status = 1 / ACTIVE) --DELETE--> Eliminada (status = 2 / DELETED, deleted_at = now())
Eliminada: terminal. Registrar el mismo texto crea otra fila (nuevo id).
```

## Consultas afectadas (`DrizzlePhraseRepository`)

| Operación | Cambio |
|---|---|
| `list` | `count(*)` y `select` con `WHERE status = 1`; mismo orden `created_at DESC, id DESC` |
| `findTextualMatch` | `AND status = 1` |
| `findVectorMatch` | `AND status = 1` |
| chequeo colección no vacía | `WHERE status = 1` |
| `softDelete` (NEW) | `UPDATE ... SET status = 2, deleted_at = now() WHERE id = $1 AND status = 1 RETURNING id` |

## Dominio / aplicación

- `Phrase` (entidad): sin cambios; solo se reconstruyen frases activas.
- `PhraseNotFoundError` (aplicación): `extends Error`, mensaje `La frase no existe.`
- `PhraseValidation`: sin cambios; `matched_phrase_id` puede apuntar a frase eliminada.
