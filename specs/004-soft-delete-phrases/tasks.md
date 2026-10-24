---

description: "Task list for F004 — Eliminación lógica de frases"
---

# Tasks: F004 — Eliminación lógica de frases

**Input**: `/specs/004-soft-delete-phrases/` (plan.md, spec.md, research.md, data-model.md, contracts/delete-phrase.md, quickstart.md)

**Tests**: Incluidos (constitución III: specs unitarios junto al código + E2E en `test/`; plan los exige).

**Organization**: Por historia de usuario. Rutas relativas a `apps/backend/`. Docs fuente en `../../docs/` (raíz del monorepo).

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

- [X] T001 Verificar baseline verde: `pnpm run build && pnpm test && pnpm run test:e2e` en `apps/backend/`

---

## Phase 2: Foundational (bloquea todas las historias)

**Purpose**: columnas `status`/`deleted_at` y migración; sin esto no compila el modelo ni las consultas.

- [X] T002 [P] Crear `PhraseStatusEnum { ACTIVE = 1, DELETED = 2 }` en `src/modules/phrases/domain/enums/phrase-status.enum.ts`, mismo estilo que `validation-match.enum.ts`
- [X] T003 Añadir columnas `status` (`smallint` NOT NULL default `1`, CHECK `status IN (1, 2)`; usando `PhraseStatusEnum`) y `deletedAt` (`timestamp with time zone`, nullable) a `src/modules/phrases/infrastructure/persistence/drizzle/phrase/drizzle-phrases.model.ts`
- [X] T004 Generar migración con `pnpm run db:generate` → `drizzle/migrations/0002_*.sql` (+ `meta/0002_snapshot.json`, `meta/_journal.json`); verificar que añada `status` (smallint NOT NULL DEFAULT 1) y `deleted_at`; Nota (implementación): Drizzle generó el CHECK `status IN (1, 2)`; no se añadió a mano

**Checkpoint**: modelo y migración listos.

---

## Phase 3: User Story 1 — Eliminar una frase de la lista compartida (P1) 🎯 MVP

**Goal**: `DELETE /api/v1/phrases/{id}` marca `status = 2` y `deleted_at`, responde 204; el listado y su total solo cuentan activas.

**Independent Test**: registrar frase, `DELETE` por id → 204; `GET /api/v1/phrases` no la muestra y `meta.total` baja; la fila sigue en BD.

### Tests for US1

- [X] T005 [P] [US1] Spec del caso de uso (éxito → resuelve; `softDelete` false → lanza `PhraseNotFoundError`) en `src/modules/phrases/application/use-cases/delete-phrase.use-case.spec.ts`
- [X] T006 [P] [US1] Ampliar `src/modules/phrases/infrastructure/persistence/drizzle/phrase/drizzle-phrase.repository.spec.ts`: `softDelete` (true con fila devuelta, false vacío, error → `DatabaseError`) y `list` con `status = 1` en `count` y `select`
- [X] T007 [P] [US1] Ampliar `src/modules/phrases/infrastructure/http/controllers/phrases.controller.spec.ts`: `DELETE :id` delega en `DeletePhrasePort` y devuelve sin cuerpo
- [X] T008 [P] [US1] E2E `DELETE` éxito 204 + listado sin la frase y `total` reducido (repositorio sustituido) en `test/phrases.e2e-spec.ts`

### Implementation for US1

