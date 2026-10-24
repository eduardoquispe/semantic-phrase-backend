# Feature Specification: F002 — Validación de Similitud Semántica

Cambio incompatible (2026-10-22): `validationId` sustituye a `validationToken`, sin alias.
Se devuelve el UUID v4 aleatorio de la validación persistida, sin firma ni JWT.
Los JWT anteriores dejan de formar parte del contrato; las filas existentes pueden
referenciarse por su UUID. No hay migración ni secreto de firma requerido.
El registro queda fuera de F002: busca por `validationId`, comprueba
vigencia (`now >= expiresAt` implica expiración), texto, modelo, confirmación y estado no
consumido, y consume la validación en una escritura posterior al guardado de la frase
(dos escrituras secuenciales, sin transacción; ver F003).
TTL configurable inicialmente de 15 minutos; respuesta y fila comparten expiración.

**Feature Branch**: Sin rama nueva; rama observada `feat/phrases-list`.

**Created**: 2026-10-22

**Status**: Implementada — inferencia en el servicio TEI de Docker; documento alineado con el código el 2026-10-24.

**Input**: Definir exclusivamente F002 del backend conforme a las fuentes aprobadas, sin implementar código, redefinir arquitectura ni resolver discrepancias sin intervención humana.

**Cambio solicitado — 2026-10-22**: Externalizar la inferencia de embeddings al contenedor Docker existente, consumirlo desde NestJS mediante LangChain y configurar su URL por entorno. Mantener MiniLM, 384 dimensiones, arquitectura hexagonal, puertos, comportamiento funcional y pgvector. Actualizar únicamente esta especificación, sin crear otra feature ni implementar código.

## Clarifications

### Session 2026-10-22

- Ajuste de implementación solicitado por el usuario: comprobar latencia con solo 3 solicitudes HTTP; sustituye la muestra de 20 prevista en tareas y quickstart.

- Q: Si existe una coincidencia textual, pero ninguna frase registrada tiene una representación semántica compatible con el modelo activo, ¿qué debe devolver la validación? → A: Responder 201 con coincidencia textual y confirmación requerida; aplicar el fallo por incompatibilidad solo si no hay coincidencia textual. También se genera y conserva una representación compatible del texto nuevo para el futuro guardado.

- Aclaración directa del usuario: el servicio de embeddings ya está ejecutándose en Docker. La configuración indicada como `../../compose.yml` corresponde al archivo existente `../../compose.yaml`; se reutiliza ese servicio, sin crear otro despliegue.
- Aclaración directa del usuario: la implementación posterior debe eliminar el código que deja de servir para inferencia local y limitar la integración de embeddings a conectarse al servicio existente mediante LangChain; no conservar un pipeline local alternativo.

## User Scenarios & Testing _(mandatory)_

### User Story 1 — Conocer una posible coincidencia antes de guardar (Priority: P1)

Como persona que utiliza la lista compartida, quiero validar una frase y conocer si requiere revisar una posible coincidencia antes de decidir guardarla.

**Why this priority**: Es el propósito de F002 y preserva la decisión humana sobre posibles duplicados.

**Independent Test**: Solicitar la validación con frases registradas conocidas y resultados de similitud controlados; comprobar la candidata, la necesidad de confirmación y que no se registra una nueva frase.

**Acceptance Scenarios**:

1. **Given** una frase registrada que solo difiere de la entrada por mayúsculas o espacios, **When** se valida, **Then** se devuelve `match.type=textual_exact`, la frase coincidente, `similarityScore=null` y `requiresConfirmation=true`; no se registra la frase.
2. **Given** que no hay igualdad textual y existe una candidata con la mayor similitud, **When** su puntaje alcanza o supera el umbral vigente, **Then** se devuelve una única candidata semántica con su puntaje y se requiere confirmación.
3. **Given** una candidata semántica cuyo puntaje es inferior al umbral, **When** termina la validación, **Then** no se requiere confirmación por similitud y no se registra la frase. Se devuelve la candidata vectorial y su puntaje, con `requiresConfirmation=false`; su presentación en pantalla corresponde al cliente.
4. **Given** varias candidatas con el mayor puntaje empatado, **When** se valida, **Then** se selecciona una sola mediante un criterio determinista, sin devolver múltiples alternativas.
5. **Given** entradas que difieren de frases registradas por tildes o puntuación, **When** no resultan textualmente iguales, **Then** se evalúa su similitud semántica sin tratarlas automáticamente como iguales.
6. **Given** una coincidencia textual y una colección sin representaciones compatibles con el modelo activo, **When** se genera una representación válida del texto nuevo y se conserva la validación, **Then** se responde 201 con `match.type=textual_exact`, `similarityScore=null` y `requiresConfirmation=true`, sin comparar vectores incompatibles.

