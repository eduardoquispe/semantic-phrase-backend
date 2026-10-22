# Especificación de funcionalidad: F001 — Listado de frases registradas

**Rama de trabajo**: `feat/phrases-list`

**Creado**: 2026-10-21

**Estado**: Borrador listo para planificación

**Entrada**: «Implementaremos la funcionalidad F001 — Listado de frases registradas del backend NestJS», conforme a los documentos aprobados de producto, arquitectura de backend, datos, seguridad y contrato externo.

## Escenarios de usuario y pruebas *(obligatorio)*

### Historia de usuario 1 — Consultar las frases registradas (Prioridad: P1)

Como persona que usa la aplicación compartida, quiero consultar las frases guardadas con las más recientes primero para conocer el contenido disponible.

**Motivo de la prioridad**: Es el valor principal de F001 y permite mostrar el estado actual incluso antes de incorporar el registro de nuevas frases.

**Prueba independiente**: Con un conjunto conocido de frases, solicitar el listado y comprobar contenido, orden y cantidad; repetir con un conjunto vacío.

**Escenarios de aceptación**:

1. **Dado** un conjunto de frases registradas, **cuando** se consulta la primera página sin parámetros, **entonces** se devuelven como máximo 20 frases, ordenadas por fecha de creación descendente y, en caso de empate, por identificador descendente.
2. **Dada** una frase registrada, **cuando** aparece en el listado, **entonces** se muestran únicamente su identificador, texto y fecha de creación; no se divulgan representaciones semánticas ni datos de validaciones.
3. **Dado** que no hay frases registradas, **cuando** se consulta el listado, **entonces** se obtiene una lista vacía y los metadatos `page=1`, `limit=20`, `total=0` y `totalPages=0`.

---

### Historia de usuario 2 — Recorrer un listado extenso (Prioridad: P2)

Como persona que consulta la lista, quiero pedir páginas de tamaño controlado para recorrer las frases sin recibirlas todas en una sola respuesta.

**Motivo de la prioridad**: Hace utilizable el listado cuando supera el tamaño inicial y mantiene consistente su navegación.

**Prueba independiente**: Con más de 20 frases conocidas, consultar dos páginas y comprobar tamaño, orden, contenido y metadatos de ambas.

**Escenarios de aceptación**:

1. **Dadas** 45 frases, **cuando** se consultan las páginas 1, 2 y 3 con el tamaño predeterminado, **entonces** contienen 20, 20 y 5 frases, respectivamente, con `total=45` y `totalPages=3`.
2. **Dado** un tamaño solicitado entre 1 y 100, **cuando** se consulta cualquier página válida, **entonces** la respuesta refleja la página y tamaño solicitados, el total de frases registradas y `totalPages=ceil(total/limit)`.
3. **Dado** un número de página superior al total de páginas disponibles, **cuando** se consulta, **entonces** se devuelve una lista vacía y se conservan la página solicitada y los metadatos correctos del conjunto.

---

### Historia de usuario 3 — Reconocer solicitudes no válidas y fallos (Prioridad: P3)

Como cliente de la lista, quiero recibir un error claro cuando los parámetros son inválidos o el servicio no puede consultar las frases, para poder corregir la solicitud o informar el problema.

**Motivo de la prioridad**: Evita resultados ambiguos y permite distinguir un listado vacío de un fallo.

**Prueba independiente**: Solicitar parámetros fuera de rango o ajenos al contrato y simular indisponibilidad del origen de datos; verificar las respuestas de error.

**Escenarios de aceptación**:

1. **Dado** `page=0`, `limit=101`, un valor no entero o un parámetro desconocido, **cuando** se consulta la lista, **entonces** se rechaza la solicitud con estado 400 y un error de validación legible.
2. **Dado** que el origen de datos no está disponible, **cuando** se consulta la lista, **entonces** se informa estado 500 con `DATABASE_ERROR`, sin presentarlo como lista vacía.
3. **Dado** que ocurre un fallo interno inesperado, **cuando** se consulta la lista, **entonces** se informa estado 500, sin exponer información sensible.

### Casos límite

