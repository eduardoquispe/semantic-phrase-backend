# Tareas: F001 — Listado de frases registradas

**Fuentes**: [spec.md](spec.md), [plan.md](plan.md), [data-model.md](data-model.md), [research.md](research.md), [contracts/list-phrases.md](contracts/list-phrases.md) y [quickstart.md](quickstart.md).

**Alcance**: `GET /api/v1/phrases`; los paths de código parten de `apps/backend`. Las pruebas unitarias y E2E son obligatorias por la constitución del backend. Cada historia tiene un criterio de comprobación propio; los escenarios de fallos controlados se completan en US3.

## Fase 1: Preparación

**Objetivo**: instalar solo las dependencias necesarias y dejar reproducible la configuración local.

- [X] T001 Agregar versiones compatibles de `drizzle-orm`, `drizzle-kit`, `pg`, tipos de `pg`, `class-validator`, `class-transformer` en `package.json` y `pnpm-lock.yaml` mediante pnpm.
- [X] T002 Registrar scripts explícitos de generación y ejecución de migraciones Drizzle (`db:generate`, `db:migrate`) en `package.json`; no ejecutar migraciones al iniciar la API.
- [X] T003 [P] Documentar `DATABASE_URL`, `PORT` y los valores HTTP configurables usados por F001 con ejemplos locales seguros en `.env.example` y `README.md`.
- [X] T004 [P] Configurar `drizzle.config.ts` para leer la URL de PostgreSQL, usar `src/modules/phrases/infrastructure/outbound/persistence/schema/phrases.schema.ts` y escribir migraciones en `drizzle/migrations/`.

## Fase 2: Fundamentos

**Objetivo**: preparar el esquema aprobado y una conexión de lectura compartida antes de implementar historias.

- [X] T005 [P] Definir en `src/modules/phrases/infrastructure/outbound/persistence/schema/phrases.schema.ts` la tabla `phrases` completa: UUID `id`, `text`, `normalized_text` con índice B-tree no único, `embedding vector(384)`, `model_id`, `model_version` y `created_at`, con los tipos y restricciones de `data-model.md`.
- [X] T006 Crear en `drizzle/migrations/` una migración versionada que habilite `vector` antes de crear `phrases` y su índice `normalized_text`; comprobar que corresponde a `src/modules/phrases/infrastructure/outbound/persistence/schema/phrases.schema.ts`.
- [X] T007 [P] Crear `src/shared/infrastructure/database/database.module.ts` y `src/shared/infrastructure/database/database.provider.ts` con un único `pg.Pool` inyectable, validación de `DATABASE_URL` al inicio y cierre del pool al terminar; no conectar ni migrar durante el bootstrap.
- [X] T008 Configurar el prefijo global `/api` en `src/main.ts` y excluir la ruta inicial `GET /` para conservar su comportamiento y el uso de `PORT`; cada controlador versionado definirá su segmento `v1`.

**Punto de control**: la migración se puede aplicar manualmente y el servidor tiene un proveedor de base de datos para las historias.

## Fase 3: Historia 1 — Consultar las frases registradas (P1) 🎯 MVP

**Objetivo**: devolver hasta 20 frases públicas, las más recientes primero, o una lista vacía con metadatos correctos.

**Prueba independiente**: con 0, 1, 20 y 21 filas conocidas, `GET /api/v1/phrases` sin query devuelve 200, solo `id`, `text`, `createdAt`, orden `created_at DESC, id DESC`, `page=1`, `limit=20`, `total` exacto y `totalPages` correcto.

### Pruebas de la historia 1

- [X] T009 [P] [US1] Escribir pruebas unitarias del caso de uso para conjunto vacío, proyección pública, orden recibido y metadatos de la primera página usando un doble del puerto en `src/modules/phrases/application/use-cases/list-phrases.use-case.spec.ts`; agregar una prueba unitaria básica en `src/modules/phrases/infrastructure/inbound/http/controllers/phrases.controller.spec.ts` que compruebe que el controlador delega la consulta sin parámetros al caso de uso y devuelve su resultado.
- [X] T010 [P] [US1] Escribir pruebas HTTP E2E para `GET /api/v1/phrases` sin parámetros, incluyendo 0, 1, 20 y 21 frases, empate de fecha, forma exacta de respuesta y ausencia de columnas privadas, con repositorio controlado en `test/phrases.e2e-spec.ts`; comprobar también que `GET /` conserva su respuesta.

