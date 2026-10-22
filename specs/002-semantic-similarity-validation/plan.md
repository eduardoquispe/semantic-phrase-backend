# Implementation Plan: F002 — Validación de Similitud Semántica

Cambio incompatible (2026-10-22): `validationId` sustituye a `validationToken`, sin alias.
Se devuelve el UUID v4 aleatorio de la validación persistida, sin firma ni JWT.
Los JWT anteriores dejan de formar parte del contrato; las filas existentes pueden
referenciarse por su UUID. No hay migración ni secreto de firma requerido.
El registro queda fuera de F002: deberá buscar por `validationId`, comprobar
vigencia (`now >= expiresAt` implica expiración), texto, confirmación y estado no
consumido, y consumir la validación atómicamente con el guardado de la frase.
TTL configurable inicialmente de 15 minutos; respuesta y fila comparten expiración.


**Feature**: 002-semantic-similarity-validation | **Date**: 2026-10-22
**Spec**: [spec.md](spec.md)

## Decisiones aprobadas

Mantener POST /api/v1/phrase-validations y sustituir inferencia local por el
servicio TEI existente. El usuario autorizó TEI **1.9.4**, eligió **OpenAIEmbeddings**
y proporcionó el adaptador mínimo que debe usarse. Estas decisiones sustituyen
el diseño inicial de un cliente TeiEmbeddings con transporte/validaciones propios.

El adaptador crea una sola instancia de OpenAIEmbeddings con modelo configurado,
apiKey ficticia tei-local, maxRetries 0, timeout SDK y baseURL configurable terminada
en /v1. Al iniciar llama generate para comprobar inferencia. generate usa embedQuery,
Embedding y PhraseModel; traduce fallos a AiUnavailableError. Sin fetch propio,
consulta automática /info, ready, validación adicional de identidad/norma/cero,
deadline adicional o aborto propio al cerrar. No se implementan nuevas capas.

## Technical Context

- TypeScript 5.7, NestJS 11, Node 22, pnpm.
- LangChain Core 0.3.79 + @langchain/openai 0.6.16 (peer compatible).
- Drizzle 0.45, PostgreSQL/pgvector, validación HTTP existente.
- TEI CPU ARM64 1.9.4, modelo sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2,
  revisión e8f8c211226b894fcb81acc59f3b34ba3efd5f42, mean, float32, 384.
- URL host http://127.0.0.1:8080; red Docker http://embeddings:80.
- Timeout obligatorio configurable, sin default; 5000 solo ejemplo. Umbral
  0.8538613695045911; TTL 15 minutos; clave base64 >=32 bytes.

## Estructura y responsabilidades

Mantener dominio, puertos, casos de uso y organización actual de persistencia
bajo drizzle/phrase y drizzle/phrase-validation. La infraestructura de embeddings
necesita solo HuggingFaceEmbeddingAdapter y su error existente. Configuración,
composición y pruebas se adaptan sin añadir otro cliente/proveedor/puerto.
Corregir imports relativos y descubrimiento drizzle/**/*.model.ts tras la
reorganización ya existente. Sin migración nueva por TEI ni migración en bootstrap.

Retirar LocalMiniLmEmbeddings y su test, manifiesto, script/comando model:prepare,
Transformers y transitivas exclusivas. Retirar también el cliente TEI provisional.
Conservar cachés ajenas y evidencia histórica separada.

## Contrato de dependencia

Véase [embeddings-service.md](contracts/embeddings-service.md). El SDK utiliza
/v1/embeddings, solicita base64 por defecto y decodifica float32. El endpoint
normaliza y usa Right/sin prompt explícito. No admite truncate por petición;
para conservar texto completo el despliegue debe configurar --auto-truncate=false.
Cualquier ajuste del servicio existente requiere permiso del usuario; no crear
otro despliegue ni tocar volúmenes. Verificar perfil manualmente antes de activar.

AI_EMBEDDING_VERSION identifica el descriptor operativo canónico con tei-SHA256.
La configuración valida formato, y el adaptador conserva esa versión; no la verifica
contra /info. Modelo/versión se mantienen fijos operativamente y se revisan al
reiniciar. /info no certifica criptográficamente los pesos ni los prompts.

## Flujo y compatibilidad

1. Validar configuración y completar una inferencia de inicio antes de escuchar.
2. Validar texto/query; generar siempre embedding, también para textual/empty.
3. Buscar textual primero; si no existe, Top-1 coseno con modelo/versión exactos.
   Textual: fecha DESC/UUID DESC; vector: distancia ASC/UUID ASC. Consultas
   parametrizadas secuenciales sin atribuir snapshot común.
4. Colección vacía: match null. Colección incompatible sin texto igual: 500 seguro.
5. Guardar validación temporal antes de devolver validationId; responder 201 solo después.
   No insertar phrases, consumir ni renovar comprobantes.
6. Error SDK/Embedding: 503 AI_UNAVAILABLE. BD (conexión, SQL o restricciones): 500 DATABASE_ERROR;
   incompatible: 500 INTERNAL_ERROR.

Conservar Unicode 1–280 para validar, hasta 500 para lectura histórica F001,
confirmación inclusiva, una candidata incluso bajo umbral, referencia UUID persistida,
UUID v4 y fechas compartidas a segundos. No reetiquetar vectores Xenova; un corpus
antiguo puede requerir regeneración manual fuera de F002. No backfill automático.

## Verificación

Pruebas unitarias cercanas, HTTP con configureApp y SDK sobre transporte simulado,
y regresión F001. Ejecutar build, unitarias, E2E, formato/lint y revisión de cobertura.
Probar configuración, opciones del constructor, inferencia de inicio, VOs, errores
SDK/red/HTTP/formato y timeout SDK sin reintentos ni búsqueda/save tras error.
No exigir defensas que el usuario retiró del adaptador.

Integración real: inspección manual /info/imagen/prompts, comparación entre LangChain
y /v1/embeddings directo (384, norma L2 tolerancia 1e-5, diferencia <=1e-6). Inventariar
corpus en lectura; probar SQL/UUID/fechas en base temporal aislada con migraciones
existentes. Medir exactamente tres solicitudes HTTP normales, arranque separado,
meta hasta 5 segundos. Guardar evidencia sanitizada en quickstart sin tokens/secretos.

## Constitution Check

PASS: arquitectura hexagonal y puertos conservados; contrato público documentado;
pruebas requeridas; cliente estándar sin nueva abstracción; configuración/secretos
validados. Sin excepciones constitucionales. Registro, consumo, frontend, historial,
limpieza automática y recalibración permanecen fuera de alcance.