- [X] T009 [P] [US1] Crear `PhraseNotFoundError` (`extends Error`, mensaje `La frase no existe.`) en `src/modules/phrases/application/errors/phrase-not-found.error.ts`
- [X] T010 [P] [US1] Crear puerto inbound `DeletePhrasePort` (token + interfaz `execute(id: string): Promise<void>`) en `src/modules/phrases/application/ports/inbound/delete-phrase.port.ts`, mismo estilo que `list-phrases.port.ts`
- [X] T011 [US1] Añadir `softDelete(id: string): Promise<boolean>` a `src/modules/phrases/application/ports/outbound/phrase-repository.port.ts`
- [X] T012 [US1] Implementar `DeletePhraseUseCase` en `src/modules/phrases/application/use-cases/delete-phrase.use-case.ts` (lanza `PhraseNotFoundError` si `softDelete` es false) (depende de T009–T011)
- [X] T013 [US1] Implementar `softDelete` en `src/modules/phrases/infrastructure/persistence/drizzle/phrase/drizzle-phrase.repository.ts`: `UPDATE ... SET status = PhraseStatusEnum.DELETED, deleted_at = sql\`now()\` WHERE id = $1 AND status = PhraseStatusEnum.ACTIVE RETURNING id`, envolviendo errores como `DatabaseError` igual que los métodos existentes; añadir `eq(status, PhraseStatusEnum.ACTIVE)` a `count(*)` y `select` de `list`
- [X] T014 [P] [US1] Crear `DeletePhraseParamsDto { @IsUUID() id: string }` en `src/modules/phrases/infrastructure/http/dtos/delete-phrase-params.dto.ts`
- [X] T015 [P] [US1] Crear `PhraseNotFoundFilter extends DomainExceptionFilter` (404, `PHRASE_NOT_FOUND`) en `src/modules/phrases/infrastructure/http/filters/phrase-not-found.filter.ts`, siguiendo `invalid-phrase.filter.ts`
- [X] T016 [US1] Añadir `@Delete(':id')` `@HttpCode(204)` `@UseFilters(PhraseNotFoundFilter)` con `@Param() DeletePhraseParamsDto` en `src/modules/phrases/infrastructure/http/controllers/phrases.controller.ts` (depende de T010, T014, T015)
- [X] T017 [US1] Registrar `DeletePhraseUseCase`/`DeletePhrasePort` en `src/modules/phrases/phrases.module.ts`

**Checkpoint**: US1 funcional y testeable (204 + listado filtrado).

---

## Phase 4: User Story 2 — Excluir eliminadas de validaciones (P1)

**Goal**: coincidencia textual, Top-1 vectorial y chequeo de colección no vacía ignoran frases eliminadas.

**Independent Test**: eliminar una frase y validar su mismo texto y uno similar → sin coincidencia con ella; con todas eliminadas → colección vacía, sin error.

### Tests for US2

- [X] T018 [US2] Ampliar `src/modules/phrases/infrastructure/persistence/drizzle/phrase/drizzle-phrase.repository.spec.ts`: `findTextualMatch`, `findVectorMatch` y chequeo de colección no vacía incluyen `status = 1` (misma archivo que T006: no paralelo)
- [X] T019 [P] [US2] E2E en `test/phrase-validations.e2e-spec.ts`: colección con todas eliminadas se trata como vacía (sin 500) Nota (implementación): solo existe el caso de colección con todas las frases eliminadas (`phrase-validations.e2e-spec.ts`); no hay un E2E específico de «validación previa que cita una frase eliminada» ni de registro F003 con ella (repositorio sustituido)

### Implementation for US2

- [X] T020 [US2] Añadir `status = 1` a `findTextualMatch`, `findVectorMatch` y al `SELECT id FROM phrases LIMIT 1` en `src/modules/phrases/infrastructure/persistence/drizzle/phrase/drizzle-phrase.repository.ts` (misma archivo que T013; secuencial)

**Checkpoint**: US1 + US2 independientes y funcionales.

---

## Phase 5: User Story 3 — Rechazar eliminaciones no aplicables (P2)

**Goal**: 404 `PHRASE_NOT_FOUND`, 400 `VALIDATION_ERROR`, 500 `DATABASE_ERROR` sin modificar datos.

**Independent Test**: borrar dos veces la misma frase, un UUID inexistente y `abc`.

### Tests for US3

