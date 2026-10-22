---

Cambio incompatible (2026-10-22): `validationId` sustituye a `validationToken`, sin alias.
Se devuelve el UUID v4 aleatorio de la validación persistida, sin firma ni JWT.
Los JWT anteriores dejan de formar parte del contrato; las filas existentes pueden
referenciarse por su UUID. No hay migración ni secreto de firma requerido.
El registro queda fuera de F002: deberá buscar por `validationId`, comprobar
vigencia (`now >= expiresAt` implica expiración), texto, confirmación y estado no
consumido, y consumir la validación atómicamente con el guardado de la frase.
TTL configurable inicialmente de 15 minutos; respuesta y fila comparten expiración.

description: 'Tareas de transición de F002 desde inferencia local hacia TEI existente'
---

# Tasks: F002 — Validación de Similitud Semántica

**Input**: documentos actuales de `specs/002-semantic-similarity-validation/`: `spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/` y `quickstart.md`.
**Actualización**: 2026-10-22. Sustituye la lista anterior de 41 tareas de la variante local. Los IDs se regeneran para esta revisión; no equivalen a los IDs anteriores.
**Baseline**: existen dominio, puertos, validación HTTP, búsqueda pgvector, persistencia temporal, firma y pruebas de la variante anterior, con cambios en curso. Reutilizarlos y corregir únicamente discrepancias verificadas. La evidencia anterior permanece en la sección histórica de `quickstart.md`; sus checks completados no acreditan TEI. Todas las tareas de esta transición comienzan pendientes.
**Ajuste aprobado durante implementación**: TEI 1.9.4 y OpenAIEmbeddings directo con el adaptador mínimo proporcionado por el usuario. Sin TeiEmbeddings/fetch propio, consulta automática /info, ready, deadline adicional ni aborto propio al cerrar. Validación del resultado únicamente mediante los VOs existentes; identidad contrastada manualmente. Las tareas siguientes se alinean a esa decisión.

**Tests**: requeridos por spec, plan y constitución. Adaptar pruebas existentes antes de modificar comportamiento; escribir primero las nuevas pruebas y comprobar que detectan el comportamiento pendiente. Una verificación que ya pasa no exige introducir cambios artificiales.
**Scope**: actualizar esta feature; conservar contratos y puertos, sin registro/consumo, frontend, backfill, nueva migración por TEI ni despliegue nuevo. Generar esta lista no ejecuta sus tareas.

## Format: `[ID] [P?] [Story] Description`

- `[P]`: tareas sobre archivos distintos que pueden ejecutarse simultáneamente una vez satisfechas sus dependencias explícitas.
- `[US1]`–`[US4]`: historias de `spec.md`; las cuatro son P1 y todas son necesarias para completar F002.
- Rutas relativas a `apps/backend/`. Mantener la reorganización actual de persistencia en `drizzle/phrase/` y `drizzle/phrase-validation/`.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: establecer el baseline y las condiciones operativas de la transición sin alterar cambios ajenos.

- [x] T001 Revisar el baseline de `src/modules/phrases/phrases.module.ts`, `package.json`, `drizzle.config.ts` y las suites existentes; registrar en `specs/002-semantic-similarity-validation/quickstart.md` comandos/resultados actuales y fallos previos, preservando los cambios en curso y la evidencia histórica local.
- [x] T002 Inspeccionar en lectura `../../compose.yaml`, servicio existente `/info` y configuración efectiva del contenedor; registrar perfil, imagen efectiva, ausencia de prompt predeterminado y descriptor/digest esperado en `specs/002-semantic-similarity-validation/quickstart.md` conforme a `specs/002-semantic-similarity-validation/contracts/embeddings-service.md`; fijar la forma/casing real de fixtures para T006, sin recrear Docker ni asumir que la revisión declarada certifica los pesos. Una discrepancia bloquea activación y debe resolverse antes de aceptar otro perfil.

**Checkpoint**: baseline identificado y perfil remoto contrastado; ninguna evidencia local se presenta como validación de TEI.

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: disponer de una única integración LangChain → TEI, configuración validada y composición lista antes de verificar las historias.

