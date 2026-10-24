# Tasks: F003 — Registro de Frases con Confirmación HITL

**Input**: spec.md, plan.md, data-model.md, research.md, contracts/ y quickstart.md de `specs/003-register-phrases-hitl/`.
**Prerequisites**: Backend F001/F002 y `.specify/memory/constitution.md`.
**Criterio de implementación**: Lo básico, claro y funcional. Reutilizar los componentes existentes y escribir funciones cortas con condiciones directas. Cada regla se implementa una vez; cada prueba debe comprobar un comportamiento útil. No añadir validaciones defensivas para estados ajenos al contrato ni combinaciones exhaustivas de errores.
**Tests**: Unitarias para reglas y HTTP para el contrato. Verificar construcción, orden, fallos y persistencia parcial; no crear infraestructura de pruebas nueva.

## Format: `[ID] [P?] [Story] Description`

Rutas relativas al backend. `[P]` indica archivos distintos que pueden trabajarse en paralelo después de sus prerrequisitos. Las etiquetas US corresponden a las cinco historias P1 de la spec.

## Phase 1: Setup

**Objetivo**: Alinear el contrato antes de implementar el endpoint.

- [X] T001 Sincronizar `../../docs/03-architecture/openapi.yaml` y `../../docs/03-architecture/06-api-security.md` según `specs/003-register-phrases-hitl/contracts/README.md`: texto nuevo de hasta 280 puntos de código, confirmed opcional booleano, UUID v4, errores aprobados y sin 429 por volumen; conservar lectura histórica y F002. Respetar los permisos de escritura de esos archivos externos al backend.

## Phase 2: Foundational

**Objetivo**: Leer la validación guardada y definir las pocas piezas compartidas que necesita el registro.

- [X] T002 Añadir findById al puerto `src/modules/phrases/application/ports/outbound/phrase-validation-repository.port.ts`; conservar save, sin tipos Drizzle. Nota (implementación): no existe `StoredPhraseValidation`; `findById` devuelve la entidad `PhraseValidation`.
- [X] T003 [P] Definir CreatePhraseInput, CreatePhrasePort y settings del modelo en `src/modules/phrases/application/ports/inbound/create-phrase.port.ts`, sin puerto adicional de registro. Nota (implementación): el modelo se arma en el constructor del caso de uso con `getOrThrow`; no existe el token `REGISTRATION_MODEL`.
- [X] T004 Implementar findById y el mapeo de la entidad `PhraseValidation` en `src/modules/phrases/infrastructure/persistence/drizzle/phrase-validation/drizzle-phrase-validation.repository.ts` y `src/modules/phrases/infrastructure/persistence/drizzle/phrase-validation/drizzle-phrase-validation.mapper.ts`; conservar requiresConfirmation y consumedAt almacenados. Ampliar sus archivos `.spec.ts` con lectura existente/ausente y conservación de esos valores.
- [X] T005 Crear `src/modules/phrases/application/errors/phrase-registration.error.ts` con los motivos funcionales del contrato. Nota (implementación): `assert-validation-applicable.ts` no existe (no implementado); las comprobaciones están en línea en `create-phrase.use-case.ts` con métodos de la entidad `PhraseValidation`, cubiertas en `create-phrase.use-case.spec.ts` y `phrase-validation.entity.spec.ts`. Incompatibilidad = 409 `INCOMPATIBLE_MODEL`.

**Checkpoint**: Lectura y reglas compartidas disponibles. T004 depende de T002; T005 usa los contratos T002–T003. No añadir servicios de reloj, repositorios genéricos ni nuevas jerarquías de errores.

## Phase 3: User Story 1 — Guardar una frase validada sin alerta (P1, MVP)

**Objetivo**: Registrar explícitamente la frase y verla en el listado.
**Prueba independiente**: Una validación sin alerta permite guardar con confirmed omitido/false/true. Se devuelve 201, se conserva el original y la frase aparece en GET. Validar sin registrar no crea frases.