---

### User Story 2 — Obtener un resultado sin frases previas (Priority: P1)

Como persona que inicia la colección compartida, quiero poder validar la primera frase sin que la ausencia de contenido se trate como un fallo.

**Why this priority**: Permite comenzar a utilizar la aplicación con una colección vacía.

**Independent Test**: Validar una entrada admisible con cero frases registradas y comprobar ausencia de candidata, puntaje y confirmación requerida.

**Acceptance Scenarios**:

1. **Given** una colección vacía y una entrada admisible, **When** se completa la validación, **Then** se obtiene un resultado válido sin candidata ni puntaje y sin necesidad de confirmación por coincidencia, con `match=null` y `requiresConfirmation=false`.
2. **Given** una validación finalizada con cualquier resultado, **When** no se solicita posteriormente el guardado, **Then** no aparece una nueva frase en la colección. La validación temporal permanece hasta su consumo, expiración o limpieza manual; cancelar no crea una frase ni un registro adicional de cancelación.

---

### User Story 3 — Reconocer entradas inválidas y fallos de validación (Priority: P1)

Como cliente del backend, quiero distinguir una validación completada de una entrada rechazada o un fallo técnico para corregir la entrada o reintentar.

**Why this priority**: Un fallo no puede autorizar el guardado ni comunicarse como ausencia de posibles duplicados.

**Independent Test**: Enviar entradas inválidas y provocar fallos de generación semántica, búsqueda y conservación del resultado; comprobar errores seguros y ausencia de un comprobante utilizable de éxito.

**Acceptance Scenarios**:

1. **Given** texto ausente, de tipo distinto de cadena o vacío tras eliminar espacios externos, **When** se solicita validación, **Then** se rechaza antes de la evaluación semántica.
2. **Given** una propiedad de entrada ajena al contrato, **When** se solicita validación, **Then** se rechaza la petición.
3. **Given** un fallo de IA, un tiempo de espera técnico agotado o una representación semántica inválida, **When** se valida, **Then** se comunica un fallo técnico sin resultado exitoso ni comprobante utilizable para guardar.
4. **Given** un fallo en la búsqueda o al conservar el resultado temporal, **When** se valida, **Then** no se informa falsamente que no existen coincidencias ni se registra la frase.
5. **Given** que una validación falló, **When** el cliente vuelve a solicitarla, **Then** puede reintentar manualmente; no se aplica una alternativa que permita omitir la validación.
6. **Given** entradas de 280 y 281 puntos de código Unicode, **When** se solicita validación, **Then** la primera satisface el límite de longitud y la segunda recibe 400/`VALIDATION_ERROR` antes de evaluar similitud.
7. **Given** una entrada con tabulación, salto de línea u otro carácter de control Unicode de categoría `Cc`, **When** se solicita validación, **Then** se rechaza con 400/`VALIDATION_ERROR`; una cadena con menos de 3 letras (p. ej. `!!!`, `ab`) o con emojis también se rechaza con 400/`VALIDATION_ERROR`; la puntuación (`¿ ? ! : ( )`) sí se admite.
8. **Given** una colección no vacía sin coincidencia textual ni representaciones compatibles con el modelo activo, **When** se solicita validación, **Then** se rechaza como fallo técnico de consistencia con 500/`INTERNAL_ERROR`, sin comprobante utilizable ni resultado sin coincidencias.
9. **Given** errores de entrada, IA, disponibilidad conocida de datos o un fallo inesperado, **When** se responde, **Then** los estados y cuerpos coinciden con el catálogo público de F002, sin revelar información interna.
10. **Given** que el servicio de embeddings no responde, rechaza la conexión, devuelve un error o supera el timeout configurado, **When** se valida, **Then** se responde 503/`AI_UNAVAILABLE`, sin reintentos automáticos, inferencia alternativa dentro de NestJS ni comprobante utilizable; el error de timeout propagado por el SDK no continúa hacia búsqueda o conservación.
11. **Given** una respuesta de embeddings malformada, con dimensión distinta de 384, componentes no finitos, **When** se valida, **Then** se responde 503/`AI_UNAVAILABLE` antes de consultar similitud o conservar una validación exitosa.

---

### User Story 4 — Disponer de una validación temporal para continuar (Priority: P1)

Como cliente del backend, quiero recibir un comprobante de la validación y su vigencia para poder iniciar posteriormente el guardado del mismo texto.

**Why this priority**: Une la validación y el guardado posterior sin registrar la frase al validar.