- [x] T003 [P] Actualizar `src/modules/phrases/infrastructure/config/phrase-validation.config.spec.ts`: URL obligatoria HTTP(S) sin credenciales/query/fragmento, pathname base, timeout entero positivo obligatorio sin default, modelo/revisión/dimensión fijos, versión tei-SHA256 y rechazo de identidad local; conservar pruebas de umbral [-1,1], TTL y secreto base64 >=32 bytes.
- [x] T004 Implementar configuración tipada en `src/modules/phrases/infrastructure/config/phrase-validation.config.ts`: AI_EMBEDDINGS_URL, modelo sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2, revisión e8f8c211226b894fcb81acc59f3b34ba3efd5f42, 384 dimensiones, timeout requerido y versión esperada; retirar opciones de caché y acceso a manifiesto local, manteniendo umbral 0.8538613695045911, TTL 15 y validación del secreto.
- [x] T005 [P] Probar en `src/modules/phrases/infrastructure/embeddings/hugging-face-embedding.adapter.spec.ts` el constructor OpenAIEmbeddings con modelo, apiKey ficticia, maxRetries 0, timeout SDK y URL con pathname; comprobar destino alternativo al cambiar URL. No crear TeiEmbeddings ni API de lotes propia.
- [x] T006 [P] Adaptar `src/modules/phrases/infrastructure/embeddings/hugging-face-embedding.adapter.spec.ts`: inferencia inicial obligatoria, fallo seguro de inicio, GeneratedEmbedding con modelo/versión configurados y validación de dimensión/finitud por Embedding. No probar controles retirados por el usuario.
- [x] T007 Configurar OpenAIEmbeddings directamente en `src/modules/phrases/infrastructure/embeddings/hugging-face-embedding.adapter.ts` contra /v1/embeddings con maxRetries 0 y timeout SDK. Sin fetch, clase de cliente, timers, ready ni shutdown propios; eliminar el cliente TEI provisional.
- [x] T008 Adaptar `src/modules/phrases/infrastructure/embeddings/hugging-face-embedding.adapter.ts`: generate con embedQuery, Embedding y PhraseModel; errores a AiUnavailableError. onModuleInit llama generate como comprobación. Mantener el descriptor/versionado como configuración operativa manual en contracts/embeddings-service.md, sin validación automática de /info/digest.
- [x] T009 Componer un único adaptador en `src/modules/phrases/phrases.module.ts` sin provider de cliente adicional; conservar puertos/repositorios. Verificar con montaje Nest que la inferencia inicial precede a init exitoso y que un error de inicio se propaga.
- [x] T010 Retirar `src/modules/phrases/infrastructure/embeddings/local-minilm.embeddings.ts`, su `.spec.ts`, `src/modules/phrases/infrastructure/embeddings/minilm-manifest.json` y `scripts/prepare-minilm.mjs`; eliminar model:prepare y @huggingface/transformers de `package.json` con pnpm y actualizar `pnpm-lock.yaml`, retirando solo dependencias transitivas exclusivas y referencias locales en configuración/composición; conservar @langchain/core 0.3.79, pruebas funcionales, evidencia y cachés ajenas.
- [x] T011 [P] Actualizar `.env.example` y `README.md` con URL host/red Docker, perfil y cálculo del digest TEI, timeout obligatorio (5000 solo ejemplo), secreto seguro no ejecutable, comprobación previa a escuchar y reinicio coordinado ante cambio de perfil; retirar instrucciones activas de preparación/caché local, explicar incompatibilidad de vectores previos y conservar límites de validación temporal sin registro/consumo.
- [x] T012 [P] Corregir descubrimiento de modelos en `drizzle.config.ts` para `src/modules/phrases/infrastructure/persistence/drizzle/phrase/drizzle-phrases.model.ts` y `src/modules/phrases/infrastructure/persistence/drizzle/phrase-validation/drizzle-phrase-validations.model.ts`; verificar ambos en configuración y revisar `drizzle/migrations/0001_fantastic_impossible_man.sql` e historial pgvector existente, sin generar DDL nuevo por TEI, duplicar tablas ni aplicar migraciones en bootstrap.

**Checkpoint**: pasan pruebas de configuración/cliente/adapter y montaje; la inferencia de comprobación termina antes de escuchar; código y dependencias exclusivas del pipeline local retirados.

## Phase 3: User Story 1 — Conocer una posible coincidencia antes de guardar (Priority: P1) — MVP

