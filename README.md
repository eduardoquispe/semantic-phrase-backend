# Semantic Phrase API

API REST (NestJS 11 + TypeScript) de una lista de frases con **validación semántica previa al guardado**: antes de registrar una frase, el backend compara su significado con las frases existentes usando un modelo de Hugging Face y, si hay un posible duplicado, exige confirmación humana (_human-in-the-loop_).

Este README cubre solo el backend (`apps/backend`). El enunciado del reto está en [`docs/00-discovery/reto-tecnico.md`](../../docs/00-discovery/reto-tecnico.md).

## Contenido

- [Semantic Phrase API](#semantic-phrase-api)
  - [Contenido](#contenido)
  - [Funcionalidades y flujo principal](#funcionalidades-y-flujo-principal)
  - [Cómo levantar el proyecto (paso a paso)](#cómo-levantar-el-proyecto-paso-a-paso)
    - [1. Clonar el repositorio](#1-clonar-el-repositorio)
    - [2. Levantar PostgreSQL (pgvector) y el servicio de embeddings](#2-levantar-postgresql-pgvector-y-el-servicio-de-embeddings)
    - [3. Instalar dependencias y configurar el entorno](#3-instalar-dependencias-y-configurar-el-entorno)
    - [4. Aplicar las migraciones](#4-aplicar-las-migraciones)
    - [5. Arrancar el servidor](#5-arrancar-el-servidor)
    - [6. Verificar que funciona](#6-verificar-que-funciona)
    - [7. Ejecutar las pruebas (opcional)](#7-ejecutar-las-pruebas-opcional)
    - [Frontend](#frontend)
    - [Detener y reiniciar](#detener-y-reiniciar)
    - [Problemas comunes](#problemas-comunes)
  - [Variables de entorno](#variables-de-entorno)
  - [Base de datos y migraciones](#base-de-datos-y-migraciones)
  - [Arquitectura y decisiones técnicas](#arquitectura-y-decisiones-técnicas)
  - [API](#api)
    - [`GET /api/v1/phrases?page=1&limit=20`](#get-apiv1phrasespage1limit20)
    - [`POST /api/v1/phrase-validations`](#post-apiv1phrase-validations)
    - [`POST /api/v1/phrases`](#post-apiv1phrases)
    - [`DELETE /api/v1/phrases/{id}`](#delete-apiv1phrasesid)
    - [Catálogo de errores](#catálogo-de-errores)
  - [Integración con Hugging Face (evidencia)](#integración-con-hugging-face-evidencia)
  - [Testing](#testing)
  - [Spec-Driven Development](#spec-driven-development)
  - [Versionamiento en Git](#versionamiento-en-git)
  - [Limitaciones conocidas](#limitaciones-conocidas)

## Funcionalidades y flujo principal

| Endpoint (prefijo `/api/v1`) | Función                                                                                                             |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `GET /phrases`               | Lista paginada de frases activas                                                                                    |
| `POST /phrase-validations`   | Valida una frase nueva: devuelve la frase más parecida, su score y si requiere confirmación. **No guarda la frase** |
| `POST /phrases`              | Registra la frase usando el `validationId` obtenido; exige `confirmed: true` si hubo alerta                         |
| `DELETE /phrases/{id}`       | Borrado lógico (_soft delete_)                                                                                      |

Flujo principal:

1. `POST /phrase-validations` con el texto → el backend genera el embedding, busca coincidencia textual exacta y, si no hay, la frase más cercana por similitud coseno (pgvector). Guarda una validación temporal (15 min por defecto) y responde con `validationId`, `match` y `requiresConfirmation`.
2. Si `requiresConfirmation` es `true`, el cliente muestra la alerta; el usuario confirma o cancela (cancelar = no enviar el paso 3).
3. `POST /phrases` con `text`, `validationId` y `confirmed`. El backend verifica la validación (existe, vigente, no consumida, mismo texto, mismo modelo, confirmación), inserta la frase **reutilizando el embedding ya calculado** (no vuelve a llamar al modelo) y consume la validación.

## Cómo levantar el proyecto (paso a paso)

**Requisitos:** Git, Docker con Compose, Node.js 22 y pnpm (`npm i -g pnpm`).

> `compose.yaml` (PostgreSQL y servicio de embeddings) vive en la **raíz del monorepo**, y `apps/backend` es un submódulo Git. Hay que clonar el repositorio raíz con submódulos, no solo el backend.

### 1. Clonar el repositorio

```sh
git clone --recurse-submodules <url-del-repositorio-raiz> semantic-phrase-app
cd semantic-phrase-app
# si ya estaba clonado sin submódulos:
# git submodule update --init --recursive
```

### 2. Levantar PostgreSQL (pgvector) y el servicio de embeddings

Desde la raíz del monorepo:

```sh
docker compose up -d --wait
```

- La **primera vez** el contenedor `embeddings` descarga el modelo de Hugging Face (~500 MB); `--wait` espera hasta que esté sano (hasta 10 min).
- La imagen es `cpu-arm64` con `platform: linux/arm64` (Apple Silicon). En máquinas x86_64 editar `compose.yaml`: usar la imagen `ghcr.io/huggingface/text-embeddings-inference:cpu-1.9.4` y quitar la línea `platform`.
- Comprobar que ambos servicios están arriba:

```sh
docker compose ps                      # postgres y embeddings: running / healthy
curl http://127.0.0.1:8080/health      # responde 200 cuando el modelo está cargado
```

### 3. Instalar dependencias y configurar el entorno

```sh
cd apps/backend
pnpm install
cp .env.example .env
```

El `.env.example` ya coincide con las credenciales por defecto del `compose.yaml`; no hay que editar nada para un entorno local. Ver [variables de entorno](#variables-de-entorno).

### 4. Aplicar las migraciones

```sh
pnpm run db:migrate
```

Crea la extensión `vector` y las tablas `phrases` y `phrase_validations`. No se ejecutan automáticamente al arrancar.

### 5. Arrancar el servidor

```sh
pnpm run start:dev     # modo desarrollo con recarga
```

Debe aparecer `Nest application successfully started` y escuchar en `http://localhost:3000`. Si el servicio de embeddings no responde, el proceso termina con `AiUnavailableError` (ver [problemas comunes](#problemas-comunes)).

Para producción local: `pnpm run build && pnpm run start:prod`.

### 6. Verificar que funciona

```sh
# a) lista (vacía al inicio)
curl http://localhost:3000/api/v1/phrases

# b) validar una frase (colección vacía → match: null, requiresConfirmation: false)
curl -s http://localhost:3000/api/v1/phrase-validations \
  -H 'Content-Type: application/json' \
  -d '{"text":"Me gusta mucho la programación"}'

# c) registrar la frase con el validationId recibido en (b)
curl -s http://localhost:3000/api/v1/phrases \
  -H 'Content-Type: application/json' \
  -d '{"text":"Me gusta mucho la programación","validationId":"<validationId de b>"}'

# d) validar una frase parecida → vector, score alto, requiresConfirmation: true
curl -s http://localhost:3000/api/v1/phrase-validations \
  -H 'Content-Type: application/json' \
  -d '{"text":"Me encanta programar"}'
```

### 7. Ejecutar las pruebas (opcional)

```sh
pnpm test             # unitarias
pnpm run test:e2e     # HTTP (no necesitan Docker)
```

### Frontend

El frontend (`apps/frontend`, Vite en `http://localhost:5173`) consume esta API; CORS solo permite ese origen.

### Detener y reiniciar

```sh
docker compose stop        # detener (conserva datos)
docker compose down -v     # eliminar contenedores Y volúmenes (borra BD y caché del modelo)
```

### Problemas comunes

| Síntoma                                                      | Causa / solución                                                                                                                   |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| `AiUnavailableError` al arrancar                             | TEI no está listo o `AI_EMBEDDINGS_URL` es incorrecta. Esperar a que `curl http://127.0.0.1:8080/health` responda 200 y reiniciar. |
| `DATABASE_URL` missing / `drizzle.config.ts` lanza error     | Falta `.env` en `apps/backend` (paso 3).                                                                                           |
| `relation "phrases" does not exist`                          | Faltó `pnpm run db:migrate` (paso 4).                                                                                              |
| `AI_EMBEDDING_DIMENSIONS must be 384`                        | El valor del `.env` debe ser `384`.                                                                                                |
| El contenedor `embeddings` falla en x86_64 / Windows / Linux | La imagen por defecto es arm64; ver paso 2.                                                                                        |
| Puerto 5432, 8080 o 3000 ocupado                             | Cambiar `POSTGRES_PORT` / `PORT` en el entorno o liberar el puerto.                                                                |

## Variables de entorno

Se leen de `.env` (copiar desde [`.env.example`](.env.example)); las variables del shell tienen prioridad. `.env` está ignorado por Git.

| Variable                                                                | Requerida | Valor de ejemplo / por defecto                                  | Descripción                                                                                                                                                          |
| ----------------------------------------------------------------------- | --------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                                                          | Sí        | `postgresql://semantic:semantic@localhost:5432/semantic_phrase` | Conexión a PostgreSQL. También la usa `drizzle-kit`.                                                                                                                 |
| `PORT`                                                                  | No        | `3000`                                                          | Puerto HTTP.                                                                                                                                                         |
| `AI_EMBEDDINGS_URL`                                                     | Sí        | `http://127.0.0.1:8080`                                         | URL de TEI (`http://embeddings:80` dentro de la red Docker).                                                                                                         |
| `AI_MODEL`                                                              | Sí        | `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`   | Modelo de Hugging Face.                                                                                                                                              |
| `AI_EMBEDDING_VERSION`                                                  | Sí        | `tei-9674a558…764b3`                                            | Identidad del runtime/perfil: `tei-` + SHA-256 del descriptor canónico del [contrato TEI](specs/002-semantic-similarity-validation/contracts/embeddings-service.md). |
| `AI_EMBEDDING_DIMENSIONS`                                               | Sí        | `384`                                                           | Debe ser `384` o el backend no arranca.                                                                                                                              |
| `AI_INFERENCE_TIMEOUT_MS`                                               | Sí        | `5000`                                                          | Timeout de inferencia (delegado al SDK). Si falta, el valor resultante es `NaN`.                                                                                     |
| `AI_SIMILARITY_THRESHOLD`                                               | Si        | `0.8538613695045911`                                            | Umbral coseno (inclusivo) para exigir confirmación.                                                                                                                  |
| `PHRASE_VALIDATION_TTL_MINUTES`                                         | No        | `15`                                                            | Vigencia de una validación.                                                                                                                                          |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` / `POSTGRES_PORT` | No        | `semantic` / `semantic` / `semantic_phrase` / `5432`            | Solo para `compose.yaml` (raíz).                                                                                                                                     |

La configuración no se valida con un esquema; solo se comprueban `DATABASE_URL`, `AI_EMBEDDING_DIMENSIONS`, `AI_MODEL` y `AI_EMBEDDING_VERSION`.

## Base de datos y migraciones

Las migraciones SQL generadas por Drizzle están en [`drizzle/migrations/`](drizzle/migrations). Aplicar con `pnpm run db:migrate`. Tras cambiar un `*.model.ts`, `pnpm run db:generate` crea la migración (revisar el SQL, sobre todo el orden de la extensión pgvector).

| Migración                           | Contenido                                                                                                                                                         |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `0000_marvelous_mojo.sql`           | `CREATE EXTENSION vector`; tabla `phrases` (`embedding vector(384)`, `normalized_text`, `model_id`, `model_version`, `created_at`) e índice por `normalized_text` |
| `0001_fantastic_impossible_man.sql` | Tabla `phrase_validations` (texto, embedding, `matched_phrase_id`, `similarity_score`, `requires_confirmation`, `created_at`, `expires_at`, `consumed_at`)        |
| `0002_sloppy_fallen_one.sql`        | `phrases.status` (1 activa, 2 eliminada), `deleted_at` y restricción `CHECK`                                                                                      |

Los metadatos de validación pedidos por el reto (score, fecha, estado) se guardan en `phrase_validations`.

## Arquitectura y decisiones técnicas

```mermaid
flowchart LR
    C[Cliente] -->|REST /api/v1| HTTP
    subgraph Backend NestJS
      HTTP[infrastructure/http<br/>controllers · DTOs · filtros] --> UC[application<br/>casos de uso · puertos]
      UC --> DOM[domain<br/>entidades · value objects]
      UC --> EMB[infrastructure/embeddings<br/>adaptador LangChain]
      UC --> DB[infrastructure/persistence<br/>repositorios Drizzle]
    end
    EMB -->|POST /v1/embeddings| TEI[Hugging Face TEI<br/>:8080]
    DB --> PG[(PostgreSQL + pgvector<br/>:5432)]
```

**Estructura** (`src/`):

```
main.ts · configure-app.ts · app.module.ts
modules/phrases/
  domain/          entidades (Phrase, PhraseValidation), value objects, errores de dominio
  application/     casos de uso, puertos inbound/outbound, errores de aplicación
  infrastructure/
    http/          controllers, DTOs, validadores, filtros de excepción, mappers
    embeddings/    adaptador Hugging Face (LangChain → TEI)
    persistence/drizzle/   modelos, mappers y repositorios
shared/            configuración (puerto), proveedor de BD, Problem Details
```

| Decisión                                                                                                                     | Motivo                                                                                                                                                                                   |
| ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Hexagonal** (`domain` / `application` / `infrastructure`) con puertos abstractos                                           | El dominio no importa NestJS ni tecnología; el modelo de IA y la BD se pueden sustituir sin tocar los casos de uso, y se prueban con puertos simulados.                                  |
| **Embeddings servidos por TEI** (contenedor oficial de Hugging Face) y consumidos con `OpenAIEmbeddings` de LangChain        | TEI expone `/v1/embeddings` compatible con OpenAI; NestJS no carga pesos del modelo. No se usa OpenAI ni se necesita clave real.                                                         |
| **Modelo `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`** (384 dim., revisión fijada)                         | Multilingüe (español), ligero, corre en CPU. Comparado con E5-small, DistilUSE y BGE-M3 en [`docs/01-ai-feasibility/model-decision.md`](../../docs/01-ai-feasibility/model-decision.md). |
| **PostgreSQL + pgvector**, similitud coseno en SQL (`cosineDistance` de Drizzle)                                             | La búsqueda Top-1 ocurre en la base; no se traen todas las frases a memoria.                                                                                                             |
| **Validación en dos pasos** (`phrase-validations` → `phrases`) con comprobante `validationId` (UUID v4, expira, un solo uso) | Implementa el HITL: el servidor solo guarda lo que fue validado y, si hubo alerta, confirmado. Evita recalcular embeddings.                                                              |
| **Umbral configurable** (`AI_SIMILARITY_THRESHOLD`, inclusivo `>=`)                                                          | Requisito del reto; ajustable sin cambiar código.                                                                                                                                        |
| **Identidad de modelo/versión** guardada con cada vector                                                                     | Solo se comparan vectores de la misma identidad; un cambio de modelo no mezcla espacios vectoriales (`409 INCOMPATIBLE_MODEL`).                                                          |
| **Errores como Problem Details** (RFC 9457, `application/problem+json`) con `code` estable                                   | Estructura de error consistente; filtros globales traducen errores de dominio, BD e IA. Sin detalles internos en la respuesta.                                                           |
| **Arranque fail-fast**                                                                                                       | El proceso termina si falta `DATABASE_URL`, si `AI_EMBEDDING_DIMENSIONS` ≠ 384 o si TEI no responde a la inferencia de comprobación.                                                     |
| **Borrado lógico** (`status`, `deleted_at`)                                                                                  | Las frases borradas se ignoran en lista y validación, pero las validaciones previas que las citan no cambian.                                                                            |

Configuración global (`src/configure-app.ts`): prefijo `api`, `ValidationPipe` estricto (`transform`, `whitelist`, `forbidNonWhitelisted`), CORS fijo a `http://localhost:5173` y filtro global de Problem Details.

Documentación ampliada: [`docs/03-architecture/`](../../docs/03-architecture/) (en particular `02-backend-architecture.md`, `04-ai-architecture.md`, `05-data-architecture.md`, `06-api-security.md`).

## API

Contrato completo: [`docs/03-architecture/openapi.yaml`](../../docs/03-architecture/openapi.yaml) y `specs/*/contracts/`. Las respuestas de éxito con cuerpo van envueltas en `{ "data": ... }`; los errores usan `application/problem+json`.

### `GET /api/v1/phrases?page=1&limit=20`

Devuelve `data[]` (`id`, `text`, `createdAt`) y `meta` (`page`, `limit`, `total`, `totalPages`). `page` ≥ 1; `limit` entre 1 y 100. Solo frases activas.

### `POST /api/v1/phrase-validations`

Body: `{ "text": "Me gusta viajar a Cusco" }`. Texto de hasta 280 puntos de código Unicode, con al menos 3 letras, sin emojis, sin caracteres de control ni vacío tras `trim`; campos desconocidos en el body se rechazan.

```json
{
  "data": {
    "validationId": "2d4311a3-237c-45cc-bd35-c9eac4c38ef1",
    "expiresAt": "2026-10-24T16:18:52.000Z",
    "requiresConfirmation": true,
    "match": {
      "type": "vector",
      "phrase": {
        "id": "606c4a4f-9b23-4b35-b635-394ca80f4ece",
        "text": "Me gusta mucho la programación"
      },
      "similarityScore": 0.9003756910674484
    }
  }
}
```

- `match.type`: `textual_exact` (texto normalizado idéntico, `similarityScore: null`, confirmación obligatoria) o `vector` (coseno entre −1 y 1; la candidata se devuelve también bajo el umbral).
- `match: null` si no hay frases activas.
- Expira cuando `now >= expiresAt`. Revalidar crea otra identidad sin consumir la anterior.

### `POST /api/v1/phrases`

```sh
curl -i http://localhost:3000/api/v1/phrases \
  -H 'Content-Type: application/json' \
  -d '{"text":"Me gusta viajar a Cusco","validationId":"<uuid de una validación vigente>","confirmed":true}'
```

Éxito `201`: `{ "data": { "id", "text", "createdAt" } }`. Si `requiresConfirmation` era `false`, `confirmed` puede omitirse; con alerta solo `true` permite registrar (cadenas, números y `null` se rechazan).

### `DELETE /api/v1/phrases/{id}`

`204` sin cuerpo. `400 VALIDATION_ERROR` si `id` no es UUID; `404 PHRASE_NOT_FOUND` si no existe o ya fue eliminada.

### Catálogo de errores

| Estado | Código                    | Causa                                                               |
| ------ | ------------------------- | ------------------------------------------------------------------- |
| 400    | `VALIDATION_ERROR`        | Body, query o parámetros inválidos; `errors[].messages[]` por campo |
| 400    | `INVALID_VALIDATION_ID`   | Referencia ausente, no UUID v4 o inexistente                        |
| 400    | `PHRASE_MISMATCH`         | El texto difiere del validado                                       |
| 404    | `PHRASE_NOT_FOUND`        | Frase inexistente o ya eliminada                                    |
| 409    | `CONFIRMATION_REQUIRED`   | Hubo alerta y falta `confirmed: true` (se puede reintentar)         |
| 409    | `VALIDATION_EXPIRED`      | Validación vencida; hay que volver a validar                        |
| 409    | `VALIDATION_ALREADY_USED` | La validación ya fue consumida                                      |
| 409    | `INCOMPATIBLE_MODEL`      | Modelo/versión de la validación ≠ configuración actual              |
| 503    | `AI_UNAVAILABLE`          | TEI no responde, timeout o respuesta inválida                       |
| 500    | `DATABASE_ERROR`          | Fallo de conexión, consulta o escritura (sin detalles internos)     |
| 500    | `INTERNAL_ERROR`          | Fallo inesperado                                                    |

Cualquier otra `HttpException` (p. ej. 404 de ruta) se devuelve con su estado y código `HTTP_ERROR`.

## Integración con Hugging Face (evidencia)

**Código:**

- Adaptador: [`hugging-face-embedding.adapter.ts`](src/modules/phrases/infrastructure/embeddings/huggin-face/hugging-face-embedding.adapter.ts) implementa el puerto `EmbeddingGeneratorPort`; usa `OpenAIEmbeddings` (LangChain) apuntando a `${AI_EMBEDDINGS_URL}/v1`, sin reintentos y con timeout. Exige 384 componentes finitos y traduce cualquier fallo a `AiUnavailableError` (503).
- Servicio: contenedor `ghcr.io/huggingface/text-embeddings-inference:cpu-arm64-1.9.4` definido en [`compose.yaml`](../../compose.yaml) con el modelo y la revisión fijados (`e8f8c211…`), mean pooling, float32 y `--auto-truncate=false`.
- Búsqueda: [`drizzle-phrase.repository.ts`](src/modules/phrases/infrastructure/persistence/drizzle/phrase/drizzle-phrase.repository.ts) (`findValidationMatch`): primero igualdad textual normalizada; si no, Top-1 por distancia coseno entre frases activas de la misma identidad de modelo.
- Caso de uso: [`validate-phrase.use-case.ts`](src/modules/phrases/application/use-cases/validate-phrase.use-case.ts).

**Ejemplo real de validación** (ejecutado el 2026-10-24 contra el stack local, con la frase guardada `"Me gusta mucho la programación"` y umbral `0.8538613695045911`):

| Frase enviada                    | `match.type`    | `similarityScore` | `requiresConfirmation` |
| -------------------------------- | --------------- | ----------------: | :--------------------: |
| `Me gusta mucho la programación` | `textual_exact` |            `null` |         `true`         |
| `Me encanta programar`           | `vector`        |          `0.9347` |         `true`         |
| `Disfruto bastante programar`    | `vector`        |          `0.9004` |         `true`         |
| `Hoy va a llover en Lima`        | `vector`        |          `0.0484` |        `false`         |

```sh
curl -s http://localhost:3000/api/v1/phrase-validations \
  -H 'Content-Type: application/json' \
  -d '{"text":"Me encanta programar"}'
```

```json
{
  "data": {
    "validationId": "94f19a9e-4b5d-4651-a83b-d197189e41f4",
    "expiresAt": "2026-10-24T16:18:52.000Z",
    "requiresConfirmation": true,
    "match": {
      "type": "vector",
      "phrase": {
        "id": "606c4a4f-9b23-4b35-b635-394ca80f4ece",
        "text": "Me gusta mucho la programación"
      },
      "similarityScore": 0.9347115476515465
    }
  }
}
```

Por cada inferencia el servidor registra (nivel LOG) el modelo, el número de caracteres, las dimensiones, los primeros componentes del embedding y la latencia. La identidad del servicio se comprueba con `curl http://127.0.0.1:8080/info`.

**Calidad del modelo y umbral:** el umbral `0.8538613695045911` se calibró en el experimento de flujo completo (`experiments/semantic-similarity`) con vectores `q8` de Xenova; sobre 10 positivos del holdout alertó 2 y dejó pasar 8, con 0 falsos positivos. **No se ha recalibrado** para los vectores float32 de TEI que usa hoy el backend. Detalle y límites en [`model-decision.md`](../../docs/01-ai-feasibility/model-decision.md). Paráfrasis cercanas sí superaron el umbral en los ejemplos, pero el modelo no garantiza detectar todos los duplicados; por eso la alerta es una _posible coincidencia_ y la decisión final es del usuario.

## Testing

```sh
pnpm run build
pnpm test            # unitarias: 28 suites, 318 tests
pnpm run test:e2e    # HTTP: 4 suites, 115 tests
pnpm run test:cov    # cobertura en coverage/
```

- **Unitarias** (`src/**/*.spec.ts`, junto al código): value objects y entidades del dominio, casos de uso (`validate-phrase`, `create-phrase`, `list-phrases`, `delete-phrase`), adaptador de embeddings, repositorios y mappers Drizzle, controllers, filtros de error, configuración y validadores.
- **E2E HTTP** (`test/*.e2e-spec.ts`): levantan la app Nest completa con `supertest` y puertos simulados (no necesitan PostgreSQL ni TEI). Cubren validación semántica (`phrase-validations`), registro con confirmación (`phrase-registration`), listado y borrado (`phrases`) y la configuración global (`app`). Fixtures en `test/fixtures/`.
- Escenarios borde cubiertos: texto vacío/solo espacios/controles/emojis/menos de 3 letras/demasiado largo, campos desconocidos, coincidencia textual exacta, umbral inclusivo, corpus vacío, vectores de otro modelo, validación expirada o consumida, texto distinto al validado, confirmación ausente o no booleana, TEI caído o con respuesta inválida y errores de BD.

Los pasos manuales de aceptación están en los `quickstart.md` de cada feature (`specs/*/quickstart.md`).

## Spec-Driven Development

Cada funcionalidad se especificó **antes de implementarse** con Spec Kit (`.specify/`, principios en [`.specify/memory/constitution.md`](.specify/memory/constitution.md)). Cada carpeta de `specs/` contiene `spec.md` (historias y criterios de aceptación), `plan.md`, `research.md`, `data-model.md`, `contracts/` (contratos de API), `quickstart.md`, `checklists/` y `tasks.md`.

| Feature                                                                          | Alcance                                      |
| -------------------------------------------------------------------------------- | -------------------------------------------- |
| [`001-list-phrases`](specs/001-list-phrases)                                     | Listado paginado                             |
| [`002-semantic-similarity-validation`](specs/002-semantic-similarity-validation) | Validación semántica con embeddings y umbral |
| [`003-register-phrases-hitl`](specs/003-register-phrases-hitl)                   | Registro con confirmación humana             |
| [`004-soft-delete-phrases`](specs/004-soft-delete-phrases)                       | Borrado lógico                               |

Cuando el código y una spec discrepan, se actualiza la spec para reflejar el comportamiento implementado.

## Versionamiento en Git

Commits cortos, en imperativo y atómicos, con prefijos convencionales (`feat:`, `docs:`, `chore:`). Las specs de una funcionalidad se comitean antes de su implementación (por ejemplo, `docs: add delete phrase spec` → `feat: add delete phrase`). `apps/backend` es un submódulo Git del repositorio raíz.

## Limitaciones conocidas

- Registro y consumo de la validación son dos escrituras secuenciales **sin transacción**: si falla el consumo, la frase queda insertada; solicitudes concurrentes con el mismo `validationId` pueden crear varias frases.
- Las validaciones expiradas o abandonadas no se limpian automáticamente.
- No hay autenticación, rate limiting ni límite global de frases; el `validationId` no autentica personas.
- El umbral no se ha revalidado con TEI float32 (ver arriba).
- Los vectores generados con otro modelo/versión quedan excluidos de la búsqueda; no hay _backfill_ automático. Si el corpus activo solo contiene vectores incompatibles y no hay igualdad textual, la validación responde `500 INTERNAL_ERROR`.
- CORS fijo a `http://localhost:5173`.