**Independent Test**: Completar validaciones textuales, vectoriales y sin candidata; comprobar que cada respuesta corresponde a un resultado temporal conservado y que sus expiraciones coinciden.

**Acceptance Scenarios**:

1. **Given** una entrada admisible, **When** finaliza una validación de cualquier tipo, **Then** se responde 201 con un único objeto `data` que contiene exactamente `validationId`, `expiresAt`, `requiresConfirmation` y `match`.
2. **Given** una validación exitosa, **When** se emite el comprobante, **Then** el resultado temporal conserva el texto original, su representación semántica, modelo y versión, candidata y puntaje cuando corresponda, necesidad de confirmación y fechas de creación y expiración; está inicialmente sin consumir.
3. **Given** la vigencia inicial de 15 minutos, **When** se crea una validación, **Then** `expiresAt` y la expiración del resultado conservado coinciden; al alcanzar esa fecha deja de estar vigente sin requerir una acción del cliente.
4. **Given** una coincidencia textual o una colección vacía, **When** se completa la validación, **Then** también se obtiene y conserva una representación semántica válida para el futuro guardado.
5. **Given** una respuesta exitosa, **When** el cliente examina sus campos y el UUID de referencia, **Then** no obtiene representaciones semánticas, texto dentro de la referencia ni metadatos internos del modelo. El comprobante no autentica a una persona.
6. **Given** una validación previa exitosa, **When** se valida nuevamente, **Then** se crea una validación temporal independiente; el resultado anterior conserva su vigencia original, sin que F002 lo consuma o prorrogue.
7. **Given** el servicio Docker disponible y su URL configurada, **When** se completa una validación, **Then** la representación se obtiene mediante LangChain desde ese servicio, contiene 384 componentes y se conserva con su modelo y versión efectivos; NestJS no carga ni ejecuta el modelo. Las respuestas públicas y las reglas de búsqueda en pgvector se mantienen.
8. **Given** una URL válida diferente para el mismo servicio de embeddings, **When** se cambia la configuración por entorno y se reinicia NestJS, **Then** se utiliza el nuevo destino sin modificar código ni el contrato público.

### Edge Cases

