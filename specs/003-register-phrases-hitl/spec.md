# Feature Specification: F003 — Registro de Frases con Confirmación HITL

**Feature Branch**: Sin rama nueva; rama observada `main`.

**Created**: 2026-10-22

**Status**: Implementada; simplificación autorizada a dos repositorios con escrituras secuenciales. Revisión de alineación con el código (2026-10-24): modelo incompatible = 409/`INCOMPATIBLE_MODEL`; los parámetros de query no declarados se ignoran.

Esta revisión sustituye las garantías de atomicidad, rollback y registro único concurrente del diseño anterior y de las fuentes compartidas citadas como contexto histórico.

**Input**: Definir exclusivamente F003 del backend respetando las fuentes aprobadas y F002, sin inventar requisitos, redefinir arquitectura ni duplicar F001 o F002. Consultar ambigüedades e inconsistencias antes de resolverlas.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Guardar una frase validada sin alerta (Priority: P1)

Como persona que usa la lista compartida, quiero guardar explícitamente el mismo texto que validé y recibir la frase registrada.

**Why this priority**: Permite iniciar la colección y registrar contenido sin convertir la validación en guardado automático.

**Independent Test**: Partir de una validación temporal de F002 sin alerta; registrar y comprobar la frase creada y el consumo de la validación.

**Acceptance Scenarios**:

1. **Given** una validación vigente, no consumida, de versión compatible y con `requiresConfirmation=false`, **When** se solicita guardar el texto original omitiendo `confirmed`, **Then** se crea una frase, se consume la validación y se responde 201 con identificador, texto original y fecha de creación.
2. **Given** las mismas condiciones, **When** se envía `confirmed=false` o `confirmed=true`, **Then** se permite el registro; no se exige confirmar cuando el resultado almacenado no lo requiere.
3. **Given** una validación sin candidata por colección vacía o con candidata vectorial bajo el umbral, **When** se solicita guardar, **Then** ambos casos permiten registrar sin confirmación adicional.
4. **Given** un registro completado, **When** se consulta mediante F001, **Then** la frase forma parte de la colección con el contrato y orden existentes.
5. **Given** una validación exitosa sin solicitud posterior de registro, **When** transcurre el tiempo, **Then** F003 no crea ninguna frase automáticamente.

---

### User Story 2 — Decidir ante una posible coincidencia (Priority: P1)

Como persona advertida de una coincidencia textual o semántica, quiero que solo mi confirmación explícita permita guardar de todos modos.

**Why this priority**: Es la garantía HITL central; la coincidencia advierte y la persona decide.

**Independent Test**: Usar validaciones textuales y vectoriales con alerta; intentar registrar sin confirmar y después confirmar; observar una cancelación sin solicitud de registro.

**Acceptance Scenarios**:

1. **Given** `requiresConfirmation=true` en una validación aplicable, **When** se omite `confirmed` o se envía `false`, **Then** se responde 409/`CONFIRMATION_REQUIRED`, sin frase nueva ni consumo.
2. **Given** esa validación todavía vigente y no consumida, **When** se envía el mismo texto con `confirmed=true`, **Then** se permite registrar y consumirla, incluso ante igualdad textual normalizada.
3. **Given** una advertencia de F002, **When** la persona cancela y el cliente no solicita registro, **Then** no se crea una frase ni un estado adicional de cancelación; la validación temporal expira conforme a F002.
4. **Given** `confirmed="true"`, `confirmed=1` o `confirmed=null`, **When** se intenta registrar, **Then** se responde 400/`VALIDATION_ERROR`, sin coerción a booleano.
5. **Given** una propiedad ajena al contrato como `requiresConfirmation=false`, **When** se intenta guardar, **Then** se rechaza; la validación almacenada es la autoridad sobre la necesidad de confirmar.

---

### User Story 3 — Impedir el uso de una validación no aplicable (Priority: P1)

Como cliente del backend, quiero conocer cuándo la validación no autoriza guardar para corregir la solicitud o volver a validar.

**Why this priority**: Evita eludir la validación previa o reutilizar una decisión para otra frase.

**Independent Test**: Intentar registrar con referencia ausente, malformada, expirada o consumida y con texto distinto; comprobar errores y ausencia de nuevos registros.

**Acceptance Scenarios**:

