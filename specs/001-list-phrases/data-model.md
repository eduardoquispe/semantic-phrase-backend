# Modelo de datos: F001 — Listado de frases

## Frase registrada (`phrases`)

F001 consulta frases registradas; no las crea ni modifica. El esquema físico sigue `docs/03-architecture/05-data-architecture.md` de la raíz del repositorio.

| Columna | Tipo PostgreSQL | Restricción | Uso en F001 |
| --- | --- | --- | --- |
| `id` | `uuid` | Clave primaria no nula; identidad UUID v4 | `id` público y desempate descendente |
| `text` | `text` | No nulo | `text` público |
| `normalized_text` | `text` | No nulo; índice B-tree no único | No se selecciona |
| `embedding` | `vector(384)` | No nulo; requiere pgvector | No se selecciona |
| `model_id` | `varchar(255)` | No nulo | No se selecciona |
| `model_version` | `varchar(150)` | No nulo | No se selecciona |
| `created_at` | `timestamptz` | No nulo | `createdAt` público y orden principal |
| `status` | `smallint` | No nulo, default 1; `CHECK (status IN (1, 2))` (añadida por F004) | Filtro `status = 1` (activas) |
| `deleted_at` | `timestamptz` | Nulo; fecha del soft delete (F004) | No se selecciona |

La migración habilita `vector` antes de crear la tabla. `phrase_validations` es otro agregado previsto para funcionalidades posteriores, sin relación ni transición de estado en F001. Nota (implementación): el repositorio ejecuta `select()` de todas las columnas (incluido `embedding`, que el mapper convierte con `JSON.parse`) y reconstruye el agregado `Phrase`; solo la respuesta HTTP se limita a `id`, `text` y `createdAt`. No consulta validaciones. No hay columna de propietario: la lista es compartida.

Nota (implementación): no existe `PhraseListItem`; el puerto devuelve entidades `Phrase` y un total (`PhrasePageRows`), y `PhrasesMapper` (capa HTTP) los convierte a la respuesta pública con la fecha en ISO 8601 (`….000Z`). El esquema de Drizzle representa únicamente la tabla de almacenamiento y no se expone a la aplicación.

## Página de frases

Es un valor de respuesta de aplicación, no una tabla ni un agregado. Contiene `data` y `meta.page`, `meta.limit`, `meta.total`, `meta.totalPages`. `page` empieza en 1; `limit` va de 1 a 100; `total` cuenta las frases activas (`status = 1`). `totalPages` es `ceil(total/limit)` y vale cero cuando `total=0`. Una página válida posterior a la última tiene `data` vacío y conserva los metadatos.

Las filas se ordenan por `created_at DESC, id DESC`. El conteo y las filas son dos consultas secuenciales sin transacción común; no comparten necesariamente una misma vista de lectura. Las inserciones pueden desplazar filas entre solicitudes distintas; no existe un estado inmutable del listado.

## Validación y estado

El límite HTTP comprueba sintaxis y rango de la paginación. F001 no recibe texto de frase en el cuerpo ni produce transiciones de estado. Los errores de persistencia se propagan como fallos controlados, nunca como página vacía.

La consulta F001 no reconstruye el agregado ni ejecuta transiciones de negocio. El módulo incorpora el dominio completo descrito a continuación, independiente de la proyección de lectura. La indisponibilidad de PostgreSQL sigue siendo un error técnico en `shared/infrastructure/database/errors/`, sin dependencias desde aplicación hacia infraestructura.

## Dominio de la frase registrada

`domain/entities/phrase.entity.ts` define `Phrase` y su entrada `PhraseProps`: identidad UUID v4, `PhraseText`, `normalizedText`, `Embedding`, `modelId`, `modelVersion` y `createdAt`. La identidad y una fecha válida se reciben explícitamente; el dominio no genera UUID, consulta el reloj ni ejecuta inferencia. Los metadatos del modelo deben ser cadenas no vacías tras `trim`, conservando su valor original. El estado es inmutable y la fecha se devuelve mediante copias defensivas.