- El puntaje exactamente igual al umbral requiere confirmación; uno inferior no la requiere.
- Una similitud coseno negativa es válida y no representa una probabilidad negativa.
- La igualdad textual tiene prioridad incluso si ninguna frase registrada tiene una representación compatible; no se comparan sus vectores ni se fabrica un puntaje semántico para ella. Se sigue exigiendo generar y conservar una representación válida del texto nuevo.
- Una colección vacía no equivale a un fallo de consulta.
- Una colección no vacía sin coincidencia textual ni representaciones compatibles produce un fallo técnico; no se trata como colección vacía. La búsqueda nunca compara espacios incompatibles.
- Los vectores previos del artefacto Xenova `q8` no se consideran compatibles con los del servicio TEI `float32` solo por compartir MiniLM y 384 dimensiones. Sin compatibilidad verificada se conserva la separación por modelo y versión y se aplican FR-004 y FR-010; no se renombran versiones almacenadas ni se regeneran vectores automáticamente.
- Validar no congela la colección: otras personas pueden registrar frases después. F002 no garantiza una vista inmutable entre validación y guardado.
- El cambio de texto requiere una nueva validación aplicable; la comprobación durante el guardado pertenece a otra funcionalidad.
- El límite es de 280 puntos de código Unicode del texto recibido; los espacios externos cuentan para la longitud y no se eliminan del original. El recorte solo comprueba que no quede vacío y forma parte de la clave de comparación. Se exigen al menos 3 letras y se rechazan los emojis y los controles Unicode `Cc`, incluidas tabulación, LF y CR.
- La expiración se alcanza cuando la fecha actual es igual o posterior a `expiresAt`; su vigencia inicial configurable es de 15 minutos.
- Repetir una solicitud de validación no tiene garantía de idempotencia: puede crear comprobantes temporales distintos. F002 no introduce deduplicación de solicitudes.
- No se garantiza calidad semántica para idiomas distintos del español y no se detecta automáticamente el idioma.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: El sistema DEBE permitir solicitar la validación de una frase frente a la colección compartida, sin autenticación de usuario. F002 se limita a validar; no registra, lista, edita ni elimina frases.
- **FR-002**: El sistema DEBE exigir una entrada `text` de tipo cadena, no vacía después de recortar espacios externos, y rechazar propiedades desconocidas antes de evaluar similitud. La entrada DEBE tener hasta 280 puntos de código Unicode del texto recibido, al menos 3 letras, sin emojis y sin caracteres de control Unicode `Cc`. No se detecta el idioma.
- **FR-003**: El sistema DEBE preservar el texto original y usar una comparación textual que ignore espacios externos, espacios consecutivos y diferencias de mayúsculas y minúsculas, conservando tildes y puntuación.
- **FR-004**: La coincidencia textual normalizada DEBE tener prioridad y exigir confirmación humana, incluso si ninguna frase registrada tiene una representación compatible con el modelo activo. En ese caso DEBE responder 201 siempre que se genere una representación válida del texto nuevo y se conserve la validación; no se comparan vectores almacenados. Si hay varias iguales, se elegirá una sola de forma determinista. No se atribuirá a IA ni se inventará un coseno para esta coincidencia.
- **FR-005**: Sin coincidencia textual, el sistema DEBE seleccionar la única frase de mayor similitud coseno entre las candidatas compatibles. Los empates DEBEN resolverse de forma determinista.
- **FR-006**: El sistema DEBE requerir confirmación cuando el mayor puntaje semántico sea mayor o igual al umbral configurable, inicialmente `0.8538613695045911`. El usuario final no modifica ese umbral desde la interfaz del MVP.
- **FR-007**: Sin frases previas, el sistema DEBE devolver una validación válida sin candidata, sin puntaje inventado y sin necesidad de confirmación por coincidencia.
- **FR-008**: El sistema DEBE distinguir coincidencia textual determinista, candidata semántica y ausencia de candidata. Los puntajes semánticos DEBEN estar entre -1 y 1 y no presentarse como probabilidad de duplicado.
- **FR-009**: Una posible coincidencia DEBE ser un resultado funcional exitoso que requiere decisión humana, nunca un rechazo técnico por la sola similitud. F002 no ejecuta esa decisión ni guarda automáticamente.
- **FR-010**: El sistema NO DEBE comparar representaciones semánticas incompatibles. Si no hay coincidencia textual y existen frases registradas pero ninguna es compatible con el modelo activo, DEBE rechazar la validación como fallo técnico de consistencia; no devolver ausencia de coincidencias.
- **FR-011**: Ante fallos de IA, búsqueda o conservación del resultado, el sistema DEBE responder con un error seguro, sin resultado de ausencia de duplicados ni comprobante utilizable de validación exitosa. No se permite un guardado alternativo sin validación.
- **FR-012**: El sistema DEBE permitir reintento manual, sin reintentos automáticos ni cambio de modelo durante una solicitud. Un fallo o timeout técnico no puede producir una validación exitosa.
- **FR-013**: Los errores DEBEN distinguir entrada inválida y fallo técnico, sin revelar secretos, representaciones semánticas, consultas internas ni detalles de ejecución. DEBEN usar `application/problem+json` con `title`, `status`, `detail`, `code` y opcionalmente `errors: [{field, messages: string[]}]`, sin `timestamp` ni `traceId`. El estado HTTP DEBE coincidir con `status`; se aplica el catálogo público de F002.
- **FR-014**: El sistema NO DEBE devolver representaciones semánticas ni metadatos internos del modelo al cliente.
- **FR-015**: El sistema DEBE ofrecer `POST /api/v1/phrase-validations` con cuerpo JSON que contiene únicamente `text`, obligatorio. Una validación completada DEBE responder 201 con el contrato público descrito abajo.
- **FR-016**: El sistema DEBE conservar una validación temporal exitosa, inicialmente sin consumir, con los datos necesarios para guardar después el mismo texto sin repetir la inferencia. DEBE obtener una representación semántica válida incluso con coincidencia textual o sin frases previas. Validar no crea una frase definitiva.
- **FR-017**: El sistema DEBE devolver como `validationId` el UUID v4 aleatorio de la validación persistida. No se firma ni se emite otro token y no representa identidad de usuario.
- **FR-018**: La vigencia inicial DEBE ser de 15 minutos y configurable; el resultado temporal y `expiresAt` DEBEN tener la misma expiración. Una validación expirada no es aplicable al guardado. F002 no consume comprobantes ni prolonga su vigencia.
- **FR-019**: Cancelar o abandonar el flujo NO DEBE registrar una frase ni un estado adicional de cancelación; la validación temporal puede permanecer físicamente después de expirar y se admite su limpieza manual. F002 no ofrece endpoints de cancelación ni de consulta del historial temporal, ni garantiza evidencia histórica permanente.
- **FR-020**: F002 NO DEBE imponer un límite global por volumen de solicitudes ni generar 429/`RATE_LIMIT_EXCEEDED` por ese motivo.

### Contrato público de F002

Los nombres de campos corresponden al contrato externo aprobado, con las excepciones autorizadas en las decisiones HITL. Son requisitos observables, sin prescribir su implementación.