1. **Given** referencia ausente o UUID malformado, **When** se solicita registrar, **Then** se responde 400/`INVALID_VALIDATION_ID`, sin creación.
2. **Given** una validación para un texto, **When** se envía un original distinto aunque coincida tras normalizar espacios o mayúsculas, **Then** se responde 400/`PHRASE_MISMATCH`, sin consumo ni creación; el texto modificado requiere otra validación.
3. **Given** una validación pendiente, **When** el instante de comprobación alcanza o supera `expiresAt`, **Then** se responde 409/`VALIDATION_EXPIRED`, sin consumo ni registro.
4. **Given** una validación ya consumida sin otras causas concurrentes de rechazo, **When** se reutiliza, **Then** se responde 409/`VALIDATION_ALREADY_USED`, sin crear otra frase.
5. **Given** una referencia UUID v4 bien formada pero inexistente, **When** se solicita registrar, **Then** se responde 400/`INVALID_VALIDATION_ID`, sin crear una frase ni inferir expiración o consumo previo.
6. **Given** una validación de modelo/versión incompatible con `AI_MODEL`/`AI_EMBEDDING_VERSION`, **When** se solicita registrar, **Then** se responde 409/`INCOMPATIBLE_MODEL`, sin crear una frase ni consumir la validación.
7. **Given** una validación que expira o es consumida entre la comprobación previa y la operación efectiva, **When** se intenta registrar, **Then** no hay revalidación durante las escrituras (ver FR-009); solo se rechaza lo observado en la lectura previa.

> Nota (implementación): el orden real de comprobación en `CreatePhraseUseCase` es existencia → consumida → expirada → texto exacto → modelo/versión → confirmación. Si coinciden varias causas, se informa la primera en ese orden (p. ej. una validación consumida y expirada responde `VALIDATION_ALREADY_USED`).

---

### User Story 4 — Guardar secuencialmente y propagar fallos (Priority: P1)

Como persona que guarda una frase, quiero recibir éxito cuando terminen la inserción y el consumo, con errores técnicos seguros si falla alguna escritura.

**Independent Test**: Probar por separado fallos de inserción y consumo y verificar el estado persistente resultante.

**Acceptance Scenarios**:

1. **Given** un fallo de inserción, **When** se solicita registrar, **Then** se revierte la transacción: no se guarda la frase ni se consume la validación, y se propaga el error.
2. **Given** un fallo al guardar el consumo, **When** se solicita registrar, **Then** se revierte la transacción: la frase no queda guardada y un reintento es seguro.
3. **Given** dos solicitudes que leen la misma validación pendiente, **When** se registran simultáneamente, **Then** solo una guarda la frase; la otra recibe 409/`VALIDATION_ALREADY_USED`.
4. **Given** consumo completado, **When** otra solicitud lee el comprobante, **Then** se rechaza con 409/`VALIDATION_ALREADY_USED` antes de escribir.
5. **Given** dos validaciones diferentes aplicables, **When** se registran, **Then** pueden crear frases independientemente, sin unicidad global.
6. **Given** una solicitud autorizada, **When** ambas escrituras terminan, **Then** se responde 201 conservando los datos almacenados sin nueva inferencia ni búsqueda.
7. **Given** un fallo técnico, **When** se responde, **Then** se usa 500/`DATABASE_ERROR` para fallos de BD o 500/`INTERNAL_ERROR` para fallos inesperados ajenos a BD, sin detalles internos.

### User Story 5 — Aplicar la misma entrada admisible del flujo previo (Priority: P1)

Como cliente del backend, quiero que el registro respete las reglas de entrada de F002 para continuar con el mismo texto validado.

**Why this priority**: Mantiene la continuidad entre validación y registro sin introducir reglas adicionales.

**Independent Test**: Enviar entradas en los límites de longitud y con controles, signos y emojis; comprobar admisibilidad y ausencia de límite por volumen.

**Acceptance Scenarios**:

1. **Given** un original admisible de 280 puntos de código y su validación aplicable, **When** se registra, **Then** se permite el guardado; una entrada de 281 recibe 400/`VALIDATION_ERROR` sin consumo ni creación.
2. **Given** texto ausente, de tipo distinto de cadena, vacío tras trim o con controles Unicode `Cc`, incluidas tabulación, LF y CR, **When** se solicita registrar, **Then** se responde 400/`VALIDATION_ERROR` sin consumo ni creación.
3. **Given** signos o emojis sin letras, no vacíos y con validación aplicable, **When** se solicita registrar, **Then** no se rechazan por carecer de letras. Los espacios externos cuentan para el límite y el original se conserva.
4. **Given** solicitudes de registro, **When** su volumen supera 60 por minuto, **Then** F003 no impone un límite global ni responde 429/`RATE_LIMIT_EXCEEDED` por volumen; cada petición sigue su validación funcional normal.