`PhraseText` conserva el texto original y exige entre 1 y 500 puntos de código Unicode, contando espacios antes de normalizar, con contenido no vacío tras `trim`. Rechaza todos los caracteres de control Unicode de categoría `Cc`, incluidas tabulación, LF y CR. Su propiedad `normalized` aplica `trim()`, `toLowerCase()` y compresión de secuencias reconocidas por `\s` a un espacio ASCII, manteniendo tildes y puntuación. `Phrase.normalizedText` es un atributo independiente, obligatorio y no vacío tras `trim`, recibido explícitamente y conservado sin recalcular ni modificar. Esto permite reconstruir la entidad con el valor persistido, incluso si corresponde a reglas anteriores. Para nuevas frases, la aplicación podrá usar `PhraseText.normalized` al construir la entidad; la migración de valores existentes será explícita.

Nota (implementación): `domain/factory/phrase.factory.ts` no existe (decisión T043); `Phrase` se construye con su constructor público. Texto original del diseño: `domain/factory/phrase.factory.ts` ofrecería dos caminos explícitos desde primitivos: `PhraseFactory.create` calcula `normalizedText` a partir de `PhraseText.normalized`, mientras que `PhraseFactory.reconstitute` exige el valor almacenado y lo conserva, incluso si corresponde a reglas anteriores. Ambos validan todas las invariantes mediante los value objects y la entidad. Reciben UUID y fecha explícitos, sin consultar reloj, generar identidad ni emitir eventos. El constructor de `Phrase` se conserva por compatibilidad; la fábrica es la entrada recomendada para construir desde primitivos. Esto no incorpora una operación de registro ni cambia la consulta F001.

`PhraseId` encapsula la validación UUID v4 y conserva el valor original de forma inmutable. `PhraseProps.id` exige un `PhraseId`; la entidad almacena el value object internamente y expone `phrase.id` como string. La fábrica construye el value object desde el identificador recibido. Las infracciones de identidad siguen produciendo `InvalidPhraseError`. La entidad confía en los tipos `PhraseId`, `PhraseText` y `Embedding`, sin repetir comprobaciones `instanceof` ni convertir primitivos. Solo valida los metadatos obligatorios y la fecha en el constructor, conservando la inmutabilidad y las copias defensivas de fecha.

`Embedding` acepta arrays mutables o de solo lectura y conserva una copia inmutable de exactamente 384 números finitos. No modifica ni normaliza componentes; la comprobación de norma L2 corresponde al generador conforme al contrato arquitectónico. No depende de la representación `vector(384)` ni de Drizzle.

Las invariantes producen `InvalidPhraseError`, `InvalidPhraseTextError` o `InvalidEmbeddingError`, derivados de una base local `DomainError`. Sus mensajes no contienen estados HTTP, datos de proveedores ni el texto o vector rechazados.

Esta incorporación no modifica `PhraseListItem`, los puertos, el caso de uso, los adaptadores ni el contrato HTTP. Tampoco introduce `PhraseValidation`, generación de embeddings ni operaciones de registro.

## Ajustes aprobados — 2026-10-22

Se conserva el agregado completo en el flujo de lectura con los mappers existentes; la proyección `PhraseListItem` y `PhraseFactory` quedan fuera de esta revisión. `Phrase` se construye mediante su constructor público. Sus campos primitivos públicos se conservan mediante getters; internamente compone `NormalizedPhraseText`, `PhraseModel` y `PhraseCreatedAt`. Estos value objects validan solamente strings no vacíos tras trim (conservando el original) y fecha Date válida, con copia defensiva. No imponen formato de modelo, semver ni límites temporales. Las infracciones usan `InvalidPhraseError`. Las decisiones de revisión de `spec.md` prevalecen sobre las descripciones anteriores.