- [X] T006 [P] [US1] Escribir los casos de éxito de CreatePhraseUseCase en `src/modules/phrases/application/use-cases/create-phrase.use-case.spec.ts`: confirmed omitido equivale a false, usa el modelo esperado y delega el registro sin inferencia ni búsqueda.
- [X] T007 [P] [US1] Crear `test/phrase-registration.e2e-spec.ts` con configureApp y dobles existentes para validar → registrar → listar; comprobar 201 exactamente con data.id/text/createdAt, colección vacía/candidata bajo umbral y confirmed omitido/false/true. Reutilizar esta suite para las historias siguientes.
- [X] T008 Implementar CreatePhraseUseCase: leer y validar comprobante, construir Phrase con datos almacenados y esperar phrases.save y validations.update en ese orden.
- [X] T009 Añadir INSERT normal a PhraseRepositoryPort/DrizzlePhraseRepository y UPDATE parcial por id, usado para consumedAt en registro a PhraseValidationRepositoryPort/DrizzlePhraseValidationRepository; conservar INSERT temporal. Eliminar puerto, adaptador y pruebas de registro especializado.
- [X] T010 [US1] Crear `src/modules/phrases/infrastructure/http/dtos/create-phrase-request.dto.ts`, y `src/modules/phrases/infrastructure/http/dtos/create-phrase-response.dto.ts` siguiendo F002: IsValidPhraseText existente, IsUUID('4'), ValidateIf para omitir solo undefined e IsBoolean sin coerción, respuesta pública mínima. Nota (implementación): no existe `create-phrase-query.dto.ts`; la query no se declara y se ignora.
- [X] T011 [US1] Crear `src/modules/phrases/infrastructure/http/filters/phrase-registration.filter.ts` para traducir motivos al catálogo del contrato y errores DTO: validationId inválido usa INVALID_VALIDATION_ID, resto VALIDATION_ERROR. Reutilizar el builder, errors[].messages[] y manejo técnico global; probar las traducciones en `src/modules/phrases/infrastructure/http/filters/phrase-registration.filter.spec.ts` sin repetir reglas del caso de uso.
- [X] T012 [US1] Conectar POST 201 en `src/modules/phrases/infrastructure/http/controllers/phrases.controller.ts`, respuesta en `src/modules/phrases/infrastructure/http/mapper/phrases.mapper.ts` y dependencias en `src/modules/phrases/phrases.module.ts`; aplicar los filtros de registro e InvalidValidationTextFilter solo al POST. Configurar PhraseModel desde AI_MODEL/AI_EMBEDDING_VERSION y adaptar los tests existentes afectados por el nuevo puerto/dependencia, incluidos controller y mapper. Requiere T001 y T008–T011.

**Checkpoint**: Flujo completo con las reglas de autorización y escrituras secuenciales desde el primer registro. US1 es el MVP de demostración; las historias siguientes completan su aceptación.

## Phase 4: User Story 2 — Decidir ante una posible coincidencia (P1)

**Objetivo**: Exigir confirmación únicamente cuando la validación guardada tiene alerta.
**Prueba independiente**: Sin true, una alerta devuelve 409 sin consumir. Reintentar con true permite guardar, incluso coincidencia textual. Cancelar sin POST no guarda.

- [X] T013 [US2] Cubrir en `test/phrase-registration.e2e-spec.ts` alerta textual/vectorial → CONFIRMATION_REQUIRED → reintento con true → 201; confirmar que string/número/null y requiresConfirmation enviado por el cliente se rechazan. Añadir el caso de abandono sin POST aprovechando el flujo F002.
- [X] T014 [US2] Completar el comportamiento HITL en `src/modules/phrases/application/use-cases/create-phrase.use-case.ts` y su `.spec.ts` (nota: `assert-validation-applicable.ts` no existe): usar únicamente requiresConfirmation almacenado, exigir true ante alerta y admitir duplicados confirmados. Reutilizar DTO y filtro de US1; no crear otro flujo de confirmación.

## Phase 5: User Story 3 — Impedir el uso de una validación no aplicable (P1)

**Objetivo**: Devolver el error correcto sin guardar ni consumir una validación no aplicable.
**Prueba independiente**: Referencia inválida/inexistente, texto diferente, expiración, consumo e incompatibilidad se rechazan; confirmed=true no evita estos errores.

- [X] T015 [P] [US3] Ampliar `test/phrase-registration.e2e-spec.ts` con los errores de referencia ausente/malformada/no-v4/inexistente, PHRASE_MISMATCH, VALIDATION_EXPIRED, VALIDATION_ALREADY_USED e incompatibilidad de modelo/versión. Aislar cada causa y comprobar código/status, ausencia de creación y conservación del consumo anterior.
- [X] T016 Probar construcción fiel, orden y espera de llamadas, rechazos antes de escribir y fallos de cada guardado.

