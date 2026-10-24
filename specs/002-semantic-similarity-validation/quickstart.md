# Quickstart de validación — F002

Implementación vigente: OpenAIEmbeddings directo contra TEI 1.9.4, con el adaptador
mínimo indicado por el usuario (`infrastructure/embeddings/huggin-face/`). El registro histórico local
y el de JWT se conservan separados y no describen el comportamiento actual.

Nota (implementación, 2026-10-24): `pnpm test` pasa con 28 suites y 318 pruebas, y `pnpm run test:e2e` con 4 suites y 115 pruebas (puertos simulados). Las cifras de las secciones fechadas más abajo son históricas. El 400 de validación usa `detail` «Los parámetros de la solicitud no son válidos.»; los parámetros de query no declarados se ignoran.
Véanse [plan](plan.md) y [contrato TEI](contracts/embeddings-service.md).

## Preparación

Node 22, pnpm, PostgreSQL/pgvector y servicio TEI existente. Desde apps/backend:

```sh
pnpm install
cp .env.example .env
```

Completar DATABASE_URL, AI_EMBEDDINGS_URL, modelo/revisión/dimensión y versión conforme a .env.example.
AI_INFERENCE_TIMEOUT_MS es obligatorio; 5000 es un ejemplo sin default.

Verificar manualmente el perfil existente, sin asumir que el backend lo contrasta:

```sh
docker compose -f ../../compose.yaml ps embeddings postgres
curl --fail --silent --show-error http://127.0.0.1:8080/info
```

Perfil: TEI 1.9.4, build e80ef225ed0e6cb1717ce632a6a84b6cf211bb67, float32,
mean, modelo/revisión del contrato, sin prompt predeterminado. Para no truncar,
/v1/embeddings necesita auto_truncate=false en el servicio (--auto-truncate=false).
Cambiar la configuración del servicio requiere autorización y reinicio coordinado.
La revisión declarada no certifica criptográficamente los pesos.

El operador calcula el descriptor canónico de [contrato TEI](contracts/embeddings-service.md)
y configura su tei-SHA256; el backend valida formato y conserva esa etiqueta,
sin recalcular/verificar identidad remota. El descriptor verificado puede guardarse
en tei-profile.json y procesarse con el comando del README. No reetiquetar vectores
Xenova; corpus antiguo sin texto igual ni vectores compatibles devuelve 500.

```sh
pnpm run db:migrate
pnpm run start:dev
```

Aplicar solo migraciones existentes en la base seleccionada tras revisar historial.
Sin migración en bootstrap. El arranque completa una inferencia antes de escuchar.
No hay caché/modelo local, consulta automática de /info ni fetch propio.
El timeout/redirecciones son del SDK; no se añade deadline de cuerpo/parseo ni
aborto propio al cerrar. Embedding valida dimensión/finitud, sin norma/cero adicionales.

## Suites

```sh
pnpm run build
pnpm test --runInBand
pnpm run test:e2e --runInBand
```

Unitarias del adaptador verifican opciones, inferencia inicial, VOs y traducción.
HTTP usa configureApp, puertos dobles y un montaje del SDK real con respuestas TEI
simuladas base64; errores red/429/500/JSON/shape/vector/timeout no continúan a
búsqueda/save. Mantener regresión F001 con datos históricos hasta 500 puntos.
Las suites con dobles no demuestran disponibilidad ni SQL real.

## Escenarios reales

```sh
curl -i http://localhost:3000/api/v1/phrase-validations \
  -H 'Content-Type: application/json' --data '{"text":"Me gusta viajar a Cusco"}'
```

201 con data.validationId/expiresAt/requiresConfirmation/match. Empty: match null;
textual: score null y confirmación; vector: una candidata incluso bajo umbral.
No imprimir tokens en evidencia. 400 para entrada inválida; 503 para SDK; 500 DATABASE_ERROR para fallos de BD;
500 INTERNAL_ERROR para corpus incompatible sin igualdad textual o fallo inesperado. Ninguna solicitud registra phrases.

Para integración, usar base temporal aislada, aplicar migraciones existentes y
preparar fixtures TEI deliberados. Contrastar Top-1/desempates/filtro exacto con SQL,
textual incluso incompatible, empty/incompatible, vector(384), UUID persistido y
fechas compartidas. now>=expiresAt significa expiración. Abandono/expiración mantienen
fila hasta limpieza manual; Revalidar no
consume/prorroga. Registro y consumo están fuera de F002.