### Implementación de la historia 1

- [X] T011 [P] [US1] Definir el resultado de lectura pública y la operación de listar con total en `src/modules/phrases/application/ports/outbound/phrase-repository.port.ts`; exponer el contrato de entrada sin tipos HTTP en `src/modules/phrases/application/ports/inbound/list-phrases.port.ts`.
- [X] T012 [US1] Implementar `src/modules/phrases/infrastructure/outbound/persistence/repositories/drizzle-phrase.repository.ts` con conteo y selección exclusiva de `id`, `text`, `created_at`, orden `created_at DESC, id DESC`, `LIMIT 20`, conversión de fecha a ISO con zona y vista coherente para conteo y filas cuando sea viable.
- [X] T013 [US1] Implementar `src/modules/phrases/application/use-cases/list-phrases.use-case.ts` para devolver `{data,meta}` de la primera página, calcular `totalPages` (cero si `total=0`) y depender solo del puerto de repositorio.
- [X] T014 [US1] Exponer `GET /api/v1/phrases` sin autenticación desde `src/modules/phrases/infrastructure/inbound/http/controllers/phrases.controller.ts`, definiendo `v1/phrases` en el controlador bajo el prefijo global `/api`, delegando en el puerto de entrada y devolviendo únicamente la respuesta contratada.
- [X] T015 [US1] Enlazar puertos, caso de uso, repositorio y proveedor de base de datos en `src/modules/phrases/phrases.module.ts`, e importar el módulo en `src/app.module.ts`.

**Punto de control**: US1 se puede probar sin parámetros, con base vacía o con datos ya registrados.

## Fase 4: Historia 2 — Recorrer un listado extenso (P2)

**Objetivo**: aceptar `page` y `limit` válidos, recorrer páginas de hasta 100 filas y conservar los totales.

**Prueba independiente**: con 45 frases, las páginas predeterminadas 1, 2 y 3 contienen 20, 20 y 5; una página posterior devuelve `data=[]`; `?page=2&limit=10` devuelve el segmento y metadatos solicitados.

### Pruebas de la historia 2

- [X] T016 [P] [US2] Ampliar `src/modules/phrases/application/use-cases/list-phrases.use-case.spec.ts` con límites 1 y 100, 45 registros, página posterior y `totalPages=ceil(total/limit)`; ampliar `src/modules/phrases/infrastructure/inbound/http/controllers/phrases.controller.spec.ts` para comprobar que el controlador pasa `page` y `limit` al caso de uso.
- [X] T017 [P] [US2] Ampliar `test/phrases.e2e-spec.ts` con páginas 1–3 de 45 filas, `page=4` y un tamaño válido personalizado, comprobando orden, tamaño y los cuatro metadatos.

### Implementación de la historia 2

- [X] T018 [US2] Definir entrada `page`/`limit` numérica en `src/modules/phrases/application/ports/inbound/list-phrases.port.ts` y pasarla por `src/modules/phrases/application/use-cases/list-phrases.use-case.ts` para calcular el resultado paginado.
- [X] T019 [US2] Actualizar `src/modules/phrases/infrastructure/outbound/persistence/repositories/drizzle-phrase.repository.ts` para recibir `page`/`limit`, calcular `OFFSET` sin pérdida de precisión, aplicar `LIMIT` y conservar el total global incluso cuando la página esté vacía.
- [X] T020 [US2] Crear `src/modules/phrases/infrastructure/inbound/http/dtos/list-phrases.query.dto.ts` con conversión decimal estricta, valores predeterminados solo para claves omitidas y rangos `page>=1`, `1<=limit<=100`; integrar la query en `src/modules/phrases/infrastructure/inbound/http/controllers/phrases.controller.ts` e instalar `ValidationPipe` global con `whitelist` y `forbidNonWhitelisted` en `src/main.ts` para aplicar esas restricciones desde US2.

**Punto de control**: US2 permite recorrer el conjunto sin añadir búsqueda, filtros ni orden configurable.