- Dos frases con la misma fecha de creación se ordenan por identificador descendente para dar un orden determinista.
- Una página posterior a la última es válida y devuelve `data=[]`; `totalPages` es cero solo cuando no hay frases.
- Los valores `page` y `limit` se aceptan solo como enteros decimales en sus rangos; fracciones, texto, cero y valores negativos son inválidos. Los parámetros desconocidos se rechazan.
- La paginación entre solicitudes no promete una vista inmutable: si se agregan frases mientras se recorren páginas, sus posiciones pueden cambiar.
- La lista compartida es accesible sin cuenta de usuario; no se filtra por propietario.

## Requisitos *(obligatorio)*

### Requisitos funcionales

- **FR-001**: El sistema DEBE ofrecer la consulta del listado compartido de frases registradas mediante `GET /api/v1/phrases`, sin requerir autenticación de usuario.
- **FR-002**: El sistema DEBE devolver estado 200 y un objeto con `data` (lista de frases) y `meta` (`page`, `limit`, `total`, `totalPages`) en consultas válidas, incluso si la lista está vacía.
- **FR-003**: Cada frase de `data` DEBE contener `id` (identificador UUID), `text` y `createdAt` (fecha y hora con zona horaria). No DEBE incluir representaciones semánticas, texto normalizado, datos del modelo ni validaciones temporales.
- **FR-004**: El sistema DEBE ordenar por fecha de creación descendente y usar identificador descendente para desempatar. No habrá orden configurable en F001.
- **FR-005**: El sistema DEBE admitir `page` como entero desde 1, con valor predeterminado 1, y `limit` como entero entre 1 y 100, con valor predeterminado 20.
- **FR-006**: El sistema DEBE devolver como máximo `limit` frases correspondientes a la página solicitada; `total` DEBE representar todas las frases registradas y `totalPages` DEBE ser `ceil(total/limit)`, o 0 cuando `total=0`.
- **FR-007**: El sistema DEBE rechazar con estado 400 los parámetros inválidos o ajenos al contrato, sin convertir silenciosamente valores no enteros a enteros válidos.
- **FR-008**: Los errores de F001 DEBEN usar una respuesta `application/problem+json` con `title`, `status`, `detail` y `code`, y `errors: [{field, messages: string[]}]` opcional para fallos de validación, sin `timestamp` ni `traceId`. Los estados y códigos aplicables son 400/`VALIDATION_ERROR`, 500/`INTERNAL_ERROR`, 500/`INVALID_EMBEDDING` y 500/`DATABASE_ERROR`. El error de embedding conserva su mensaje público mediante un filtro específico del controlador; los errores inesperados usan un mensaje genérico.
- **FR-009**: Ante una consulta fallida, el sistema DEBE informar el error sin devolver un resultado exitoso vacío ni revelar datos internos o secretos.
- **FR-010**: F001 solo consulta frases registradas. No incluye registrar, validar, editar, eliminar, buscar, filtrar ni cambiar el orden.

### Entidades clave

- **Frase registrada**: Contenido persistido e identificable, con texto y fecha de creación. Su información de validación o representación semántica no forma parte del listado público.
- **Página de frases**: Subconjunto ordenado de frases, identificado por número y tamaño de página; informa el total de frases y de páginas para permitir recorrer la colección.

### Refinamiento del modelo de dominio

El módulo incorpora `Phrase` como entidad completa con identidad UUID v4, texto original, texto normalizado recibido explícitamente, embedding de 384 componentes finitos, identificador y versión de modelo y fecha de creación. `PhraseText` protege la admisibilidad del texto (1–500 puntos de código Unicode, no vacío tras trim y sin caracteres de control Unicode `Cc`, incluidas tabulación, LF y CR). `Embedding` encapsula el vector sin normalizarlo. Las invariantes se expresan mediante errores de dominio sin dependencias tecnológicas.

La construcción desde primitivos se concentra en `PhraseFactory`: `create` deriva el texto normalizado del original; `reconstitute` exige y conserva el valor persistido sin recalcularlo. Ambos caminos reciben identidad y fecha explícitas y protegen las mismas invariantes, sin eventos ni efectos externos.