Comparar OpenAIEmbeddings con /v1/embeddings directo: 384 finitos, norma L2 tolerancia
1e-5 y diferencia máxima <=1e-6. La comprobación no demuestra equivalencia con Xenova.
Inventariar corpus real solo en lectura. Medir exactamente tres solicitudes HTTP
secuenciales normales en corpus aislado y registrar hardware/versiones/perfil,
latencias/máximo/percentiles y arranque por separado (meta 5s).

## Verificación del contrato UUID — 2026-10-22

`pnpm run build`: PASS. `pnpm test --runInBand`: 22 suites, 249 pruebas PASS.
`pnpm run test:e2e --runInBand`: 3 suites, 69 pruebas PASS.
Las pruebas HTTP con persistencia simulada comprueban UUID v4 idéntico al registro,
expiración compartida, TTL de 15 minutos, expiración en igualdad e independencia.
AppModule arranca con configuración sin secreto de firma. Se conserva TTL configurable.
No se repitieron las mediciones ni las pruebas SQL reales de la evidencia histórica.
Se corrigió además la composición de la URL TEI para admitir una barra final sin duplicarla.

## Evidencia histórica anterior a la retirada de JWT

> Histórico: las menciones de firma, `jose` y JWT de esta sección y de la tabla «Trazabilidad actual» describen la implementación previa; el código actual no firma nada ni usa `jose`.

Estos resultados describen la implementación previa; no acreditan el contrato UUID actual.

## Evidencia final TEI — 2026-10-22

T001–T035 se completaron con el adaptador mínimo proporcionado por el usuario.
OpenAIEmbeddings 0.6.16 usa Core 0.3.79 y el SDK OpenAI 5.12.2 contra TEI local;
no se usa inferencia OpenAI ni una clave real. El adaptador no implementa fetch,
consulta /info, validación de identidad/norma/cero, deadline adicional o shutdown.
Las comprobaciones de perfil siguientes se ejecutaron manualmente como aceptación.

### Perfil y transporte reales

TEI 1.9.4, build e80ef225ed0e6cb1717ce632a6a84b6cf211bb67, imagen efectiva
`sha256:798cd7615e060a72ccbdf19aa0ada52289c6a0147490195bafaece6ce04d70f1`,
CPU ARM64/float32/mean, revisión e8f8c211226b894fcb81acc59f3b34ba3efd5f42.
Descriptor/digest: `tei-9674a558292f4607f88dc959067a9762554c3faecfc481af3c0bf66914f764b3`.
Sin prompt predeterminado. Se autorizó añadir únicamente `--auto-truncate=false`
en el servicio existente de `../../compose.yaml` y recrear ese servicio conservando
su volumen. `/info.auto_truncate=false` confirmado después del cambio.
No se modificó PostgreSQL ni se creó otro servicio Docker.

Comparación OpenAIEmbeddings (base64 decodificado por SDK) frente a
`POST /v1/embeddings` directo con encoding_format float, mismo modelo/texto:

| Texto                          | Dimensión |           Norma L2 | Diferencia máxima |
| ------------------------------ | --------: | -----------------: | ----------------: |
| Me gusta viajar a Cusco        |       384 | 0.9999999773116125 |   4.869155884e-09 |
| Disfruto de los viajes a Cusco |       384 | 0.9999999943256754 |   3.969154366e-09 |
| El árbol crece junto al río.   |       384 | 0.9999999940066098 |   7.134819041e-09 |

PASS: 384 finitos, norma dentro de 1e-5 y diferencia <=1e-6. Estas comprobaciones
no certifican equivalencia con Xenova ni mejoras de calidad semántica.
Inicio fallido contra puerto local aislado sin servicio: AiUnavailableError.
Transformers no se resuelve y no existe código de carga/caché local; se conservó
la caché anterior ajena al runtime. HTTP con SDK real simulado cubre red, 429/500,
JSON/shape/vector y timeout SDK con una sola petición, sin búsqueda/save/firma.
No se atribuyen a estas pruebas los controles que el usuario retiró del adaptador.

### PostgreSQL aislado

Inventario en la base actual: existen `phrases` y `phrase_validations`; agrupación
de phrases por modelo/versión/dimensión sin filas (colección vacía). Solo se hizo
lectura en esa base; no hay vectores actuales que requieran regeneración.

Se creó una base temporal de demostración y se aplicaron exclusivamente 0000 y
0001 con el migrador Drizzle. 0000 instala pgvector antes de phrases; 0001 añade
la tabla temporal de 12 columnas sin alterar phrases. Sin migración nueva por TEI.
Tras comprobar todo se cerraron conexiones y se eliminó únicamente la base temporal.