**Goal**: conservar prioridad textual, Top-1 compatible y confirmación inclusiva usando embeddings remotos.
**Independent Test**: fixtures propios textual/vectorial, candidatos bajo/en/sobre umbral y empates; 201 con una candidata y comprobante conservado, cero nuevas frases.

### Tests for User Story 1

- [x] T013 [P] [US1] Adaptar `src/modules/phrases/infrastructure/persistence/drizzle/phrase/drizzle-phrase.repository.spec.ts` a identidades TEI y corpus mixto: SQL parametrizado secuencial, textual primero sin distancia aunque el corpus sea incompatible, empate textual created_at DESC/id DESC, vector distancia ASC/id ASC, filtro exacto modelo/versión, score 1-distancia sin redondeo y negativos válidos; conservar regresión list.
- [x] T014 [P] [US1] Adaptar `src/modules/phrases/application/use-cases/validate-phrase.use-case.spec.ts`: texto original al puerto IA incluso para textual incompatible, modelo efectivo remoto al repositorio y agregado, candidata única bajo/en/sobre umbral inclusivo, save antes de issue y ninguna creación de Phrase.
- [x] T015 [P] [US1] Adaptar escenarios textual/vector de `test/phrase-validations.e2e-spec.ts` usando configureApp y dobles de puertos que eviten inicialización remota real; verificar POST sin autenticación, 201 con data exacto, textual score null, candidata bajo umbral incluida, ausencia de embedding/modelo internos y cero escrituras definitivas.

### Implementation for User Story 1

- [x] T016 [US1] Verificar y corregir solo discrepancias de T013 en `src/modules/phrases/infrastructure/persistence/drizzle/phrase/drizzle-phrase.repository.ts`: conservar contrato findValidationMatch, prioridad textual, Top-1 coseno, filtro de identidad TEI y consultas secuenciales actuales; no reetiquetar vectores Xenova, introducir CTE/transacción larga ni atribuir snapshot común.
- [x] T017 [US1] Verificar y corregir solo discrepancias de T014 en `src/modules/phrases/application/use-cases/validate-phrase.use-case.ts`: usar únicamente EmbeddingGeneratorPort, mantener texto original y modelo verificado, resolución de match y persistencia previa a la respuesta, sin cliente HTTP/configuración ENV en aplicación ni cambios de puertos.
- [x] T018 [US1] Verificar y corregir contrato de éxito con T015 en `src/modules/phrases/infrastructure/http/controllers/phrase-validations.controller.ts` y `src/modules/phrases/infrastructure/http/mapper/phrases.mapper.ts`; conservar data con validationId/expiresAt/requiresConfirmation/match y ejecutar pruebas existentes de controller/mapper, sin introducir campos ni rutas nuevas.

**Checkpoint**: US1 verificable con dobles controlados sobre infraestructura remota integrada; el corpus definitivo no cambia.

## Phase 4: User Story 2 — Obtener un resultado sin frases previas (Priority: P1)

**Goal**: validar la primera frase mediante TEI y mantener colección vacía distinta de incompatible.
**Independent Test**: repositorio vacío, inferencia válida y una fila temporal; match=null, requiresConfirmation=false, ninguna frase ni registro de cancelación.

### Tests for User Story 2

- [x] T019 [P] [US2] Verificar/adaptar casos empty en `src/modules/phrases/application/use-cases/validate-phrase.use-case.spec.ts`: inferencia remota obligatoria, embedding/modelo TEI conservados, match null sin puntaje ficticio, confirmación false y ningún efecto de abandono; distinguir colección incompatible.
- [x] T020 [P] [US2] Verificar/adaptar caso de colección vacía en `test/phrase-validations.e2e-spec.ts`: 201 con shape exacto y UUID v4 persistido, una validación temporal y cero frases; abandonar no llama a registro ni añade cancelación.

### Implementation for User Story 2

- [x] T021 [US2] Verificar y corregir solo discrepancias de T019–T020 en `src/modules/phrases/infrastructure/persistence/drizzle/phrase/drizzle-phrase.repository.ts` y `src/modules/phrases/application/use-cases/validate-phrase.use-case.ts`; consultar existencia global únicamente sin candidata, devolver null solo para colección realmente vacía y conservar los escenarios de US1.

**Checkpoint**: US2 pasa con fixtures vacíos propios sin ejecutar escenarios de coincidencia.