### Edge Cases

- `now >= expiresAt` implica expiración. Registrar no renueva la vigencia configurable inicialmente de 15 minutos establecida por F002.
- La normalización sirve para búsqueda, no autoriza un original diferente ni altera el texto guardado. Se conservan espacios, mayúsculas, tildes y puntuación del original validado.
- `confirmed=true` no subsana referencia inválida, expiración, consumo, cambio de texto ni incompatibilidad.
- Cancelar no comunica una revocación al backend; no existe endpoint de cancelación. La confirmación se declara en cada solicitud y no prueba que la persona vio la alerta.
- El corpus puede cambiar entre validar y guardar; F003 utiliza el resultado conservado, sin recalcular la alerta ni bloquear registros ajenos.
- La caída del servicio de embeddings después de validar no exige segunda inferencia para registrar. F003 no modifica las condiciones de arranque de la aplicación.
- Una referencia eliminada físicamente no permite deducir expiración o consumo; no se inventa ese estado y se responde 400/`INVALID_VALIDATION_ID`.
- Si varias causas de rechazo coinciden, no se define un orden nuevo de precedencia; los escenarios de error aíslan cada causa y siempre se impide el registro no autorizado.
- El límite de nuevas creaciones es de 280 puntos de código del original, incluidos espacios externos; se conserva la lectura histórica de hasta 500 de F001. No se limita el volumen global de solicitudes.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE permitir registrar una frase previamente validada mediante `POST /api/v1/phrases`, en la colección compartida y sin autenticación ni propiedad individual.
- **FR-002**: La solicitud DEBE contener únicamente `text`, `validationId` y opcionalmente `confirmed`. El texto DEBE ser cadena real y la referencia el UUID v4 de una validación persistida por F002; no se admiten JWT, firma ni alias `validationToken`.
- **FR-003**: Omitir `confirmed` DEBE equivaler a `false`; si está presente DEBE ser booleano real, sin coerción de cadenas, números o nulos.
- **FR-004**: El sistema DEBE recuperar la validación y comprobar existencia, correspondencia exacta con el texto original, modelo/versión compatibles, vigencia, estado no consumido y confirmación cuando corresponda. Confirmar NO DEBE permitir omitir esas condiciones.
- **FR-005**: La necesidad de confirmar DEBE provenir del resultado almacenado. Si es verdadera, solo `confirmed=true` autoriza continuar; si es falsa, ambos booleanos o la omisión permiten continuar cumpliendo las demás condiciones.
- **FR-006**: Una coincidencia confirmada NO DEBE impedir por sí misma el registro. Se permiten duplicados autorizados, sin unicidad del contenido.
- **FR-007**: Una validación DEBE considerarse expirada al alcanzar su expiración. El registro NO DEBE prolongar vigencia ni sustituir una nueva validación por una confirmación.
- **FR-008**: Leer y comprobar el comprobante en aplicación, construir la frase con sus datos y ejecutar secuencialmente phrases.save(phrase) y validations.update(id, { consumedAt }). Retornar tras ambas llamadas.
- **FR-009**: Rechazar consumo previo observado en la lectura. No hay garantía de registro único ante solicitudes concurrentes ni revalidación durante las escrituras.
- **FR-010**: Guardar la frase y consumir la validación en una única transacción (todo o nada). El consumo es condicional a que la validación no esté consumida; si ya lo estaba se rechaza con 409/`VALIDATION_ALREADY_USED`.
- **FR-011**: El sistema DEBE guardar el original validado, su texto normalizado con las reglas existentes, la misma representación semántica y modelo/versión. NO DEBE repetir inferencia, normalizar de nuevo el vector, buscar otra coincidencia ni reevaluar el umbral.
- **FR-012**: El éxito DEBE responder 201 con exactamente `{data: {id, text, createdAt}}`; identificador UUID v4 y fecha/hora con zona horaria. NO DEBE exponer vectores, texto normalizado, modelo ni datos de validación.
- **FR-013**: Los errores DEBEN usar `application/problem+json` con `title`, `status`, `detail`, `code` y opcionalmente `errors: [{field, messages: string[]}]`, sin `type` explícito, `timestamp`, `traceId`, secretos ni trazas. El estado HTTP DEBE coincidir con `status`.
- **FR-014**: El sistema DEBE aplicar el catálogo siguiente. Una referencia inexistente DEBE producir 400/`INVALID_VALIDATION_ID`; una validación de modelo/versión incompatible, 409/`INCOMPATIBLE_MODEL`. Ningún rechazo DEBE crear una frase o consumir la validación, ni comunicarse como éxito.
- **FR-015**: Cancelar o abandonar sin solicitar registro NO DEBE crear frases ni estados de cancelación. F003 NO DEBE añadir endpoints de confirmación, revocación, renovación ni consulta de validaciones temporales.
- **FR-016**: Validaciones diferentes pueden registrarse independientemente si son aplicables; no existe bloqueo global ni corpus inmutable.
- **FR-017**: El sistema DEBE mantener el alcance arquitectónico de trazabilidad temporal: consumir la validación al registrar, sin añadir auditoría permanente ni conservar obligatoriamente una asociación histórica entre frase y validación. La limpieza manual puede eliminar dicha evidencia sin afectar la frase definitiva; se acepta expresamente la excepción al brief sobre metadata y decisión humana permanentes por frase.
- **FR-018**: La entrada de registro DEBE tener de 1 a 280 puntos de código Unicode del original, incluidos espacios externos, no quedar vacía tras trim y no contener controles Unicode `Cc`. NO DEBE exigirse al menos una letra. Se preserva el original y no se altera la lectura histórica de F001.
- **FR-019**: F003 NO DEBE imponer un límite global por volumen de solicitudes ni producir 429/`RATE_LIMIT_EXCEEDED` por ese motivo. Se reutilizan las reglas existentes del flujo sin incorporar mecanismos nuevos de control de volumen.