PASS reales:

- Empty: 201, match null, confirmación false.
- Tres frases con modelo antiguo: textual por fecha DESC/UUID DESC, score null,
  confirmación true; sin igualdad textual, 500 INTERNAL_ERROR sin INSERT temporal.
- Dos frases con modelo/versión TEI activos y vectores iguales: empate vectorial
  por UUID ASC y score exactamente igual a SQL. Otra versión con vector perfecto
  queda excluida. Las consultas siguen siendo secuenciales sin snapshot común.
- Lectura F001 de un texto histórico de 500 puntos de código.
- Cada 201 conservaba original, vector(384), modelo/versión configurados, consumed_at
  null y (en esa implementación previa, ya retirada) un JWT HS256/typ JWT/purpose mínimo verificado criptográficamente. Fechas
  de fila, iat/exp y respuesta coinciden a segundos. Revalidar no consume/renueva.
- Conteo de phrases intacto en cada solicitud. Al final del corpus de pruebas:
  3 frases preparadas deliberadamente y 6 validaciones temporales, todas eliminadas
  junto con la base de prueba. Sin registro implícito ni endpoint nuevo de alta.

### Latencia (exactamente tres solicitudes)

macOS/Darwin 25.5.0, arm64, Apple M4, Node v22.12.0, LangChain Core 0.3.79,
LangChain OpenAI 0.6.16, SDK OpenAI 5.12.2, jose 5.10.0. NestJS en host y TEI
en Docker local con el perfil anterior; timeout 5000 ms operativo, TTL 15 minutos.
Corpus: 3 frases, 2 compatibles. Las comprobaciones funcionales y sondeos de
arranque anteriores no forman parte de esta muestra de tres solicitudes adicionales.

| Texto                          | Tipo          | Confirmación |               Coseno | Latencia |
| ------------------------------ | ------------- | ------------ | -------------------: | -------: |
| Me gusta viajar a Cusco        | textual_exact | true         |                 null | 15.02 ms |
| Disfruto de los viajes a Cusco | vector        | true         |   0.9150710327986843 | 14.63 ms |
| El árbol crece junto al río.   | vector        | false        | 0.007854397179579475 | 12.74 ms |

Arranque por separado: **143.50 ms**, incluida inferencia de comprobación
antes de escuchar (servicio ya disponible). Máximo/p95 **15.02 ms**;
p50 **14.63 ms**, método de rango más cercano. SC-005 pasa en
este entorno y muestra pequeña; no es una garantía sobre otros equipos/corpus.

### Suites, arquitectura y limpieza

- `pnpm run build`: PASS. tsconfig.build incluye solo src para conservar
  `dist/main.js` usado por start:prod; no compila drizzle.config como código del servidor.
- `pnpm exec jest --runInBand --coverage --silent`: PASS, 25 suites / 289 pruebas.
  Equivale al runner de pnpm test. Cobertura global de líneas: 81.78%; adaptador,
  caso de uso de validación, agregado, persistencia temporal y firma: 100% de líneas.
  Configuración y ramas se revisaron; no hay umbral configurado. Bootstrap/HTTP
  se ejercitan además en E2E, fuera del reporte unitario.
- `pnpm run test:e2e --runInBand`: PASS, 3 suites / 67 pruebas.
- Prettier src/test/config: PASS. ESLint src/test: 0 errores; conserva una advertencia
  previa no-floating-promises en main.ts (bootstrap). git diff --check: PASS.
- Imports de persistencia corregidos a relativos después de la reorganización
  existente. Drizzle descubre ambos modelos mediante drizzle/**/*.model.ts.
- Sin LocalMiniLmEmbeddings, sus pruebas, manifiesto ni scripts/prepare-minilm.mjs.
  Sin comando model:prepare ni Transformers/ONNX/sharp exclusivos en package/lock;
  se retiraron 45 paquetes al quitar Transformers y se añadieron dependencias del SDK.
- .env.example y README usan únicamente TEI; opciones de caché/proveedor local
  retiradas. Ignorados Git/Prettier/ESLint/Docker verificados; package privado no publica.
- Se preservaron cambios ajenos, puertos y organización actual de persistencia.
  El starter ya eliminado se refleja en sus pruebas con 404; sin otra ruta añadida.
