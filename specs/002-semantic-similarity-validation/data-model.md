# Phase 1 Data Model — F002

Rutas de código relativas a `apps/backend/`. Esquema de referencia: `../../docs/03-architecture/05-data-architecture.md`; contrato local: [contracts/phrase-validations.openapi.yaml](contracts/phrase-validations.openapi.yaml).

## Entrada y reglas de texto

`ValidatePhraseInput` contiene solo `text: string`. La nueva fábrica de dominio `PhraseText.forValidation` exige:

- De 1 a 280 puntos de código Unicode del original (`[...text].length`); espacios externos cuentan.
- `trim()` no vacío; sin caracteres de categoría Unicode `Cc`, incluidos TAB, LF y CR.
- Se admiten puntuación y emojis sin letras; no se detecta idioma.
- Conservación exacta del original; comparación con `trim().toLowerCase().replace(/\s+/g, ' ')`, misma regla existente de ECMAScript. No quitar acentos/puntuación ni aplicar NFC adicional.

El constructor existente de `PhraseText` mantiene hasta 500 para reconstrucción de frases F001; la nueva fábrica restringe solo admisibilidad de F002. El DTO HTTP valida tipo y usa la misma regla. No usar un decorador de longitud UTF-16 ni `trim` transformador que cambie el payload.

## Entidades y objetos de valor

### Phrase existente

Se reutilizan identidad UUID, texto original, texto normalizado, embedding, `PhraseModel` y fecha. No se cambia la tabla `phrases`, su constructor para datos históricos ni el contrato de listado. Nuevas consultas de coincidencia retornan proyecciones tipadas, sin cargar todos los embeddings ni reconstruir la entidad completa.

### Embedding y PhraseModel

Reusar VOs existentes. `Embedding` protege copia defensiva, dimensión 384 y finitud. El adaptador mínimo aprobado reutiliza Embedding sin validación adicional de vector nulo/norma; el endpoint compatible TEI normaliza y persistencia no renormaliza. `PhraseModel` conserva modelo y versión; igualdad de ambos y dimensión fija determina compatibilidad de búsqueda. El modelo activo será `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`; versión `tei-<sha256>` del descriptor de servicio definido en [contracts/embeddings-service.md](contracts/embeddings-service.md). Los vectores Xenova previos conservan sus etiquetas y quedan excluidos de las comparaciones TEI. No asumir equivalencia por dimensión ni regenerar datos automáticamente.

### SimilarityScore nuevo

Valor finito en [-1, 1]; no porcentaje ni probabilidad. Comparación sin redondeo; score exactamente igual al umbral requiere confirmación. El adaptador puede corregir únicamente error numérico de hasta `1e-6` fuera del intervalo, nunca un resultado corrupto mayor. No usar score para igualdad textual.

### PhraseValidation — agregado temporal nuevo

| Campo dominio        | Tipo / reglas                                        | Persistencia                                                            |
| -------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------- |
| id                   | UUID v4 generado por aplicación                      | `id UUID PRIMARY KEY NOT NULL`                                          |
| text                 | PhraseText creado por fábrica F002; original íntegro | `text TEXT NOT NULL`                                                    |
| normalizedText       | NormalizedPhraseText de la regla común               | `normalized_text TEXT NOT NULL`                                         |
| embedding            | Embedding válido para modelo activo                  | `embedding VECTOR(384) NOT NULL`                                        |
| model                | PhraseModel con identidad efectiva                   | `model_id VARCHAR(255) NOT NULL`, `model_version VARCHAR(150) NOT NULL` |
| match                | Unión textual/vectorial/nula                         | `matched_phrase_id UUID NULL`, `similarity_score DOUBLE PRECISION NULL` |
| requiresConfirmation | boolean coherente con resultado                      | `requires_confirmation BOOLEAN NOT NULL`                                |
| createdAt            | Fecha válida, precisión de segundos                  | `created_at TIMESTAMPTZ NOT NULL`                                       |
| expiresAt            | createdAt + TTL (la entidad no valida el orden)      | `expires_at TIMESTAMPTZ NOT NULL`                                       |
| consumedAt           | null al crear; consumo fuera de F002                 | `consumed_at TIMESTAMPTZ NULL`                                          |

Copiar defensivamente fechas, vectores y estructuras mutables al construir y exponer datos. No agregar clase base de agregado, VO por cada campo, `status`, `match_type`, JSON libre ni persistencia histórica nueva.

## Resultados y coherencia

Resultados funcionales de `findValidationMatch`, preservando el contrato actual `Promise<ValidationMatch | null>`:

| Variante        | Campos                              | Significado                                                                                                      |
| --------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `textual_exact` | phrase `{id,text}`, score nulo      | Igualdad normalizada, independiente de versión del embedding existente                                           |
| `vector`        | phrase `{id,text}`, SimilarityScore | Top-1 compatible, aunque score sea negativo o inferior al umbral                                                 |
| `empty`         | sin candidata                       | No hay ninguna fila en `phrases` en la consulta de existencia; se devuelve null                                  |
| `incompatible`  | sin candidata pública               | Existen frases, ninguna coincidencia textual ni vector compatible; lanza IncompatiblePhraseCollectionError (500) |

Texto: ordenar por fecha DESC y UUID DESC. Vector: distancia coseno ASC y UUID ASC. Conservar consultas parametrizadas secuenciales actuales: igualdad textual, vector compatible solo sin igualdad, existencia global solo sin candidata. No comparten snapshot; no se garantiza consistencia del corpus entre lecturas. No introducir CTE ni transacción larga por externalizar inferencia.