## Phase 5: User Story 3 — Reconocer entradas inválidas y fallos de validación (Priority: P1)

**Goal**: errores seguros diferenciados y corte de efectos ante fallos del servicio remoto.
**Independent Test**: entradas inválidas y fallos inducidos de red/HTTP/formato/timeout SDK/búsqueda/INSERT; 400/500/503, ningún comprobante entregado ni persistencia después de errores propagados.

### Tests for User Story 3

- [x] T022 [P] [US3] Verificar `src/modules/phrases/application/use-cases/validate-phrase.use-case.spec.ts`: fallo de IA, incompatible sin texto igual, búsqueda/INSERT fallidos; ausencia de efectos posteriores y nuevo intento manual independiente. Timeout se delega al SDK según decisión del usuario.
- [x] T023 [P] [US3] Ampliar `test/phrase-validations.e2e-spec.ts` con adaptador y OpenAIEmbeddings reales sobre transporte simulado: payload compatible/base64, red/429/500/JSON/shape/vector y timeout SDK dan 503 AI_UNAVAILABLE sin búsqueda/INSERT ni retry. Conservar matriz pública 400/500/503 y ausencia de throttle. No exigir validación de identidad/cardinalidad o deadline de cuerpo retirados por el usuario.

### Implementation for User Story 3

- [x] T024 [US3] Resolver discrepancias del adaptador mínimo detectadas por T022–T023, manteniendo únicamente embedQuery/VOs/traducción segura y timeout del SDK. No añadir fetch, abort, deadline ni fallback propios.
- [x] T025 [US3] Verificar filtros de AI_UNAVAILABLE y VALIDATION_ERROR, y usar el filtro global existente para 500 INTERNAL_ERROR incompatible; retirar el filtro específico redundante. Mantener Problem Details seguro sin mensajes SDK/SQL/stack.
- [x] T026 [US3] Verificar con `src/modules/phrases/infrastructure/persistence/drizzle/phrase/drizzle-phrase.repository.spec.ts` y `src/modules/phrases/infrastructure/persistence/drizzle/phrase-validation/drizzle-phrase-validation.repository.spec.ts` que consulta/INSERT convierten fallos de conexión, SQL y restricciones a `DatabaseError` con causa; cubrir también listado F001 y mantener mapeos/errores de dominio y aplicación fuera de las capturas.

**Checkpoint**: fallos del servicio nuevo no autorizan guardado ni producen falso resultado sin coincidencia; toda la matriz pública sigue vigente.

## Phase 6: User Story 4 — Disponer de una validación temporal para continuar (Priority: P1)

**Goal**: conservar vínculo verificable entre resultado TEI, fila temporal, UUID y expiración.
**Independent Test**: textual/vector/empty con reloj controlado; UUID y expiresAt idénticos a fila/respuesta, modelo TEI persistido, consumedAt null y dos validaciones independientes.

### Tests for User Story 4

- [x] T027 [P] [US4] Adaptar `src/modules/phrases/application/use-cases/validate-phrase.use-case.spec.ts` y `src/modules/phrases/infrastructure/persistence/drizzle/phrase-validation/drizzle-phrase-validation.mapper.spec.ts`: preservar texto original/normalizado, vector 384 y modelo/version TEI, score nulo/negativo, copias defensivas y fechas a segundos; TTL default 15/configurable, UUID distintos, consumo nulo y ninguna prórroga de la validación anterior.
- [x] T028 [P] [US4] Verificar en `test/phrase-validations.e2e-spec.ts` para textual/vector/empty: UUID v4 igual al persistido, expiresAt igual a la fila, TTL 15 minutos, expiración en igualdad y validaciones independientes sin consumo ni registro. Ejecutar sin secreto de firma.

### Implementation for User Story 4

- [x] T029 [US4] Verificar/corregir solo discrepancias de T027–T028 en `src/modules/phrases/domain/entities/phrase-validation.entity.ts`, `src/modules/phrases/application/use-cases/validate-phrase.use-case.ts`, `src/modules/phrases/infrastructure/persistence/drizzle/phrase-validation/drizzle-phrase-validation.mapper.ts`; mantener una base temporal a segundos, INSERT completado antes de responder y modelo efectivo persistido, sin nuevas APIs ni cambios de esquema.
- [x] T030 [US4] Contrastar `README.md` y `specs/002-semantic-similarity-validation/quickstart.md` con los escenarios comprobados: now>=expiresAt, abandono/expiración conservan fila hasta limpieza manual, revalidar no consume/renueva; filas previas conservan identidad/vigencia y registro/consumo permanecen fuera de F002.

