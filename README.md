# Semantic Phrase API

NestJS API for the shared phrase list, semantic validation and confirmed registration.

## Local setup

Use Node.js 22 and pnpm. From the repository root, start PostgreSQL with `docker compose up -d postgres`. From `apps/backend`:

```sh
pnpm install
cp .env.example .env
```

Set `DATABASE_URL` to the local PostgreSQL URL. `.env.example` matches the repository Compose credentials. The application loads `.env` automatically through the root `ConfigModule`; existing shell variables take precedence. Drizzle CLI keeps its separate configuration and requires `DATABASE_URL` to be exported or supplied by an environment loader. `PORT` defaults to `3000`.

```sh
DATABASE_URL=postgresql://semantic:semantic@localhost:5432/semantic_phrase pnpm run db:migrate
pnpm run start:dev
```

Migrations run only when requested. `pnpm run db:generate` generates a new Drizzle migration from the schema; review generated SQL before applying it, particularly pgvector extension ordering.

## API

`GET /api/v1/phrases?page=1&limit=20` returns `data` with `id`, `text`, and `createdAt`, plus `meta` with `page`, `limit`, `total`, and `totalPages`. `page` starts at 1, `limit` ranges from 1 to 100, and only decimal digits are accepted. Invalid query input returns 400; database operation failures return 500 / `DATABASE_ERROR`; unexpected failures return 500. Errors use `application/problem+json`.

## Checks

```sh
pnpm run build
pnpm test
pnpm run test:e2e
```

See [F001 quickstart](specs/001-list-phrases/quickstart.md) for manual acceptance scenarios.

## Validación semántica (F002)

`POST /api/v1/phrase-validations` recibe exclusivamente `{ "text": "Me gusta viajar a Cusco" }`.
Admite 1–280 puntos de código Unicode del original, sin controles Cc ni texto vacío
tras trim. Rechaza campos y query desconocidos. Validar conserva el original y
un embedding en `phrase_validations`; no registra frases.

La inferencia usa **OpenAIEmbeddings de LangChain** contra el servicio TEI local,
`POST /v1/embeddings`. No usa modelos de OpenAI ni necesita una clave OpenAI real.
Los pesos y su caché pertenecen al contenedor; NestJS no carga modelos.

Configurar `.env` desde `.env.example`: URL `AI_EMBEDDINGS_URL` (host:
`http://127.0.0.1:8080`; red Docker: `http://embeddings:80`), modelo
`sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`, revisión
`e8f8c211226b894fcb81acc59f3b34ba3efd5f42` y dimensión 384. El perfil aceptado es
TEI **1.9.4**, mean, float32, sin prompt predeterminado y con **auto-truncate=false**.
El endpoint compatible no admite `truncate` por petición; el servicio debe usar
`--auto-truncate=false`. Verificar `/info.auto_truncate` manualmente antes de activar.
La salida del endpoint compatible ya está normalizada; el adaptador no renormaliza.

`AI_EMBEDDING_VERSION` es `tei-` más SHA-256 del descriptor canónico definido en
[contrato TEI](specs/002-semantic-similarity-validation/contracts/embeddings-service.md).
Para calcularlo, guardar ese descriptor verificado en `tei-profile.json` y ejecutar:

```sh
node --input-type=module -e 'import {readFileSync} from "node:fs"; import {createHash} from "node:crypto"; console.log("tei-"+createHash("sha256").update(JSON.stringify(JSON.parse(readFileSync("tei-profile.json","utf8")))).digest("hex"));'
```

El ejemplo ENV corresponde al build observado; contrastar `/info` y configuración
real del contenedor antes de usarlo. Cambiar modelo/runtime exige revisar compatibilidad,
recalcular identidad y reiniciar coordinadamente servicio/backend. La revisión
informada por TEI no es una certificación criptográfica de todos los pesos.
Los vectores Xenova anteriores conservan su identidad y quedan excluidos del coseno;
un corpus solo incompatible sin igualdad textual produce 500. No hay backfill automático.

`AI_INFERENCE_TIMEOUT_MS` es obligatorio y entero positivo; 5000 es solo ejemplo.
El timeout se delega al SDK; no hay fetch ni deadline propio. No hay reintentos ni fallback. Umbral inicial:
0.8538613695045911; TTL inicial: 15 minutos.

El arranque realiza una inferencia de comprobación antes de escuchar. La identidad
del servicio se contrasta manualmente; el backend conserva la versión configurada.
Aplicar migraciones existentes explícitamente con `pnpm run db:migrate`; no se
aplican durante bootstrap ni se añade una migración por TEI.