### Contrato público de F003

Esta sección documenta el comportamiento externo con las decisiones HITL aprobadas. Los ajustes respecto al contrato compartido se detallan en Compatibilidad; no se prescribe estructura de código.

**Entrada**: `POST /api/v1/phrases`, JSON. Se rechazan propiedades desconocidas en el body (`forbidNonWhitelisted`). Los parámetros de consulta no se declaran en el controlador y se ignoran (p. ej. `?extra=1` no altera el resultado). `text` y `validationId` son obligatorios; `confirmed` es opcional. Texto de 1–280 puntos de código del original, no vacío tras trim y sin controles `Cc`; no se exigen letras ni se limita el volumen global de solicitudes.

```json
{
  "text": "Me gusta viajar a Cusco",
  "validationId": "550e8400-e29b-41d4-a716-446655440000",
  "confirmed": true
}
```

**Éxito**: 201, `application/json`, tanto con confirmación como sin ella:

```json
{
  "data": {
    "id": "123e4567-e89b-42d3-a456-426614174000",
    "text": "Me gusta viajar a Cusco",
    "createdAt": "2026-10-22T19:02:00.000Z"
  }
}
```

| Estado / código | Condición |
| --- | --- |
| 400 / `VALIDATION_ERROR` | Texto/confirmación inválidos o campos ajenos al contrato en el body (`detail`: «Los datos enviados no son válidos.»); detalles por campo cuando corresponda. Incluye texto mayor de 280 puntos de código, vacío tras trim o con controles `Cc`. |
| 400 / `INVALID_VALIDATION_ID` | Referencia ausente, UUID malformado o referencia UUID v4 bien formada pero inexistente; no se infiere su estado anterior. |
| 400 / `PHRASE_MISMATCH` | Original recibido distinto del asociado a la validación. |
| 409 / `VALIDATION_EXPIRED` | Validación pendiente que alcanzó su expiración. |
| 409 / `VALIDATION_ALREADY_USED` | Validación consumida al leer el comprobante. |
| 409 / `CONFIRMATION_REQUIRED` | Alerta almacenada sin `confirmed=true`. |
| 409 / `INCOMPATIBLE_MODEL` | Modelo o versión de la validación distintos de los configurados (`detail`: «La validación no es compatible con el modelo actual.»). |
| 500 / `INTERNAL_ERROR` | Fallo inesperado, con mensaje público seguro. |
| 500 / `DATABASE_ERROR` | Fallo de conexión, consulta o escritura al recuperar o registrar. |