**Checkpoint**: se conserva el contrato temporal completo con embeddings TEI, sin extender el alcance al guardado.

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: demostrar eliminación local, regresión, integración real y rendimiento de esta revisión.

- [x] T031 Auditar `package.json`, `pnpm-lock.yaml`, `.env.example` y `src/modules/phrases/` con rg y grafo de dependencias: ausencia de Transformers/exclusivas locales, LocalMiniLmEmbeddings, manifiesto, model:prepare, imports/providers/cache/fallback activos; ejecutar `pnpm run build`, `pnpm test --runInBand`, `pnpm run test:e2e --runInBand` y formato/lint de archivos cambiados, revisar sus ediciones y registrar resultados sanitizados en `specs/002-semantic-similarity-validation/quickstart.md`, incluida regresión F001 de lectura 281–500 puntos de código.
- [x] T032 Validar integración real OpenAIEmbeddings → TEI: inspección manual /info/imagen/prompts/perfil, comparación con /v1/embeddings directo, 384 componentes finitos, norma L2 dentro de 1e-5 y diferencia máxima <=1e-6. Comprobar ausencia de runtime local e inicio fallido ante URL no disponible, sin modificar datos ajenos. El ajuste del despliegue para auto-truncate=false requiere aprobación; no acreditar controles eliminados del adaptador.
- [x] T033 Inventariar mediante SQL de lectura identidades del corpus y registrar compatibilidad en `specs/002-semantic-similarity-validation/quickstart.md`; en base/corpus de demostración aislado, revisar/aplicar solo migraciones existentes si faltan y comprobar Top-1/desempates/filtro exacto, textual incluso incompatible, empty frente a incompatible, vector(384), INSERT temporal/fechas/UUID y conteo de phrases intacto. Preparar fixtures TEI deliberadamente sin endpoint de registro, reetiquetado, backfill ni modificación de datos ajenos; documentar necesidades de regeneración real por separado antes de activar comparaciones afectadas.
- [x] T034 Medir exactamente 3 solicitudes HTTP secuenciales después de disponibilidad comprobada, según `specs/002-semantic-similarity-validation/quickstart.md`; registrar hardware/SO/Node/librerías, imagen TEI/revisión/build/digest, ubicación de procesos, corpus, timeout, latencias/máximo/percentiles con método y arranque aparte. Resolver respuestas normales >5 segundos antes de acreditar SC-005, sin reutilizar tiempos locales históricos ni afirmar mejora de calidad semántica.
- [x] T035 Actualizar trazabilidad FR-001–FR-020 y SC-001–SC-009 contra pruebas/evidencia TEI en `specs/002-semantic-similarity-validation/quickstart.md`; contrastar `specs/002-semantic-similarity-validation/contracts/phrase-validations.openapi.yaml`, `specs/002-semantic-similarity-validation/contracts/embeddings-service.md` y ejemplos de `README.md`, retirar avisos de transición pendiente solo donde exista evidencia y conservar evidencia histórica separada. Verificar que no se modificó el contrato compartido `../../docs/03-architecture/openapi.yaml` por esta sustitución interna.

## Dependencies & Execution Order

```text
Setup T001–T002
  └─ Foundational T003–T012
       └─ US1 T013–T018 (primer incremento demostrable)
            └─ US2 T019–T021
                 └─ US3 T022–T026
                      └─ US4 T027–T030
                           └─ Cierre T031 → T032 → T033 → T034 → T035
```