## Fase 5: Historia 3 — Reconocer solicitudes no válidas y fallos (P3)

**Objetivo**: devolver errores Problem Details seguros y distinguibles para validación, límite de solicitudes, indisponibilidad de base de datos y fallos inesperados.

**Prueba independiente**: `page=0`, `limit=101`, decimales, claves desconocidas o repetidas devuelven 400; un fallo de BD devuelve 500/`DATABASE_ERROR` y un fallo inesperado devuelve 500, todos con `application/problem+json`.

### Pruebas de la historia 3

- [X] T021 [P] [US3] Probar sintaxis decimal, rangos, valores vacíos, signos, exponentes, duplicados, claves desconocidas y enteros inseguros en `src/modules/phrases/infrastructure/inbound/http/dtos/list-phrases.query.dto.spec.ts`.
- [X] T022 [P] [US3] Ampliar `test/phrases.e2e-spec.ts` para 400 y 500; verificar `Content-Type: application/problem+json`, `title`, `status`, `detail`, `code`, `errors` de validación y ausencia de detalles internos.

### Implementación de la historia 3

- [X] T023 [US3] Rechazar en `src/modules/phrases/infrastructure/inbound/http/dtos/list-phrases.query.dto.ts` toda sintaxis o rango inválido y evitar conversiones permisivas; detectar claves desconocidas y repetidas en `src/modules/phrases/infrastructure/inbound/http/controllers/phrases.controller.ts` usando la query original.
- [X] T024 [US3] Integrar los errores del `ValidationPipe` global con `src/shared/infrastructure/http/filters/problem-details.filter.ts` para que las respuestas 400 incluyan `VALIDATION_ERROR` y los campos inválidos sin exponer detalles internos; mantener la conversión estricta de `page` y `limit`.
- [X] T025 [P] [US3] Crear `src/shared/infrastructure/http/filters/problem-details.filter.ts` para traducir 400/`VALIDATION_ERROR`, 500/`INTERNAL_ERROR` y 500/`DATABASE_ERROR` al contrato `application/problem+json` sin SQL, trazas ni secretos.
- [X] T026 [US3] Distinguir indisponibilidad de PostgreSQL de otros errores en `src/modules/phrases/infrastructure/outbound/persistence/repositories/drizzle-phrase.repository.ts` y expresar el fallo sin códigos HTTP mediante `src/shared/infrastructure/database/errors/database-unavailable.error.ts`.
- [X] T027 [US3] Registrar el filtro Problem Details para toda la API en `src/main.ts`. El límite global de solicitudes se retiró por decisión del usuario.

**Punto de control**: US3 diferencia una base vacía de un fallo y no revela datos internos.

## Fase 6: Pulido y comprobación transversal

- [X] T028 [P] Actualizar `specs/001-list-phrases/quickstart.md` con los nombres efectivos de scripts y variables, la carga separada de datos de prueba y los comandos manuales de aceptación.
- [X] T029 Ejecutar `pnpm run build`, `pnpm test` y `pnpm run test:e2e`; corregir únicamente los fallos de F001 en los archivos afectados de `src/modules/phrases/`, `src/shared/` y `test/phrases.e2e-spec.ts`.
- [X] T030 Aplicar `pnpm run db:migrate` sobre PostgreSQL local y verificar el esquema de `drizzle/migrations/` y la consulta real de `src/modules/phrases/infrastructure/outbound/persistence/repositories/drizzle-phrase.repository.ts` con 0 y 45 filas de prueba, orden, proyección y paginación; no cargar datos al iniciar la API.

## Fase 7: Modelo de dominio completo

**Alcance**: solo dominio y sus pruebas; mantener la proyección `PhraseListItem`, aplicación, infraestructura y contrato HTTP existentes.