- Contrato compartido de ../../docs/03-architecture/openapi.yaml no editado en esta
  transición; sus modificaciones previas pertenecen al baseline. Contrato local
  mantiene exactamente 201/400/500/503, límites 280 y errors[].messages[].
- No existe .specify/extensions.yml: sin hooks before/after_implement que ejecutar.

### Trazabilidad actual

| Requisitos / criterios         | Evidencia TEI vigente                                                                       |
| ------------------------------ | ------------------------------------------------------------------------------------------- |
| FR-001, FR-015; SC-001, SC-008 | POST sin autenticación, 201 y shape exacto en HTTP; textual real sin alta                   |
| FR-002–003; SC-007             | DTO/VO y matriz HTTP Unicode/Cc/extras/280–281; F001 histórico hasta 500                    |
| FR-004–010; SC-001–003, SC-008 | Repositorio/use-case/HTTP; SQL real textual, empate vectorial, filtro y empty/incompatible  |
| FR-011–013; SC-004             | Errores de puertos y SDK, timeout SDK, DB selectiva, firma fallida y Problem Details seguro |
| FR-014, FR-017; SC-006         | Mapper explícito, JWT real HS256/typ/purpose y claims mínimos sin texto/vector/modelo       |
| FR-016, FR-018–019; SC-006     | Fila temporal, fechas a segundos, expiración en igualdad e independencia; sin consume/alta  |
| FR-020                         | HTTP de volumen sin throttle/429 público                                                    |
| SC-005                         | Tres solicitudes TEI reales medidas y arranque separado en el entorno documentado           |
| SC-009 ajustado                | VOs dimensión/finitud, paridad real SDK/TEI y errores SDK sin efectos posteriores           |

Vigencia: now>=expiresAt. Abandono/expiración no borran filas, limpieza manual;
firma fallida puede dejar una fila huérfana. Tokens previos conservan identidad y
expiración. Registro/consumo, frontend, historial, limpieza automática, backfill y
recalibración están fuera de F002. La evaluación histórica continúa siendo 12/20
aciertos y ocho falsos negativos; la comprobación técnica no cambia esa cifra.

## Baseline de la transición TEI — 2026-10-22 (T001–T002)

Inspección previa a modificar implementación: `PhrasesModule` todavía compone
`LocalMiniLmEmbeddings`; package/lock conservan Transformers y `model:prepare`.
`drizzle.config.ts` busca `drizzle/*.model.ts`, pero los modelos actuales están
en `drizzle/phrase/` y `drizzle/phrase-validation/`. Se preservaron los cambios
previos, incluidos archivos staged/unstaged y la reorganización de persistencia.

Resultados del baseline actual (no acreditan la transición):

- `pnpm run build`: PASS.
- `pnpm test --runInBand`: 23 suites pasan y 3 fallan; 250 pruebas pasan y
  10 fallan. Fallos previos: configuración no rechaza valores inválidos y dos
  suites de repositorio no resuelven imports absolutos `src/...` tras la
  reorganización de persistencia.
- `pnpm run test:e2e --runInBand`, ejecutado fuera del sandbox para permitir
  puertos locales: una suite pasa (32 pruebas de validación), dos fallan al
  cargar los mismos imports absolutos (app y listado). La ejecución restringida
  previa produjo además EPERM al abrir puertos; no es un fallo funcional.

Inspección de solo lectura: `../../compose.yaml`, `GET /info`, `docker compose ps`
y argumentos/variables del contenedor existente. No se recreó ni modificó Docker.
Modelo, revisión, float32 y pooling mean coinciden con el contrato. La estructura
real es `model_type.embedding.pooling="mean"`, con casing minúsculo.
No hay argumentos ni variables de prompt predeterminado en el contenedor.

Perfil observado:

- Imagen declarada entonces: `…:cpu-arm64-1.9` (el `compose.yaml` actual fija `cpu-arm64-1.9.4`).
- Imagen efectiva: `sha256:798cd7615e060a72ccbdf19aa0ada52289c6a0147490195bafaece6ce04d70f1`.
- `/info.version`: `1.9.4`; `/info.sha`: `e80ef225ed0e6cb1717ce632a6a84b6cf211bb67`.
- `/info.model_id`: `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`.
- `/info.model_sha`: `e8f8c211226b894fcb81acc59f3b34ba3efd5f42`.
- `/info.model_dtype`: `float32`; `/info.auto_truncate`: `true`; las peticiones
  deberán enviar explícitamente `truncate:false` conforme al contrato.

