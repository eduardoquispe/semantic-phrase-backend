# Implementation Plan: F004 — Eliminación lógica de frases

**Branch**: `004-soft-delete-phrases` | **Date**: 2026-10-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-soft-delete-phrases/spec.md`

## Summary

Añadir `DELETE /api/v1/phrases/{id}` (204/400/404/500) que marca `phrases.status = 2` y `deleted_at`. Listado, conteo, coincidencia textual, Top-1 vectorial y el chequeo de "colección no vacía" filtran `status = 1`. Se sigue la estructura hexagonal existente de `src/modules/phrases/`: puerto inbound + caso de uso, método nuevo en `PhraseRepositoryPort`, error de aplicación + filtro HTTP, columna + migración Drizzle. La entidad `Phrase` no cambia (solo se cargan frases activas). Ver [research.md](./research.md).

## Technical Context

**Language/Version**: TypeScript, NestJS (Node), pnpm

**Primary Dependencies**: NestJS, class-validator/class-transformer, Drizzle ORM (`drizzle-orm/node-postgres`), pgvector

**Storage**: PostgreSQL + pgvector; nuevas columnas `phrases.status SMALLINT NOT NULL DEFAULT 1` (CHECK `status IN (1, 2)`; 1 = ACTIVE, 2 = DELETED) y `phrases.deleted_at TIMESTAMPTZ NULL`

**Testing**: Jest (`*.spec.ts` junto al código), E2E supertest en `test/*.e2e-spec.ts` con repositorio sustituido

**Target Platform**: Servidor Linux/contenedor (API REST)

**Project Type**: web-service (backend de `apps/backend`)

**Performance Goals**: Sin nuevos objetivos; el filtro `status = 1` no degrada Top-1 exacto a escala MVP

**Constraints**: Contrato de errores `application/problem+json` vigente; sin `DELETE` físico; datos existentes quedan activos (`status` = `1` (activa) por defecto)

**Scale/Scope**: Lista compartida pequeña; 1 endpoint, 1 columna, 5 consultas ajustadas

## Constitution Check

*GATE: antes de Phase 0; re-evaluado tras Phase 1.*

| Principio | Evaluación |
|---|---|
| I. Modular Hexagonal | PASS — vive en `modules/phrases`; caso de uso depende de `PhraseRepositoryPort`; SQL solo en Drizzle; dominio intacto |
| II. Explicit API Contracts | PASS — contrato en [contracts/delete-phrase.md](./contracts/delete-phrase.md); `openapi.yaml` ya actualizado (`deletePhrase`, `PHRASE_NOT_FOUND`) |
| III. Tested Behavior | PASS (plan) — specs unitarios por componente + E2E `DELETE`; `build`, `test`, `test:e2e` |
| IV. Simple Dependencies | PASS — sin dependencias nuevas, sin value object `DeletedAt`, sin transacción |
| V. Config & Secrets | PASS — sin variables nuevas |

Sin violaciones; Complexity Tracking vacío. Re-check post-diseño: PASS.

## Project Structure

### Documentation (this feature)

```text
specs/004-soft-delete-phrases/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── delete-phrase.md
└── tasks.md             # $speckit-tasks (no creado aquí)
```

### Source Code (apps/backend)

```text
src/modules/phrases/
├── domain/enums/phrase-status.enum.ts                   # NEW (ACTIVE=1, DELETED=2)
├── application/
│   ├── errors/phrase-not-found.error.ts                 # NEW
│   ├── ports/inbound/delete-phrase.port.ts              # NEW
│   ├── ports/outbound/phrase-repository.port.ts         # + softDelete(id): Promise<boolean>
│   └── use-cases/delete-phrase.use-case.ts (+ .spec)    # NEW
├── infrastructure/
│   ├── http/
│   │   ├── controllers/phrases.controller.ts (+ .spec)  # + @Delete(':id') 204
│   │   ├── dtos/delete-phrase-params.dto.ts             # NEW (@IsUUID)
│   │   └── filters/phrase-not-found.filter.ts (+ .spec) # NEW 404 PHRASE_NOT_FOUND
│   └── persistence/drizzle/phrase/
│       ├── drizzle-phrases.model.ts                     # + status, deletedAt
│       └── drizzle-phrase.repository.ts (+ .spec)       # + softDelete; filtros activos
└── phrases.module.ts                                    # + DeletePhraseUseCase / DeletePhrasePort
drizzle/migrations/0002_*.sql (+ meta)                   # ADD COLUMN status + deleted_at (db:generate)
test/phrases.e2e-spec.ts                                 # + describe DELETE (o delete-phrase.e2e-spec.ts)
```

`Phrase` entity, mapper de dominio, `phrase-validations` y `CreatePhraseUseCase` no cambian.

**Structure Decision**: Extender la capability `phrases` existente según la skill `backend-architecture`; sin módulos, carpetas ni capas nuevas.

## Complexity Tracking

Sin violaciones.
