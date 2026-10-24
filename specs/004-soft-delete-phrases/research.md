# Research: F004 — Eliminación lógica

Sin `NEEDS CLARIFICATION` pendientes. Decisiones:

## D1 — Atomicidad y 404 en una sola sentencia
- **Decision**: `UPDATE phrases SET status = 2, deleted_at = now() WHERE id = $1 AND status = 1 RETURNING id`; fila devuelta ⇒ `true`, vacío ⇒ `false`.
- **Rationale**: Un `UPDATE` condicional es atómico; con concurrencia solo una obtiene fila (204), el resto 404 (spec Edge Cases). No hace falta transacción ni lectura previa.
- **Alternatives**: SELECT+UPDATE (carrera); `SELECT ... FOR UPDATE` en transacción (complejidad innecesaria, viola principio IV).

## D2 — Puerto: `softDelete(id: string): Promise<boolean>`
- **Decision**: Método en `PhraseRepositoryPort`; el caso de uso lanza `PhraseNotFoundError` si `false`.
- **Rationale**: Sigue el patrón del puerto actual (`save`, `list`); la regla "no existe ⇒ error de flujo" es de aplicación, no de infraestructura. No se carga la entidad: el dominio no necesita estado "eliminado" porque solo se reconstruyen frases activas.
- **Alternatives**: `findById` + `phrase.delete()` + `save` (más I/O, carrera, entidad frozen); puerto separado (abstracción sin caso de uso).

## D3 — Fecha de eliminación la fija la base de datos
- **Decision**: `now()` en SQL (`sql\`now()\``), sin value object ni reloj inyectado.
- **Rationale**: Evita deriva de reloj app/DB; `created_at` ya viene del dominio pero aquí no hay regla de dominio sobre `status`/`deleted_at`. Simple.
- **Alternatives**: `new Date()` en caso de uso con puerto de reloj (abstracción sin necesidad).

## D4 — Validación de `id`
- **Decision**: DTO `DeletePhraseParamsDto { @IsUUID() id }` vía `@Param()`; el `ValidationPipe` global + `validationExceptionFactory` produce 400 `VALIDATION_ERROR` por `ProblemDetailsFilter`.
- **Rationale**: Reutiliza la convención existente (listado). `@IsUUID()` sin versión: un UUID no v4 simplemente no existe ⇒ 404; el repositorio recibe `string`, por lo que no se construye `PhraseId` (evita 500 `INVALID_PHRASE`).
- **Alternatives**: `ParseUUIDPipe` (formato de error distinto al convenido); `@IsUUID('4')` (rechaza con 400 UUIDs válidos del contrato `format: uuid`).

## D5 — Error 404
- **Decision**: `PhraseNotFoundError` (application/errors) con mensaje `La frase no existe.`; `PhraseNotFoundFilter extends DomainExceptionFilter` (404, `PHRASE_NOT_FOUND`) aplicado con `@UseFilters` al método `DELETE`.
- **Rationale**: Patrón de `InvalidPhraseFilter`; respuesta coincide con el ejemplo de `openapi.yaml`.
- **Alternatives**: `NotFoundException` (el filtro global lo convertiría en `HTTP_ERROR`, sin código `PHRASE_NOT_FOUND`).

## D6 — Filtrado de activas en consultas existentes
- **Decision**: Añadir `status = 1` a: `findTextualMatch`, `findVectorMatch`, el chequeo `SELECT id FROM phrases LIMIT 1` (colección incompatible), y en `list` tanto el `count(*)` como el `select` (Drizzle `eq(DrizzlePhrasesModel.status, PhraseStatusEnum.ACTIVE)`).
- **Rationale**: FR-004/FR-005 y US2.4 (todas eliminadas ⇒ colección vacía ⇒ `null`, no `IncompatiblePhraseCollectionError`).
- **Alternatives**: Vista `active_phrases` (nuevo objeto de BD sin necesidad).

## D7 — Migración e índice
- **Decision**: Columnas `status smallint NOT NULL DEFAULT 1` (CHECK `status IN (1, 2)`; 1 = ACTIVE, 2 = DELETED, mapeados por `PhraseStatusEnum`) y `deleted_at timestamptz NULL` generadas con `pnpm db:generate` (`0002_*.sql`); el default ⇒ filas previas activas (FR-011). `status` es la fuente de verdad del filtrado; `deleted_at` registra cuándo (FR-002). Sin índice nuevo.
- **Rationale**: `data-model` de docs marca el índice como "opcional; medir antes". Top-1 es escaneo exacto.
- **Alternatives**: Índice parcial `WHERE status = 1` (diferido hasta medir).

## D8 — Validaciones previas
- **Decision**: Sin cambios en `phrase_validations` ni en `CreatePhraseUseCase`; `matched_phrase_id` sigue resolviendo porque la fila permanece (FR-008).
- **Alternatives**: Invalidar validaciones que citan la frase (viola FR-008).

## D9 — Pruebas
- **Decision**: Specs unitarios (caso de uso, controlador, filtro, repositorio) + E2E con `PhraseRepositoryPort` sustituido, como la suite actual. Verificación real de SQL se limita al spec del repositorio (mismo estilo del existente); quickstart añade verificación manual contra PostgreSQL.