- [X] T031 Incorporar `DomainError`, `InvalidPhraseError`, `InvalidPhraseTextError` e `InvalidEmbeddingError` locales en `src/modules/phrases/domain/errors/`, sin HTTP ni datos sensibles.
- [X] T032 Implementar `PhraseText` y `Embedding` inmutables en `src/modules/phrases/domain/value-objects/` y sus pruebas: texto original de 1–500 puntos de código, no vacío tras trim, rechazo de todos los controles `Cc` incluidos tabulación/LF/CR, normalización única y 384 componentes finitos sin renormalización.
- [X] T033 Implementar `Phrase` y `PhraseProps` en `src/modules/phrases/domain/entities/phrase.entity.ts` y pruebas para UUID v4, value objects, metadatos obligatorios, fecha válida, texto normalizado recibido explícitamente e inmutabilidad con copias defensivas.
- [X] T034 Alinear `spec.md`, `plan.md` y `data-model.md` con el agregado completo, distinguiéndolo de la proyección de lectura y documentando el rechazo de controles.
- [X] T035 Ejecutar `pnpm test --runInBand` y `pnpm run build`; comprobar formato y lint de los archivos nuevos de dominio.

**Dependencias**: T031 precede a T032; T032 precede a T033; T034 refleja el modelo final; T035 verifica todos los cambios de esta fase.

## Dependencias y orden de ejecución

### Refinamiento del dominio

- [X] T036 Separar creación y reconstitución desde primitivos mediante `domain/factory/phrase.factory.ts` y añadir pruebas de normalización, invariantes e inmutabilidad.
- [X] T037 Extraer UUID v4 a `domain/value-objects/phrase-id.value-object.ts`, integrar en entidad y fábrica y añadir pruebas; simplificar la entidad confiando en value objects tipados y conservar solo validación directa de metadatos y fecha.
- [X] T038 Alinear `spec.md`, `plan.md` y `data-model.md` con los refinamientos de dominio.
- [X] T039 Verificar compilación, lint de archivos modificados y suite unitaria completa tras el refinamiento.

```text
Preparación (T001–T004) → Fundamentos (T005–T008) → US1 (T009–T015)
                                                   → US2 (T016–T020) → US3 (T021–T027)
                                                                     → Pulido (T028–T030)
```

- T002 depende de T001; T006 depende de T005; T008 y T007 pueden avanzar tras la preparación.
- US1 depende de los fundamentos. Dentro de US1, T011 precede a T012–T015; T012 y T013 preceden a T014–T015. Las pruebas T009–T010 se escriben primero y deben fallar antes de implementar.
- US2 extiende la misma ruta y los mismos archivos de US1, por lo que depende de US1. T018 y T019 preceden a T020. Sus pruebas T016–T017 se escriben primero.
- US3 extiende la validación y la composición HTTP de US2, por lo que depende de US2. T023 y T025 preceden a T024; T023–T026 preceden al cableado T027. Sus pruebas T021–T022 se escriben primero.
- El pulido depende de las historias incluidas en la entrega. T030 requiere PostgreSQL local, migración y datos de prueba cargados por separado.

## Ejemplos de trabajo paralelo

| Historia | Tareas que pueden avanzar a la vez | Razón |
| --- | --- | --- |
| US1 | T009 y T010; luego el contrato de entrada y el puerto de salida dentro de T011 | Pruebas y contratos en archivos distintos. |
| US2 | T016 y T017 | Pruebas unitarias y HTTP en archivos distintos. |
| US3 | T021 y T022; luego T025 junto con T023 | Pruebas separadas y filtro separado de la validación de query. |

Los marcadores `[P]` indican archivos distintos y ausencia de dependencia pendiente en ese momento; las ampliaciones de un mismo archivo entre historias se hacen en orden.

## Estrategia de implementación

1. Completar preparación y fundamentos; aplicar la migración manualmente.
2. Entregar US1 como MVP y comprobar su respuesta sin parámetros con datos conocidos y base vacía.
3. Agregar US2 y verificar cada página de un conjunto de 45 frases.
4. Agregar US3 y verificar 400 y 500 conforme al contrato.
5. Ejecutar compilación, pruebas automatizadas y comprobación real con PostgreSQL.


## Phase 8: Convergence

Evaluación centrada en estructura, distribución de responsabilidades y lógica existente. Completar las correcciones sin ampliar las operaciones de F001; documentar los códigos de error de dominio aprobados por el usuario. F1–F9 corresponden a los hallazgos de esta revisión; T039 se verifica junto con los cambios aprobados de esta fase.