**Entrada**: `POST /api/v1/phrase-validations`, JSON `{ "text": "Me gusta viajar a Cusco" }`. No requiere autenticación ni token previo. Rechaza propiedades del cuerpo ajenas al contrato (`forbidNonWhitelisted`); los parámetros de consulta no declarados se ignoran.

**Éxito**: 201, JSON `{ "data": { "validationId": "550e8400-e29b-41d4-a716-446655440000", "expiresAt": "2026-10-22T15:15:00.000Z", "requiresConfirmation": false, "match": null } }`. No se agregan otros campos al envoltorio ni al resultado.

| Campo                  | Comportamiento                                                                                                                        |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `validationId`         | UUID v4 aleatorio de la validación persistida.                                                                                        |
| `expiresAt`            | Fecha y hora con zona horaria; coincide con la expiración del resultado temporal.                                                     |
| `requiresConfirmation` | Booleano: verdadero ante igualdad textual o puntaje semántico mayor o igual al umbral; falso en los demás éxitos.                     |
| `match` textual        | `{type: "textual_exact", phrase: {id, text}, similarityScore: null}`; `id` es UUID y `text` es el texto de la frase registrada.       |
| `match` vectorial      | `{type: "vector", phrase: {id, text}, similarityScore: número entre -1 y 1}`; incluye la mejor candidata aunque quede bajo el umbral. |
| `match` sin candidata  | `null`; con colección vacía no se inventa puntaje.                                                                                    |

**Errores**:

| Estado / código              | Condición                                                                                                                                            |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 400 / `VALIDATION_ERROR`     | Entrada inválida o campos ajenos al contrato en el body; detalles por campo cuando corresponda.                                                      |
| 503 / `AI_UNAVAILABLE`       | Servicio de embeddings no disponible, fallo de comunicación o inferencia, respuesta malformada, representación semántica inválida o timeout técnico. |
| 500 / `DATABASE_ERROR` | Fallo de conexión, SQL o restricciones al consultar o conservar la validación.                                                                |
| 500 / `INTERNAL_ERROR`       | Fallo inesperado, colección no vacía sin coincidencia textual ni representaciones compatibles.                                                       |

Ejemplo de rechazo (la traducción global del `ValidationPipe`): `{ "title": "Bad Request", "status": 400, "detail": "Los parámetros de la solicitud no son válidos.", "code": "VALIDATION_ERROR", "errors": [{ "field": "text", "messages": ["text debe contener de 1 a 280 puntos de código Unicode, con al menos 3 letras, sin emojis, controles ni texto vacío."] }] }`. Si el `PhraseText` rechaza el texto en el dominio, `InvalidValidationTextFilter` responde 400 con `detail` «Los datos enviados no son válidos.» y el mensaje «El texto debe contener de 1 a 280 puntos de código Unicode, con al menos 3 letras, sin emojis, controles ni texto vacío.».

F002 no incluye los errores de consumo, expiración o confirmación del guardado: pertenecen a la operación posterior de registro.

### Key Entities

- **Frase candidata**: Texto nuevo cuya admisibilidad y posible coincidencia se evalúan; no constituye una frase registrada por validar.
- **Frase registrada**: Contenido existente de la colección compartida que puede actuar como candidata de coincidencia.
- **Resultado de validación**: Tipo de coincidencia, candidata cuando exista, puntaje cuando corresponda y necesidad de confirmación. Se conserva temporalmente con identidad propia, texto validado, representación semántica y su versión, fechas de creación y expiración y estado de consumo, inicialmente pendiente.
- **Umbral semántico**: Valor configurable que determina cuándo una candidata semántica amerita advertencia; no establece certeza ni prohíbe el guardado decidido por una persona.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: En todos los escenarios de aceptación de igualdad textual, el resultado solicita revisión humana y no crea una frase registrada.
- **SC-002**: En todos los casos controlados por debajo, en y por encima del umbral, la necesidad de confirmación coincide con la regla aprobada; se devuelve como máximo una candidata.
- **SC-003**: Con cero frases previas, todas las validaciones de aceptación con entrada admisible terminan sin candidata ni puntaje inventado y sin registrar la frase.
- **SC-004**: Todos los fallos de aceptación de entrada, IA, búsqueda y conservación del resultado producen un error sin autorización utilizable de guardado ni falso resultado exitoso.
- **SC-005**: La persona recibe el resultado de validación en hasta 5 segundos en condiciones normales. El entorno y la muestra de comprobación deberán documentarse al verificarlo; no se equipara esta meta al timeout técnico pendiente.
- **SC-006**: En todos los casos de aceptación de comprobantes, el resultado conservado y la respuesta tienen la misma expiración; ninguna validación registra una frase, consume un comprobante ni expone representaciones semánticas.
- **SC-007**: Todos los casos de aceptación de 280/281 puntos de código, controles Unicode, entrada vacía, entrada con menos de 3 letras y entrada con emojis respetan las reglas de admisibilidad aprobadas.
- **SC-008**: Una persona evaluadora puede distinguir, en los escenarios de aceptación, una coincidencia textual, una advertencia semántica, una validación sin alerta y un fallo técnico, sin interpretar el puntaje como probabilidad.
- **SC-009**: En todos los escenarios de integración, las representaciones aceptadas contienen exactamente 384 números finitos; la búsqueda utiliza únicamente representaciones compatibles. Los errores propagados por el SDK o por Embedding producen el error previsto sin comprobante utilizable.