Ejemplo 201 sobre colección vacía:
`{"data":{"validationId":"550e8400-e29b-41d4-a716-446655440000","expiresAt":"2026-10-22T15:15:00.000Z","requiresConfirmation":false,"match":null}}`.
Coincidencia textual: `match={type:"textual_exact",phrase:{id,text},similarityScore:null}`,
confirmación obligatoria. Coincidencia vectorial: `type:"vector"` y score coseno
entre -1 y 1; la candidata también se devuelve bajo el umbral. El umbral es inclusivo.
Errores Problem Details: 400 `VALIDATION_ERROR` con `errors[].messages[]`,
503 `AI_UNAVAILABLE`, 500 `DATABASE_ERROR` y 500 `INTERNAL_ERROR` para incompatibilidad,
SQL inesperado. No se aplica throttle en validación.

Una validación expira cuando `now >= expiresAt`. Fila y respuesta comparten
la misma fecha; el UUID no autentica personas. Revalidar crea otra identidad sin
prorrogar ni consumir la anterior. Abandono y expiración no eliminan la fila;
la limpieza es manual. Validar no congela el corpus.
Registro y consumo se implementan en F003, descrito a continuación.

Cambio incompatible (2026-10-22): `validationId` sustituye a `validationToken`, sin alias.
Se devuelve el UUID v4 aleatorio de la validación persistida, sin firma ni JWT.
Los JWT anteriores dejan de formar parte del contrato; las filas existentes pueden
referenciarse por su UUID. No hay migración ni secreto de firma requerido.
F003 busca por `validationId`, comprueba vigencia (`now >= expiresAt` implica
expiración), texto exacto, modelo/versión, confirmación y estado no consumido, y
guarda la frase y después consume la validación mediante dos escrituras secuenciales.
TTL configurable inicialmente de 15 minutos; respuesta y fila comparten expiración.


## Registro con confirmación HITL (F003)

Después de validar mediante `POST /api/v1/phrase-validations`, enviar el mismo
original y el UUID recibido a `POST /api/v1/phrases`:

```sh
curl -i http://localhost:3000/api/v1/phrases \
  -H 'Content-Type: application/json' \
  -d '{"text":"Me gusta viajar a Cusco","validationId":"550e8400-e29b-41d4-a716-446655440000","confirmed":true}'
```

El UUID de ejemplo debe sustituirse por el de una validación vigente. Si
`requiresConfirmation` es false, `confirmed` puede omitirse o ser false/true.
Ante una alerta almacenada solo true permite registrar; cadenas, números y null
se rechazan. Cancelar significa no enviar este POST y no crea ninguna frase.

Éxito 201, con únicamente estos campos públicos:

```json
{
  "data": {
    "id": "123e4567-e89b-42d3-a456-426614174000",
    "text": "Me gusta viajar a Cusco",
    "createdAt": "2026-10-22T19:02:00.000Z"
  }
}
```

El registro admite el mismo texto de 1–280 puntos de código de F002, incluidos
signos, emojis y espacios externos; no admite controles Cc, campos adicionales
ni query. La lectura histórica de hasta 500 puntos de código se conserva.
No hay límite global por volumen. No se generan nuevos embeddings ni se busca
otra coincidencia: se copian el original, normalizado, vector y modelo guardados.

Errores `application/problem+json`:

| Estado | Código | Causa |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Texto, booleano, body o query inválidos; `errors[].messages[]` por campo |
| 400 | `INVALID_VALIDATION_ID` | Referencia ausente, no UUID v4 o inexistente |
| 400 | `PHRASE_MISMATCH` | Original diferente, aunque sea equivalente tras normalizar |
| 409 | `CONFIRMATION_REQUIRED` | Alerta almacenada sin true; permite reintentar con true |
| 409 | `VALIDATION_EXPIRED` | Se alcanzó la expiración; requiere volver a validar |
| 409 | `VALIDATION_ALREADY_USED` | Consumo previo observado al leer el comprobante |
| 500 | `INTERNAL_ERROR` | Modelo/versión incompatible o fallo inesperado, sin detalles internos |
| 500 | `DATABASE_ERROR` | Fallo de conexión, consulta o escritura en persistencia |

Primero se inserta la frase y después se actualiza consumedAt del comprobante.
No hay transacción ni compensación: si falla la inserción no se intenta el consumo;
si falla el consumo, se propaga el error y la frase permanece insertada.
Solicitudes concurrentes pueden crear varias frases con la misma validación.
Un reintento tras un fallo de consumo también puede duplicar la frase. Dos validaciones
distintas pueden registrar el mismo texto. Eliminar manualmente una validación
no elimina la frase: no se mantiene una asociación histórica obligatoria.
No se requieren dependencias, tablas, migraciones ni variables nuevas.

El alcance y la evidencia de verificación están en
[F003 quickstart](specs/003-register-phrases-hitl/quickstart.md).

Los fallos de conexión, SQL y restricciones se traducen globalmente a 500 / `DATABASE_ERROR` con `detail: "Ocurrió un error de base de datos."`. El backend conserva la causa y la registra con el stack una sola vez; no se incluyen detalles internos en Problem Details. Esto sustituye 503 / `DATABASE_UNAVAILABLE` y requiere ajustar clientes que dependían de ese estado o código. Los errores del servicio de IA conservan 503 / `AI_UNAVAILABLE`.