**Ajuste solicitado por el usuario tras la revisión**: agregar pruebas nuevas únicamente para casos de uso; no crear pruebas de DTO ni nuevas suites de dominio, fábrica o adaptadores. Corregir las pruebas existentes que fallen, conservando sus comprobaciones útiles. Encapsular las nuevas validaciones de dominio en value objects simples y entendibles, sin bucles ni abstracciones innecesarias; mantener la validación de sintaxis HTTP en el límite de transporte. Este ajuste prevalece sobre las indicaciones anteriores de pruebas nuevas y validación directa en la entidad para esta fase.

- [X] T040 CRITICAL — F1: Restablecer la verificación de comportamiento: añadir pruebas unitarias únicamente junto a `application/use-cases/list-phrases.use-case.ts`, usando un doble del puerto de repositorio para comprobar paginación, metadatos, proyección y propagación de errores; no crear pruebas del DTO; alinear las pruebas de entidad con su API de construcción sin eliminar las comprobaciones de invariantes; corregir la expectativa de identidad del resultado en `phrases.controller.spec.ts`, los imports no resolubles en Jest/Node y los errores de tipado de `database.provider.spec.ts` y `test/phrases.e2e-spec.ts`. Corregir y conservar las pruebas HTTP existentes; limitar las pruebas nuevas de esta fase a los casos de uso; ejecutar build, suite unitaria, E2E y lint sin corrección automática para demostrar su estado final, en coordinación con T039, per Constitución III, T009, T016, T021, T029 y T039 (partial).
- T041 — F2: No ejecutar por decisión del usuario: conservar el flujo actual con sus mappers y el agregado `Phrase`; no introducir la proyección de lectura propuesta en esta revisión.
- [X] T042 — F3: Implementar las reglas aprobadas con `NormalizedPhraseText`, `PhraseModel` (id y versión) y `PhraseCreatedAt`: strings no vacíos tras trim sin modificar el valor original y Date con timestamp finito y copias defensivas. Componer estos value objects desde el constructor de `Phrase`, sin bucles, jerarquías, validadores genéricos ni restricciones adicionales; conservar la API pública y corregir las pruebas existentes, per spec: decisiones de revisión y aprobación del usuario (partial).
- T043 — F4: No ejecutar por decisión del usuario: conservar la construcción actual; no incorporar `PhraseFactory` en esta fase.
- T044 — F5: No ejecutar por decisión del usuario: conservar por ahora la validación y paginación actuales; no aplicar el endurecimiento propuesto en esta revisión.
- T045 — F6: Actualizado por la unificación de BD: capturar fallos de consultas y escrituras como `DatabaseError`, sin clasificar códigos y conservando la causa.
- [X] T046 — F7: Actualizar únicamente `drizzle.config.ts` para apuntar al esquema existente `src/modules/phrases/infrastructure/persistence/drizzle/drizzle-phrases.model.ts`; conservar la organización actual de adaptadores y las migraciones, según decisión del usuario (contradicts).
- [X] T047 — F8: Conservar únicamente `InvalidPhraseError`, `InvalidPhraseTextError` e `InvalidEmbeddingError` como errores concretos de dominio, con la base `DomainError`. Mantener los filtros de frase y embedding e incorporar `InvalidPhraseTextFilter` en infraestructura, registrando los tres en el controlador con HTTP 500 y códigos específicos. Documentar los códigos y verificar los tres mediante la prueba HTTP existente parametrizada, según aprobación del usuario y spec: decisiones de revisión (unrequested).
- T048 — F9: Pospuesto por decisión del usuario: conservar por ahora la firma actual de `Embedding`; no ampliar a `readonly number[]` en esta fase.

**Verificación de la implementación — 2026-10-22**: `pnpm run build` y `pnpm exec tsc --noEmit --incremental false` aprobados; 132 pruebas unitarias y 26 pruebas HTTP E2E aprobadas. `pnpm exec eslint src test` sin errores; conserva un warning previo de promesa no esperada en `src/main.ts`. Las únicas pruebas nuevas son las de `ListPhrasesUseCase`; las demás suites se corrigieron o adaptaron a las decisiones actuales. No se ejecutaron migraciones ni se modificó la base de datos.