Discrepancia T002: el contrato fija `1.9.0`, pero el servicio ejecuta `1.9.4`.
Perfil 1.9.4 aceptado explícitamente por el usuario el 2026-10-22; contrato actualizado.
El descriptor propuesto conserva exactamente el orden y valores del contrato,
sustituyendo únicamente `runtimeVersion` por `1.9.4` y `runtimeBuild` por el sha
observado. SHA-256 calculado mediante `JSON.stringify` sin espacios ni salto final:
`tei-9674a558292f4607f88dc959067a9762554c3faecfc481af3c0bf66914f764b3`.
Este digest identifica el descriptor observado; corresponde al perfil aceptado y no certifica criptográficamente los pesos. No se ejecutaron inferencias, cambios
de corpus, migraciones ni mediciones TEI en esta comprobación.

## Evidencia histórica de inferencia local — 2026-10-22

Los resultados siguientes provienen de la variante local anterior. Se preservan como registro de trabajo ya realizado; no son instrucciones vigentes de configuración ni evidencia de la transición TEI. Las cifras de latencia, cobertura y paridad deberán obtenerse de nuevo donde corresponda. La preparación, manifiesto y comandos locales citados debajo se retirarán durante implementación.

### Registro anterior

Preparación ejecutada: `node scripts/prepare-minilm.mjs --from-cache ../../experiments/semantic-similarity/.cache/huggingface`.
Los cuatro SHA-256 coinciden con research.md. Caché efectiva:
`.cache/huggingface/Xenova/paraphrase-multilingual-MiniLM-L12-v2/2c4055b12046f11709e9df2c122e59ffbdc2f900/`.
Manifiesto canónico: `JSON.stringify(minilm-manifest.json)` (orden versionado).
Identidad: `minilm-e8649a1522f0f70f924df6dce70140aa9e861f579aeac88377b70fdd2fcb4781`.

Paridad real en Node 22.12.0, Transformers 3.8.1, CPU/q8/mean/L2, LangChain Core 0.3.79:
fachada y pipeline directo con revisión fija, además del pipeline sobre caché experimental main.
`allowRemoteModels=false`, `local_files_only=true`; carga inicial 683.04 ms, sin descargas.

| Texto                          | Dimensión |              Norma | Diferencia máxima directo | Diferencia máxima experimental |
| ------------------------------ | --------: | -----------------: | ------------------------: | -----------------------------: |
| Me gusta viajar a Cusco        |       384 | 1.0000000236017308 |                         0 |                              0 |
| Disfruto de los viajes a Cusco |       384 | 1.0000000124382538 |                         0 |                              0 |
| El árbol crece junto al río.   |       384 | 0.9999998354407335 |                         0 |                              0 |

Las pruebas de caché incompleta/corrupta rechazan inicialización antes de cargar el pipeline.
Migración `0001_fantastic_impossible_man.sql` revisada: una tabla temporal, 12 columnas,
sin FK/índices, sin cambios a phrases. pgvector precede a ambas tablas en 0000.

Vigencia: `now >= expiresAt` significa expiración. Repetir no consume ni prorroga;
la colección puede cambiar después de validar. Abandono/expiración mantienen la fila
hasta limpieza manual; fallo de firma puede dejar una fila temporal huérfana.
El JWT no autentica personas. Registro, consumo y verificación para guardar quedan fuera de F002.

### Suites y estilo

- `pnpm run build`: PASS.
- `pnpm test --runInBand`: 25 suites, 265 pruebas, PASS.
- `pnpm run test:e2e --runInBand`: 3 suites, 59 pruebas, PASS (F001/F002).
- Prettier y ESLint sobre archivos TypeScript cambiados: PASS, sin advertencias.
- Interoperabilidad: importación real Transformers 3.8.1, fachada Core 0.3.79 y firma jose 5.10.0 comprobadas; sin cambios globales de ESM/Jest.

### PostgreSQL y HTTP reales

Se creó una base **temporal aislada** en el PostgreSQL local y se aplicaron ambas
migraciones con el migrador Drizzle. Se eliminó exclusivamente esa base al terminar;
no se modificaron la base de la aplicación ni volúmenes Docker. El script temporal
de comprobación usó el build Nest real con `configureApp`, puertos/adaptadores reales,
modelo local precargado y clave JWT aleatoria efímera (sin guardar ni imprimir tokens).