Al crear el agregado:

| Resultado            | matched_phrase_id | similarity_score | requires_confirmation |
| -------------------- | ----------------- | ---------------- | --------------------- |
| Textual              | UUID              | NULL             | true                  |
| Vectorial con alerta | UUID              | score >= umbral  | true                  |
| Vectorial sin alerta | UUID              | score < umbral   | false                 |
| Colección vacía      | NULL              | NULL             | false                 |

Nunca permitir score sin candidata. No fabricar 1 para coincidencia textual. El umbral se suministra a la creación del resultado desde la configuración tipada; no se persiste una nueva columna para él. La validación conserva la decisión calculada, sin reevaluarla por un cambio posterior de ENV. `incompatible` no construye agregado persistible ni token.

La frase coincidente y su texto en la respuesta provienen de la proyección de búsqueda. El esquema aprobado conserva su UUID, no snapshot permanente de su texto. Puede quedar una referencia no resoluble si se elimina la candidata en otra funcionalidad; no añadir FK, cascadas ni garantía de auditoría.

## Ciclo de vida

1. Se crea una validación `consumedAt=null` al completar inferencia y búsqueda válidas.
2. Vigente si `now < expiresAt`; expirada si `now >= expiresAt`. Método puro `isExpired(now)` sin dependencia de reloj de infraestructura.
3. F002 no consume ni renueva. Validar otra vez genera otro UUID y no invalida ni prorroga la anterior.
4. Cancelar/abandonar no realiza escritura adicional. La fila puede permanecer después de expirar.
5. Consumo e inserción en `phrases` se dejan para la funcionalidad de registro (F003, dos escrituras secuenciales sin transacción).
6. Limpieza manual; sin scheduler, worker ni borrado oportunista durante solicitudes.

## Persistencia y migración

Tabla `phrase_validations` ya definida por F002, sin FK hacia `phrases` ni unicidad sobre texto. PK es suficiente inicialmente; índice por expiración solo si se justifica con volumen. No agregar índices ANN ni `CHECK` semánticos nuevos. Mapear fechas y vector explícitamente en `DrizzlePhraseValidationMapper`, sin exponer tipos inferidos ORM a aplicación.

Verificar que `drizzle.config.ts` descubre ambos modelos en los subdirectorios actuales `drizzle/phrase/` y `drizzle/phrase-validation/`; el glob plano actual no los descubre. La migración aditiva de F002 ya existe y habilita pgvector mediante su historial; revisar que extensión preceda `VECTOR(384)`. La transición a TEI no necesita nueva migración de esquema. No volver a generar tablas existentes, truncar datos, reetiquetar embeddings o aplicar migraciones en bootstrap.

`DrizzlePhraseValidationRepository.save` retorna solo cuando termina el INSERT.
Un fallo de persistencia impide devolver una referencia exitosa.

## Referencia y coherencia temporal

`validationId` es el UUID v4 existente de la fila. No se añade otro token.
Calcular una vez la fecha a segundos: `createdAt=floor(now/1000)*1000` y
`expiresAt=createdAt+TTL*60*1000`. TTL entero positivo inicialmente 15.
La respuesta usa la misma expiración persistida. Expira cuando `now >= expiresAt`.
No se implementa registro ni consulta de validaciones en F002.

## Configuración

| Variable                        | Política / ejemplo seguro                                                                                              |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`, `PORT`          | Conservar configuración existente                                                                                      |
| `AI_EMBEDDINGS_URL`             | Sin validación de formato; host `http://127.0.0.1:8080`, red Docker `http://embeddings:80` |
| `AI_MODEL`                      | `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`, perfil fijo                                             |
| `AI_EMBEDDING_VERSION`          | `tei-<sha256>` del descriptor contrastado manualmente por el operador (`getOrThrow` en el registro; sin validar formato) |
| `AI_EMBEDDING_DIMENSIONS`       | `384`; otra dimensión aborta el arranque                                                                               |
| `AI_SIMILARITY_THRESHOLD`       | Default `0.8538613695045911` (sin validar rango)                                                                       |
| `AI_INFERENCE_TIMEOUT_MS`       | Sin default ni validación (ausente → `NaN`); `5000` es ejemplo operativo                                               |
| `PHRASE_VALIDATION_TTL_MINUTES` | Default `15` (sin validar)                                                                                             |

Retirar `AI_MODEL_CACHE_DIR`, su variante usada actualmente `AI_EMBEDDING_CACHE_DIR` y cualquier opción exclusiva del runtime local. Revisión, pooling mean y dtype float32 se contrastan manualmente con `/info`; el endpoint compatible normaliza y el despliegue fija auto-truncate=false. Configuración efectiva sin prompts predeterminados; dimensión y norma se comprueban en integración. El descriptor pertenece al contrato del servicio, sin manifiesto de archivos de pesos ni preparación desde NestJS.

Nota (implementación): no existe un módulo de configuración tipada; `ConfigurationPort` expone `get`/`getOrThrow` y las comprobaciones son puntuales. Configurar mediante `ConfigurationPort` antes de escuchar, sin lectura de ENV en dominio/casos de uso ni nueva biblioteca. Una dimensión distinta de 384 o un error de la inferencia inicial impiden inicialización exitosa. El perfil remoto se contrasta manualmente, sin guardas automáticas del adaptador. No añadir ENV de throttle, caché, fallback o selección de modelos alternativos.