F003 no realiza inferencia ni incorpora `AI_UNAVAILABLE` como error propio del registro.

### Key Entities

- **Frase registrada**: Contenido definitivo con identidad, original, texto normalizado, representación semántica previa, modelo/versión y fecha de creación. La respuesta solo contiene identidad, texto y fecha.
- **Validación temporal**: Resultado de F002 con identidad independiente, texto autorizado, representación semántica y modelo/versión, coincidencia, necesidad de confirmar, expiración y consumo. F003 lo comprueba y consume, sin crear otro.
- **Confirmación declarada**: Booleano que permite continuar ante una alerta. No identifica personas ni demuestra que vieron la advertencia. No se añade conservación histórica permanente de la decisión por frase.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Cada solicitud autorizada sin alerta y sin fallos crea una frase con el original validado y guarda el consumo. Esto no garantiza unicidad entre solicitudes concurrentes.
- **SC-002**: El 100 % de las alertas sin confirmación explícita crea cero frases y consume cero validaciones; todos los casos aplicables confirmados permiten guardar, incluida la coincidencia textual.
- **SC-003**: Todos los casos de texto cambiado, expiración, referencia no aplicable y consumo previo se rechazan sin registros nuevos; alcanzar exactamente la expiración nunca permite guardar.
- **SC-004**: Las pruebas verifican el orden y la espera de ambas escrituras. Se documenta que solicitudes concurrentes pueden crear varias frases.
- **SC-005**: Los fallos de inserción no intentan consumir; los de consumo conservan la frase y propagan el error.
- **SC-006**: El 100 % de los registros de aceptación conserva el contenido validado y reutiliza su representación semántica previa sin repetir la evaluación de similitud.
- **SC-007**: En todos los escenarios de respuesta, el cliente distingue creación, entrada inválida, confirmación pendiente, expiración, consumo previo, incompatibilidad de modelo y fallo técnico mediante el resultado público, sin datos internos expuestos. La referencia inexistente y la incompatibilidad se distinguen mediante el catálogo vigente.
- **SC-008**: Todos los escenarios de cancelación sin solicitud de registro crean cero frases y cero registros adicionales de cancelación.

- **SC-009**: Todos los casos de aceptación de longitud, espacios externos, controles, signos y emojis cumplen las mismas reglas de admisibilidad de F002; el volumen por sí solo no produce rechazos 429.
- **SC-010**: En una comprobación de limpieza manual de validaciones temporales consumidas, las frases definitivas permanecen disponibles; no se exige reconstruir la evidencia histórica eliminada.

No se inventa una meta de latencia de registro; los 5 segundos aprobados corresponden a F002.

## Assumptions

### Alcance y dependencias aprobadas

- F003 solo registra y consume validaciones. Advertencias visuales, botones, conservar texto en pantalla y actualizar visualmente el listado corresponden al cliente. F001 conserva listado, paginación y lectura histórica.
- F002 define admisibilidad de validación, prioridad textual, Top-1, umbral, generación, resultado temporal, UUID y expiración configurable inicialmente de 15 minutos. No se duplican esas responsabilidades.
- Las decisiones explícitas de F002 sobre el servicio de embeddings existente prevalecen frente al pipeline local anterior para esa dependencia. F003 no altera modelo, runtime, umbral, proveedor ni condiciones de arranque.
- Se conservan frase y validación independientes y sin historial permanente. Registro y consumo son escrituras secuenciales sin atomicidad.
- Se excluyen autenticación, roles, edición, eliminación, moderación, detección de idioma, nuevos modelos, limpieza automática y procesos de fondo.
- Verificar construcción, rechazos, orden y fallos con unitarias y HTTP según AGENTS.md y constitución. Las antiguas garantías transaccionales del diseño compartido quedan sustituidas por esta simplificación autorizada.

### Fuentes consultadas y trazabilidad

Rutas relativas a la raíz del repositorio; no se modifican estas fuentes en el borrador.