Comprobaciones SQL PASS: `empty` antes de sembrar; tres frases con mismo texto
normalizado, fecha/UUID controlados y modelos incompatibles; selección textual por
fecha DESC/UUID DESC; `incompatible` al no coincidir texto; dos candidatas habilitadas
con modelo/versión activos; empate vectorial por UUID ASC y exclusión de la tercera;
versión diferente excluida; Top-1 y coseno idénticos a SQL directo. En cada respuesta:
fila temporal con vector(384), texto original, consumed_at NULL y fechas exactamente
iguales a claims JWT verificados criptográficamente; conteo de phrases intacto.

Por instrucción del usuario, la medición final usa **solo 3 solicitudes HTTP**
(sustituye las 20 previstas inicialmente). Entorno: macOS/Darwin 25.5.0, arm64,
Apple M4, Node v22.12.0, Transformers 3.8.1, LangChain Core 0.3.79, jose 5.10.0.
Manifiesto/revisión: los documentados arriba; CPU/q8/mean/L2, timeout operativo 5000 ms,
TTL 15 minutos. Sin descargas de modelo, fallback ni reintentos.

| Solicitud                       |           Corpus | Resultado HTTP 201 | Confirmación |             Coseno | Latencia |
| ------------------------------- | ---------------: | ------------------ | ------------ | -----------------: | -------: |
| Me gusta viajar a Cusco         |                0 | match=null         | false        |               null | 36.36 ms |
| `  ME GUSTA   VIAJAR A CUSCO  ` | 3, incompatibles | textual_exact      | true         |               null | 11.02 ms |
| Disfruto de los viajes a Cusco  | 3, 2 compatibles | vector             | true         | 0.8833108613901832 | 14.31 ms |

Arranque aparte: **800.76 ms**, incluida carga e inferencia de comprobación antes de
escuchar. Muestra de 3: máximo **36.36 ms**, p50 **14.31 ms**, p95 **36.36 ms**
(rango más cercano). Es una comprobación local pequeña, no una garantía de rendimiento
en otros equipos/corpus. Cumple la meta de 5 segundos en este entorno y muestra.
Las tres solicitudes crearon tres validaciones y ninguna frase; el corpus se preparó
explícitamente mediante SQL de pruebas. No se atribuyen mejoras de calidad semántica.

### Trazabilidad final

| Requisitos / criterios         | Evidencia                                                                                                       |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| FR-001, FR-015                 | HTTP sin autenticación, shape exacto, mapper/controller; casos 201 y tests de errores                           |
| FR-002–003; SC-007             | PhraseText.forValidation, validador y matriz HTTP Unicode/Cc/extras; regresión F001 281–500                     |
| FR-004–010; SC-001–003, SC-008 | Pruebas de repositorio/caso de uso/HTTP; SQL real de prioridad, empate, vacío e incompatible                    |
| FR-011–013; SC-004             | Corte de efectos, timeout/salida/rechazo tardíos, errores selectivos DB, firma fallida y Problem Details seguro |
| FR-014, FR-017; SC-006         | Firma JWT real HS256/typ/purpose y claims mínimos; mapper con campos públicos explícitos                        |
| FR-016, FR-018–019; SC-006     | Agregado, persistencia, JWT/expiración en igualdad e independencia; tres filas reales sin insertar phrases      |
| FR-020                         | Ausencia de throttle y prueba HTTP de volumen; catálogo de validación sin 429                                   |
| SC-005                         | Tres solicitudes reales medidas, por ajuste explícito del usuario, y arranque documentado aparte                |

Contratos local y compartido revisados: refs de entrada separados para validar y
registrar, messages[] compartido, validación sin 429, textual prioritario y errores
400/500/503. Registro/consumo, cancelación, historial, frontend, limpieza automática
y recalibración permanecen fuera de esta implementación.

Revisión de cobertura unitaria: `pnpm test --runInBand --coverage`, PASS (265 pruebas).
Global: 79.96% de líneas; caso de uso de validación, configuración, adaptador de
inferencia, firma, persistencia temporal y clasificación DB: 100% de líneas.
Agregado temporal: 97.05%. La carga nativa del pipeline se comprueba con la ejecución
real documentada; su loader se sustituye en unitarias. Bootstrap/filtro global y
composición se ejercitan en E2E, fuera del reporte unitario. Sin umbral configurado.

Comprobación de contratos con parser YAML: 35 referencias internas del compartido
y 12 del local resueltas. Ambas operaciones de validación declaran exactamente
201/400/500/503. Límites 280 para validar y 500 para el esquema histórico/registro,
referencias separadas y FieldError.messages[] comprobados. `git diff --check`: PASS.
No existe `.specify/extensions.yml`; no hay hooks before/after_implement que ejecutar.