## Phase 6: User Story 4 — Conservar integridad ante fallos y envíos simultáneos (P1)

**Objetivo**: Propagar fallos de cada guardado, conservando la frase si falla el consumo.
**Prueba independiente**: Un fallo de inserción no intenta consumir; un fallo de consumo conserva la frase. Solicitudes simultáneas pueden crear varias frases (sin garantía de registro único). Dos validaciones distintas pueden guardar el mismo texto.

- [X] T017 Probar INSERT de frase, UPDATE parcial por id y traducción de errores. Adaptar dobles y HTTP: error de inserción sin consumo; error de consumo conserva frase; reenvío tras éxito rechazado.
- [X] T018 Sustituir la comprobación transaccional anterior por pruebas de escrituras independientes; documentar ausencia de rollback y garantía de registro único concurrente. No se requiere harness de BD real para esta simplificación.

## Phase 7: User Story 5 — Aplicar la misma entrada admisible del flujo previo (P1)

**Objetivo**: Reutilizar las reglas de entrada de F002 y conservar lectura histórica.
**Prueba independiente**: Se admiten 280 puntos de código, signos/emojis y espacios originales; se rechazan 281, texto vacío/no cadena y controles Cc. El volumen no genera 429.

- [X] T019 [US5] Añadir casos parametrizados en `test/phrase-registration.e2e-spec.ts` para límites 280/281, emojis, signos, espacios externos, vacío/no cadena y controles Cc; comprobar body desconocido (la query no declarada se ignora), lectura histórica hasta 500 y más de 60 solicitudes sin 429 por volumen. Reutilizar las pruebas del validador F002 en lugar de crear otra batería idéntica.
- [X] T020 [US5] Verificar la reutilización de IsValidPhraseText en `src/modules/phrases/infrastructure/http/dtos/create-phrase-request.dto.ts` y PhraseText.forValidation en `src/modules/phrases/application/use-cases/create-phrase.use-case.ts`; corregir solo lo necesario para T019. Mantener el validador existente y el límite histórico de lectura.

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T021 [P] Actualizar `README.md` con el flujo validar → registrar, ejemplo de éxito, confirmación y errores; documentar solo el comportamiento implementado, sin nuevos artefactos de seguimiento.
- [X] T022 Ejecutar `pnpm run build`, `pnpm test -- --runInBand` y `pnpm run test:e2e -- --runInBand`; revisar lint/formato de `src/modules/phrases/` y `test/`, incluidos cambios automáticos. Confirmar formato problem+json y respuesta pública con la suite existente; anotar comandos/resultados y comprobaciones pendientes en `specs/003-register-phrases-hitl/quickstart.md`.

## Dependencies & Execution Order

```text
Setup → Foundational → US1
                        ├→ US2
                        ├→ US3
                        ├→ US4
                        └→ US5
Todas las historias → cierre
```

Orden recomendado: T001–T022. US2–US5 usan el flujo de US1 y pueden probarse con fixtures propios; ejecutar secuencialmente sus ediciones del archivo E2E compartido. US1 incluye las garantías de todas las historias desde el inicio: las fases posteriores completan sus escenarios, no permiten aplazar reglas necesarias.

## Parallel Examples per Story

| Historia | Trabajo en paralelo posible |
| --- | --- |
| US1 | T006 (caso de uso) y T007 (HTTP), después de Foundational |
| US2 | Sin separación útil: T013 y T014 se resuelven como un incremento pequeño |
| US3 | T015 (HTTP) y T016 (caso de uso), después de US1 y sin otra edición del E2E |
| US4 | Sin separación útil: T017 antes de la comprobación real T018 |
| US5 | Sin separación útil: T019 antes del ajuste necesario T020 |

T003 puede avanzar junto a T002. T021 puede avanzar junto a la revisión final, evitando ediciones simultáneas del mismo archivo.

## Implementation Strategy

Completar preparación y fundamentos, entregar US1 como MVP funcional y continuar con las historias en orden. Reutilizar las mismas reglas y suites. Mantener los dos repositorios existentes, funciones pequeñas y condiciones fáciles de seguir; no introducir abstracciones para casos futuros.

Las pruebas con dobles acreditan reglas, secuencia, persistencia parcial y contrato HTTP; no acreditan unicidad concurrente. Cerrar cuando las comprobaciones requeridas pasen, informando cualquier pendiente. La implementación y su evidencia de pruebas están registradas en quickstart.md.