- [X] T021 [P] [US3] Spec del filtro (404, `code: PHRASE_NOT_FOUND`, `detail: La frase no existe.`, `application/problem+json`, sin `type`) en `src/modules/phrases/infrastructure/http/filters/phrase-not-found.filter.spec.ts`
- [X] T022 [P] [US3] E2E en `test/phrases.e2e-spec.ts`: segundo `DELETE` → 404 `PHRASE_NOT_FOUND`; `id` no UUID → 400 `VALIDATION_ERROR`; fallo de repositorio → 500 `DATABASE_ERROR`; cuerpo/query ignorados

### Implementation for US3

- [X] T023 [US3] Confirmar que el flujo 404/400/500 cumple T021–T022 (filtro T015, DTO T014, filtro global existente); corregir si falla

**Checkpoint**: contrato de errores completo.

---

## Phase 6: Polish — Docs y OpenAPI

- [X] T024 [P] Verificar que `../../docs/03-architecture/openapi.yaml` coincide con `contracts/delete-phrase.md`: operación `deletePhrase` (204/400/404/500), componente `PhraseNotFound`, código `PHRASE_NOT_FOUND`, nota de que `GET /phrases` y `POST /phrase-validations` ignoran eliminadas; corregir diferencias
- [X] T025 [P] Verificar/actualizar `../../docs/00-discovery/product-brief.md` (FR-016–FR-019, UF-006, BR-016, BR-017, AC-011–AC-013, EC-014, EC-015, DEC-006, DEC-009, DEC-014) para eliminación lógica
- [X] T026 [P] Verificar/actualizar `../../docs/03-architecture/05-data-architecture.md` (§4.1 `status`, `deleted_at`, §6 consultas con `status = 1`, §7 índices) y `../../docs/03-architecture/06-api-security.md` (§2, §3, §4.4, §7)
- [X] T027 [P] Verificar/actualizar `../../docs/03-architecture/02-backend-architecture.md` (caso de uso `DeletePhrase`, `softDelete` en puerto) y `../../docs/02-ui/ui-spec.md` (confirmación y eliminación lógica)
- [X] T028 [P] Actualizar `README.md` (sección API): añadir `DELETE /api/v1/phrases/{id}` (204/400/404/500), listado solo activas, validación ignora eliminadas, enlace a `specs/004-soft-delete-phrases/quickstart.md`
- [X] T029 Ejecutar `pnpm run build && pnpm test && pnpm run test:e2e` y revisar cambios de `pnpm run lint`
- [ ] T030 Validar `quickstart.md` contra PostgreSQL real (`pnpm run db:migrate`, escenarios 1–8)

---

## Dependencies & Execution Order

- Phase 1 → Phase 2 (bloquea) → US1 → US2 → US3 → Polish.
- US1 es MVP. US2 depende de T013 (mismo archivo de repositorio) pero es testeable por separado. US3 valida piezas creadas en US1 (T014–T016).
- Dentro de US1: T009–T011 antes de T012; T013 independiente del HTTP; T016 tras T010/T014/T015; T017 tras T012/T016.
- Tests de cada historia se escriben antes y deben fallar.
- Docs (T024–T027) independientes del código; pueden hacerse en paralelo desde el inicio.

## Parallel Examples

```text
US1 tests:  T005, T006, T007, T008
US1 base:   T009, T010, T014, T015
Docs:       T024, T025, T026, T027, T028
```

## Implementation Strategy

- **MVP**: Phase 1–2 + US1 (T001–T017); validar con quickstart pasos 1–3.
- **Incremental**: + US2 (filtros de validación) → + US3 (errores) → Polish (docs/OpenAPI/README).

## Notes

- `Phrase`, mapper de dominio, `phrase-validations` y `CreatePhraseUseCase` no cambian.
- Sin dependencias, variables de entorno ni índices nuevos.
- No hay `.specify/extensions.yml`: sin hooks.