| Fuente | Aplicación a F003 |
| --- | --- |
| `apps/backend/AGENTS.md` | Alcance, contratos y verificación de comportamiento. |
| `apps/backend/.specify/memory/constitution.md` | Contratos explícitos, pruebas, simplicidad y límites arquitectónicos. |
| `docs/00-discovery/product-brief.md` | FR-003, FR-009, FR-011–FR-015; BR-001–BR-004, BR-014–BR-015; UF-001–UF-005; AC-006–AC-008, AC-013, AC-015–AC-017. Excepciones aprobadas en Q1-A/Q2-A. |
| `docs/03-architecture/02-backend-architecture.md` | §3–§6: separación de registro, confirmación, reutilización y atomicidad. |
| `docs/03-architecture/04-ai-architecture.md` | §4–§5 y §9: no repetir inferencia y comprobar compatibilidad previa. |
| `docs/03-architecture/05-data-architecture.md` | §4 y §9–§12: original, sin unicidad, consumo único, reversión, concurrencia y trazabilidad limitada. |
| `docs/03-architecture/06-api-security.md` | §4.2, §6–§7 y §10: petición, booleano estricto, errores y continuidad HITL. |
| `docs/03-architecture/openapi.yaml` | `createPhrase`, `CreatePhraseRequest`, `PhraseEnvelope`, errores; ajuste de creación aprobado en Q2-A y clasificación precisada en Q3-A. |
| `apps/backend/specs/002-semantic-similarity-validation/spec.md` | Decisiones HITL, 280 puntos de código, sin límite global, UUID sin firma, resultado temporal y límites del registro futuro. |
| `apps/backend/specs/001-list-phrases/spec.md` | Solo contraste: listado, lectura histórica hasta 500 puntos de código y retirada del límite global. |

### Decisiones HITL aprobadas

- **Q1-A — Evidencia**: El usuario aprobó mantener el alcance arquitectónico sin auditoría permanente. Se acepta expresamente la excepción al brief FR-012, BR-014, AC-006 y AC-015 sobre metadata completa y decisión humana vinculadas permanentemente a cada frase. El consumo temporal refleja el uso de la validación, sin añadir historial ni asociación permanente.
- **Q2-A — Continuidad contractual**: El usuario aprobó alinear F003 con F002 y pidió «lo más simple posible»: 1–280 puntos de código del original, trim no vacío, sin controles Cc, sin exigir letras y sin límite global/429. Se conservan lectura histórica de F001 y reglas existentes, sin introducir mecanismos adicionales.
- **Q3-A — Rechazos**: Tras consultar la alternativa más sencilla sin reingeniería, el usuario confirmó reutilizar 400/`INVALID_VALIDATION_ID` para referencia inexistente y 500/`INTERNAL_ERROR` para modelo/versión incompatible. Nota (implementación): el código final añadió `INCOMPATIBLE_MODEL` y responde 409 para la incompatibilidad; sigue sin consumir ni guardar, sin inferir estados anteriores.

### Compatibilidad

Estas decisiones precisan F003 antes de implementar. Frente a `CreatePhraseRequest` en el OpenAPI consultado, el texto de nuevas creaciones pasa de 500 a 280 puntos de código y se retira 429 por volumen de esta operación. La lectura histórica de hasta 500 puntos de código de F001 no cambia. Se mantienen ruta, campos, booleano opcional, envoltorio de éxito y demás errores; Q3 reutilizó códigos existentes; la incompatibilidad quedó finalmente como 409/`INCOMPATIBLE_MODEL`.

El contrato compartido y las secciones afectadas del bloque 06 deberán reflejar estos ajustes antes de implementar F003. Esta invocación actualiza la especificación y su checklist; no modifica fuentes externas al backend ni implementa código. Q1 documenta la excepción al brief sin rediseñar la persistencia.

Texto original estricto, consumo único, ausencia de segunda inferencia y cancelación sin endpoint ya están definidos y no se reabren. Puntuación textual y almacenamiento temporal discrepantes con el brief fueron resueltos en F002; no se convierten en responsabilidades nuevas de F003.


## Unificación de errores de BD — 2026-10-22

Esta revisión sustituye la clasificación anterior de disponibilidad de BD: todo fallo de conexión, SQL o restricciones en consultas, inserciones o actualizaciones devuelve 500/`DATABASE_ERROR` con el mensaje «Ocurrió un error de base de datos.». El backend conserva la causa y la registra con el stack una sola vez; la respuesta no expone SQL, trazas ni datos internos. Los errores de dominio, aplicación y mapeo conservan su tratamiento; IA conserva 503/`AI_UNAVAILABLE`. Cambio incompatible para clientes que esperaban 503/`DATABASE_UNAVAILABLE`.
