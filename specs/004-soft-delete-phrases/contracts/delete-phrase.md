# Contract: DELETE /api/v1/phrases/{id}

Fuente de verdad: `../../../../docs/03-architecture/openapi.yaml` (`deletePhrase`, componente `PhraseNotFound`). Este archivo resume lo que implementa el backend.

| Aspecto | Valor |
|---|---|
| Método/ruta | `DELETE /api/v1/phrases/{id}` |
| Path `id` | UUID (`@IsUUID()`) |
| Cuerpo / query | Ignorados |
| Auth | Ninguna (DEC-009) |

## Respuestas

| Estado | Caso | Cuerpo |
|---|---|---|
| 204 | Frase activa marcada `status = 2` con `deleted_at` | Sin cuerpo |
| 400 | `id` no UUID | `application/problem+json`, `code: VALIDATION_ERROR` |
| 404 | Inexistente o ya eliminada | `code: PHRASE_NOT_FOUND`, `detail: La frase no existe.` |
| 500 | Fallo de BD | `code: DATABASE_ERROR` |

Problem+json: `title`, `status`, `detail`, `code`; sin `type` ni trazas.

```json
{ "title": "Not Found", "status": 404, "detail": "La frase no existe.", "code": "PHRASE_NOT_FOUND" }
```

## Efectos en otros contratos (sin cambio de forma)

- `GET /api/v1/phrases`: solo activas; `meta.total`/`totalPages` solo activas.
- `POST /api/v1/phrase-validations`: ignora eliminadas (texto y vector).
- `POST /api/v1/phrases`: sin cambio.