- T003 y T005/T006 pueden avanzar tras Setup; T005/T006 comparten archivo y se ejecutan secuencialmente; T003 → T004; T004 + T005 → T007; T004 + T006 + T007 → T008 → T009 → T010. T011 y T012 pueden avanzar en paralelo tras T010; toda Phase 2 bloquea historias.
- T013/T014/T015 se escriben en paralelo; T013 → T016; T014 + T016 → T017; T015 + T017 → T018. Mantener los tests de repositorio/use-case/HTTP verdes al completar el incremento.
- T019/T020 → T021. T022/T023 → T024 → T025 → T026. T027/T028 → T029 → T030.
- Las historias se verifican con fixtures propios, pero reutilizan endpoint y fundamentos. Implementarlas secuencialmente porque comparten use-case y E2E; no son cuatro endpoints independientes. Todas son P1, por lo que el orden respeta el de spec.
- T031 requiere las cuatro historias. T032 verifica transporte real; T033 verifica SQL/persistencia; T034 mide solo tres solicitudes adicionales para rendimiento. Los sondeos de inicio y comprobaciones funcionales no forman parte de esa muestra.
- No marcar tareas reales completas basándose en dobles ni evidencia local. Si servicio, perfil, base o medición no permiten acreditar el criterio, registrar la limitación y mantener la tarea pendiente.

## Parallel Opportunities and Examples per Story

Estos ejemplos describen oportunidades de ejecución futura; no solicitan ejecutar agentes durante generación.

| Grupo       | Tareas simultáneas                                                | Precondición y límite                                     |
| ----------- | ----------------------------------------------------------------- | --------------------------------------------------------- |
| Fundamentos | T003 config, T005/T006 adapter (secuenciales en el mismo archivo) | Setup completo; tres archivos de pruebas distintos        |
| Fundamentos | T011 documentación, T012 Drizzle                                  | T010 completo; no tocar package/lock simultáneamente      |
| US1         | T013 repositorio, T014 caso de uso, T015 HTTP                     | Phase 2 completa; terminar antes de integrar correcciones |
| US2         | T019 caso de uso, T020 HTTP                                       | US1 completa; ambos preceden T021                         |
| US3         | T022 caso de uso, T023 HTTP remoto simulado                       | US2 completa; ambos preceden T024                         |
| US4         | T027 caso de uso/mapper, T028 HTTP/UUID                            | US3 completa; ambos preceden T029                         |

No paralelizar historias que editen `src/modules/phrases/application/use-cases/validate-phrase.use-case.spec.ts` o `test/phrase-validations.e2e-spec.ts`; tampoco correcciones del mismo adaptador con su retirada o recomposición.

## Implementation Strategy

### MVP First (User Story 1)

1. Completar Setup y fundamentos, incluida verificación del perfil, inicio y retirada del pipeline local.
2. Entregar US1 con pruebas controladas de prioridad textual/Top-1, confirmación y comprobante temporal sin nueva frase.
3. Validar US1 por separado. Es el primer incremento demostrable; no acredita F002 completa ni integración/rendimiento reales por sí solo.

### Incremental Delivery

1. US2 acredita inicio de colección vacía sin confundir incompatibilidad.
2. US3 acredita fallos remotos y ausencia de efectos después de errores propagados, además de la matriz pública previa.
3. US4 acredita persistencia TEI/UUID/fechas y validaciones independientes.
4. Cierre acredita suites completas, eliminación local, transporte real, SQL, tres solicitudes de latencia y trazabilidad actualizada.

## Notes

- Las tareas de verificar/corregir preservan lo ya implementado: si el criterio ya pasa, registrar la comprobación sin reescribir el componente.
- La identidad canónica, payload y perfil se toman de `contracts/embeddings-service.md`; no inventar otro modelo, un default de timeout ni un digest de ejemplo aceptable en producción.
- No crear otra rama, feature, contenedor, biblioteca LangChain completa, módulo AI, puerto HTTP genérico ni proceso de limpieza automática para esta transición.
- La evidencia semántica histórica sigue siendo 12/20 aciertos y ocho falsos negativos. Las pruebas técnicas TEI no recalibran el umbral ni acreditan nuevas cifras de calidad.

## Retirada de JWT — contrato UUID

- [x] T036 Sustituir el resultado, DTO y mapper por validationId igual al UUID v4 persistido, sin alias.
- [x] T037 Eliminar puerto, adaptador, servicio y pruebas de firma, registros DI, jose y secreto de ejemplos/fixtures.
- [x] T038 Adaptar unitarias y E2E: identidad y fechas persistidas, TTL, expiración en igualdad, independencia y errores de persistencia; arranque sin secreto.
- [x] T039 Actualizar especificación, plan, modelo, contratos y documentación de arquitectura; documentar incompatibilidad y obligaciones del futuro registro.
- [x] T040 Ejecutar build, unitarias y E2E; registrar resultados actuales separados de evidencia histórica.