La identidad se encapsula en el value object inmutable `PhraseId`, responsable de validar UUID v4. La entidad conserva el acceso público `phrase.id` como string.

Este trabajo se limita a dominio y sus pruebas; no modifica el contrato público de F001 ni la proyección `PhraseListItem`, y no implementa registro ni validación semántica.

## Criterios de éxito *(obligatorio)*

### Resultados medibles

- **SC-001**: En el 100 % de las consultas de aceptación con 0, 1, 20, 21 y 45 frases conocidas, la lista y los cuatro metadatos coinciden con el conjunto esperado.
- **SC-002**: En el 100 % de los casos de aceptación con fechas iguales, el orden de las frases es determinista; ninguna frase devuelve información adicional a identificador, texto y fecha.
- **SC-003**: El 100 % de las solicitudes de aceptación con página o tamaño inválidos recibe un error de validación; una página válida fuera del rango devuelve una lista vacía con el total correcto.
- **SC-004**: Una persona evaluadora puede identificar la frase más reciente y avanzar a la siguiente página mediante las respuestas del listado en menos de 1 minuto, con un conjunto de 45 frases de prueba.

## Supuestos y dependencias

- La fuente de frases registradas existe y está disponible; crear frases corresponde a otra funcionalidad. Una instalación nueva puede empezar con cero frases. Los datos de ejemplo son opcionales y se cargan por separado.
- La lista es compartida y no existe identidad de usuario ni propiedad individual en el MVP.
- El contrato externo aprobado en `docs/03-architecture/openapi.yaml` prevalece para el formato de la consulta y sus errores. Los documentos de arquitectura de datos y seguridad fijan el orden y los límites de paginación.
- La eliminación mencionada en el brief de producto queda fuera de F001 y no está publicada en el contrato externo actual. Cualquier incorporación requiere especificación y revisión del contrato por separado.

## Cambio de compatibilidad

Por decisión del usuario se elimina el límite global de solicitudes. La API deja de generar 429/`RATE_LIMIT_EXCEEDED` por volumen de peticiones; el contrato local se actualiza a errores 400 y 500.

## Decisiones de revisión — 2026-10-22

Estas decisiones del usuario prevalecen sobre las indicaciones anteriores para esta revisión:

- Mantener el agregado completo y los mappers existentes para el listado; no incorporar `PhraseListItem` ni `PhraseFactory` ahora.
- Proteger texto normalizado, modelo y fecha mediante value objects básicos: `NormalizedPhraseText` exige string no vacío tras trim; `PhraseModel` exige id y versión no vacíos tras trim; `PhraseCreatedAt` exige Date válido y protege la fecha con copias defensivas. Se conservan las cadenas originales sin imponer formatos ni rangos temporales.
- Conservar la validación numérica actual de paginación y `Embedding(number[])`; posponer el endurecimiento léxico y la firma readonly.
- Conservar los errores originales PostgreSQL como 500/`DATABASE_ERROR` con causa conservada y registro seguro en el backend.
- Usar únicamente los tres errores concretos `InvalidPhraseError`, `InvalidPhraseTextError` e `InvalidEmbeddingError` y sus respectivos filtros HTTP en infraestructura: 500 con códigos `INVALID_PHRASE`, `INVALID_PHRASE_TEXT` e `INVALID_EMBEDDING` y mensajes públicos seguros.
- Agregar pruebas nuevas solo de casos de uso y corregir las existentes, sin crear suites de DTO ni de value objects.


## Unificación de errores de BD — 2026-10-22

Esta revisión sustituye la clasificación anterior de disponibilidad de BD: todo fallo de conexión, SQL o restricciones en consultas, inserciones o actualizaciones devuelve 500/`DATABASE_ERROR` con el mensaje «Ocurrió un error de base de datos.». El backend conserva la causa y la registra con el stack una sola vez; la respuesta no expone SQL, trazas ni datos internos. Los errores de dominio, aplicación y mapeo conservan su tratamiento; IA conserva 503/`AI_UNAVAILABLE`. Cambio incompatible para clientes que esperaban 503/`DATABASE_UNAVAILABLE`.