## Assumptions

### Ajuste aprobado durante implementación — 2026-10-22

Por instrucción explícita del usuario, usar el adaptador mínimo mostrado en la
sesión: OpenAIEmbeddings directo, maxRetries 0, timeout SDK, URL configurable,
inferencia de inicio y traducción de errores. Sin fetch propio, consulta automática
de /info, estado ready, deadline adicional, aborto propio al cierre ni validaciones
adicionales de respuesta. Embedding conserva dimensión/finitud; el modelo y versión
son los configurados. El perfil TEI 1.9.4 está autorizado. La comprobación operativa
del perfil es manual; la versión del corpus no se verifica automáticamente.
Este ajuste sustituye las exigencias técnicas anteriores que lo contradigan;
las reglas de entrada, selección, persistencia temporal, UUID y contrato HTTP permanecen.
El endpoint compatible exige auto-truncate=false en el despliegue para no truncar.
Véase [contrato TEI actualizado](contracts/embeddings-service.md).

### Alcance y dependencias aprobadas

- F002 pertenece exclusivamente al backend. Botones, estados de carga, presentación de advertencias y conservación del texto en pantalla corresponden al cliente y no se implementan en esta funcionalidad.
- El guardado, la confirmación en el guardado, el consumo del comprobante, el listado y la eliminación pertenecen a otras funcionalidades. Se describen solo como límites o dependencias.
- Se mantiene el modelo multilingüe MiniLM-L12-v2 y sus 384 dimensiones. El servicio existente usa `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`, en lugar del artefacto anterior `Xenova/paraphrase-multilingual-MiniLM-L12-v2`; esta diferencia de artefacto no autoriza seleccionar otro modelo ni asumir equivalencia numérica. Se conserva el umbral inicial `0.8538613695045911`, sin recalibrarlo. La evaluación histórica del flujo obtuvo 12/20 aciertos y ocho falsos negativos entre diez positivos; no certifica el nuevo runtime ni impone una exactitud mínima del 75 % o detección perfecta.
- La disponibilidad del servicio de embeddings, su comunicación con NestJS y las frases registradas son dependencias. El timeout técnico es configurable mediante `AI_INFERENCE_TIMEOUT_MS` y aún no tiene cifra aprobada; abarca la solicitud al servicio y no se equipara a la meta de latencia de SC-005. No se permiten reintentos automáticos, incluidos los del cliente LangChain.
- La inferencia DEBE ejecutarse exclusivamente en el servicio `embeddings` de `../../compose.yaml`, ya disponible según el usuario. La configuración observada usa Hugging Face Text Embeddings Inference (TEI), imagen `ghcr.io/huggingface/text-embeddings-inference:cpu-arm64-1.9.4` (`platform: linux/arm64`), revisión de modelo `e8f8c211226b894fcb81acc59f3b34ba3efd5f42`, pooling `mean` y `dtype=float32`. Se mantiene normalización L2 en la generación efectiva, sin introducir cambios de texto ni fragmentación. La carga, los pesos y su caché pertenecen al contenedor; NestJS NO DEBE cargar, descargar, preparar ni ejecutar el modelo dentro de su proceso, tampoco como fallback.
- El adaptador de infraestructura DEBE consumir el servicio por HTTP mediante un cliente de embeddings de LangChain compatible con TEI. La URL base DEBE ser configurable mediante `AI_EMBEDDINGS_URL`, documentada con el ejemplo seguro `http://127.0.0.1:8080` para NestJS ejecutado en el host. Dentro de la misma red Docker se usa una URL alcanzable desde NestJS, por ejemplo `http://embeddings:80`; `localhost` no identifica otro contenedor. Nota (implementación): la configuración no se valida contra un esquema; si la URL o el timeout faltan, no hay error de configuración explícito (el timeout resulta `NaN` y la URL `undefined/v1`). Solo se comprueba `AI_EMBEDDING_DIMENSIONS=384` y la inferencia de arranque; si el servicio no responde, el proceso termina con `AiUnavailableError`. Nunca se sustituye por inferencia local.
- Se conserva la arquitectura hexagonal y los contratos existentes: `EmbeddingGeneratorPort.generate(text)` entrega `GeneratedEmbedding` con `Embedding` y `PhraseModel`; los puertos de validación, repositorios mantienen su responsabilidad; el puerto de emisión se elimina. LangChain, HTTP y TEI permanecen en infraestructura; dominio y casos de uso no dependen del cliente remoto. Se conserva PostgreSQL/pgvector, dimensión 384, similitud coseno, prioridad textual, Top-1 y filtrado por modelo y versión compatibles.
- La identidad efectiva DEBE reflejar el artefacto y la configuración del servicio, sin reutilizar automáticamente el manifiesto del runtime local. La planificación deberá definir cómo identificar y verificar esa versión y comprobar compatibilidad con los vectores existentes antes de permitir comparaciones. Compartir nombre de modelo o dimensión no constituye esa comprobación. No se añade migración automática ni se modifica el umbral; si se requiere regeneración manual o hay diferencias semánticas, se documentarán antes de activar comparaciones afectadas.
- La implementación posterior DEBE eliminar `LocalMiniLmEmbeddings` y sus pruebas exclusivas del pipeline local, la preparación `scripts/prepare-minilm.mjs` y el comando `model:prepare`, el manifiesto local `minilm-manifest.json` y el cálculo/validación de identidad ligado a él. DEBE retirar la dependencia directa de `@huggingface/transformers` y cualquier otra dependencia exclusiva de la inferencia local que quede sin uso, junto con proveedores, imports, opciones de caché y configuración obsoletos. No se conserva código local inactivo ni una segunda vía de generación.
- Se DEBE adaptar `HuggingFaceEmbeddingAdapter` para conectarse únicamente mediante LangChain al servicio existente, conservando el puerto, la validación del resultado, los metadatos efectivos y la traducción de errores. Su inicialización y cierre dejan de gestionar un modelo local. La composición de `PhrasesModule` (no existe `PhraseValidationConfig`: el umbral y el TTL se leen en `ValidatePhraseUseCase` con valores por defecto), `.env.example`, las dependencias y su lockfile, la documentación operativa y las pruebas DEBEN reflejar esa única integración. Se conserva la configuración que siga siendo necesaria para timeout, modelo/versión efectivos, dimensiones, umbral y comprobantes. Estos cambios se completaron durante implementación conforme al ajuste explícito del adaptador mínimo.
- La verificación posterior DEBE cubrir el cliente remoto y sus fallos con dobles de prueba, los escenarios HTTP existentes y una integración real LangChain → servicio Docker → pgvector. Debe comprobar ausencia de carga del modelo en NestJS, cambio de URL por entorno, identidad y compatibilidad vectorial, y latencia del flujo completo con las 3 solicitudes ya acordadas. No se declara preparada la validación hasta comprobar disponibilidad del servicio y un vector válido, sin cargar pesos en NestJS.
- No se añaden autenticación, detección de idioma, moderación, múltiples modelos, mejoras semánticas ni historial permanente nuevo.
- Por decisión HITL Q2-A se requieren pruebas unitarias y HTTP de F002, conforme a la constitución. Esta especificación define escenarios; no crea suites ni ejecuta pruebas de aplicación.

### Fuentes consultadas y trazabilidad

Las rutas de documentación siguientes son relativas a la raíz del repositorio; no se modifican las fuentes.

| Fuente                                                                  | Aplicación a F002                                                                                                                 |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `apps/backend/AGENTS.md`                                                | Límites de trabajo, contratos y verificación de comportamiento.                                                                   |
| `apps/backend/.specify/memory/constitution.md`                          | Contratos explícitos, comportamiento comprobable y gobierno.                                                                      |
| `compose.yaml`                                                          | Servicio `embeddings` existente: TEI, modelo/revisión, pooling, precisión y publicación local en el puerto 8080.                  |
| `apps/backend/src/modules/phrases/` y configuración local de embeddings | Contraste con implementación: carga local actual, contratos hexagonales y filtros de compatibilidad de pgvector que se conservan. |
| `docs/00-discovery/product-brief.md`                                    | FR-001 a FR-015, BR-001 a BR-015, AFR-001 a AFR-009, NFR-002, AC-001 a AC-009 y AC-014 a AC-017.                                  |
| `docs/01-ai-feasibility/model-evaluation.md`                            | Ruta solicitada inexistente; no se atribuye contenido a este archivo.                                                             |
| `docs/01-ai-feasibility/model-decision.md`                              | Fuente alternativa aceptada mediante Q1; citada por el propio brief.                                                              |
| `docs/03-architecture/02-backend-architecture.md`                       | Validación separada del registro, comprobante temporal y límites de concurrencia.                                                 |
| `docs/03-architecture/04-ai-architecture.md`                            | Similitud coseno, umbral, compatibilidad, fallo seguro y limitaciones observadas.                                                 |
| `docs/03-architecture/05-data-architecture.md`                          | Prioridad textual, candidata única, validación temporal y vigencia inicial de 15 minutos.                                         |
| `docs/03-architecture/06-api-security.md`                               | Resultado público discriminado, validación de entrada, token temporal y catálogo de errores.                                      |
| `docs/03-architecture/openapi.yaml`                                     | Contrato externo de `POST /api/v1/phrase-validations`; con las excepciones explícitas autorizadas mediante Q1 y Q2.               |

La especificación local de F001 se consultó únicamente para detectar incompatibilidades; no sustituye sin autorización las fuentes solicitadas.

### Decisiones HITL — 2026-10-22

- **Q1 resuelta**: el usuario indicó «haz caso a la arquitectura, la entrada que sea de 280 caracteres». Se adopta `model-decision.md` como fuente alternativa y la arquitectura para el comportamiento de F002, con límite máximo de 280 conservando el cómputo arquitectónico en puntos de código Unicode. Se mantienen la conservación temporal de validaciones, el puntaje textual nulo, la devolución de candidata bajo umbral y la ausencia de garantía histórica permanente.
- **Q2-A aprobada**: sin límite global ni 429 por volumen; errores por campo mediante `messages[]`; fallos de datos como 500/`DATABASE_ERROR` y fallos inesperados como 500; pruebas unitarias y HTTP según la constitución.
- **Q3-A aprobada, precisada en Clarifications**: una colección no vacía sin coincidencia textual ni representaciones compatibles causa fallo técnico controlado, sin comprobante utilizable y sin comunicar ausencia de coincidencias. Se usa 500/`INTERNAL_ERROR` sin añadir un código de error nuevo.
- **Cambio de ejecución solicitado**: el modelo deja el proceso de NestJS y se reutiliza el servicio Docker existente mediante LangChain y URL por entorno. Esta instrucción sustituye la carga local, caché y ciclo de vida del modelo dentro de NestJS descritos en el bloque 04 y en los artefactos técnicos actuales; conserva los demás requisitos y los puertos existentes.

### Compatibilidad y límites documentales

Para F002, las decisiones anteriores prevalecen sobre las fuentes discrepantes. Frente a OpenAPI y al bloque 06, se reduce el máximo de entrada de 500 a 280 puntos de código, se elimina la respuesta 429 por volumen y se sustituye `errors[].message` por `errors[].messages`. Q3 precisa el caso de incompatibilidad sin modificar las variantes de éxito. Los fallos de BD de F001, F002 y F003 se unifican en 500/`DATABASE_ERROR`; IA conserva 503/`AI_UNAVAILABLE`.

Estas diferencias se documentaron antes de implementar. El contrato compartido ya estaba alineado en el baseline. La regla de texto es única en toda capa; no existe excepción de lectura de hasta 500 puntos de código.

El cambio al servicio Docker no altera rutas, entrada, respuestas, errores públicos, comprobantes, vigencia, umbral ni reglas de pgvector. Los artefactos técnicos y el código se alinearon durante implementación con OpenAIEmbeddings y el adaptador mínimo aprobado, sin pipeline local.

Las decisiones no incorporan guardado ni auditoría permanente a F002, ni autorizan una mejora de calidad semántica. El timeout sigue siendo configurable sin default aprobado; perfil, identidad y entorno de medición comprobados se registran en quickstart.md.


## Unificación de errores de BD — 2026-10-22

Esta revisión sustituye la clasificación anterior de disponibilidad de BD: todo fallo de conexión, SQL o restricciones en consultas, inserciones o actualizaciones devuelve 500/`DATABASE_ERROR` con el mensaje «Ocurrió un error de base de datos.». El backend conserva la causa y la registra con el stack una sola vez; la respuesta no expone SQL, trazas ni datos internos. Los errores de dominio, aplicación y mapeo conservan su tratamiento; IA conserva 503/`AI_UNAVAILABLE`. Cambio incompatible para clientes que esperaban 503/`DATABASE_UNAVAILABLE`.
