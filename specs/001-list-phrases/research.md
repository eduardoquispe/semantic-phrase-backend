# Investigación: F001 — Listado de frases

El backend sigue siendo el proyecto inicial de NestJS. Estas decisiones concilian la [especificación](spec.md), el contrato canónico `docs/03-architecture/openapi.yaml` de la raíz, los documentos de arquitectura y la constitución del backend. Salvo indicación contraria, las rutas parten de `apps/backend`.

## Límite de la API

- **Decisión**: Exponer solo `GET /api/v1/phrases` sin autenticación para F001, con `PhraseListEnvelope` y las respuestas de error 400 y 500.
- **Motivo**: El OpenAPI aprobado es el contrato externo. F001 excluye crear, validar, editar, borrar, buscar y filtrar.
- **Alternativas consideradas**: Un controlador CRUD genérico o un esquema externo propio ampliarían o duplicarían el contrato aprobado.

## Parámetros y paginación

- **Decisión**: Nota (implementación): el código convierte con `Number()` y `IsInt` (acepta p. ej. `1e2`, `1.0`, `0x10`; rechaza arreglos y texto no numérico). Decisión original: aceptar cadenas de dígitos decimales para `page` y `limit`. Usar 1 y 20 solo cuando se omitan. Rechazar como 400 valores vacíos, con signo, fraccionarios, exponenciales, duplicados, desconocidos o numéricamente inseguros. Exigir `page >= 1` y `1 <= limit <= 100`; calcular el desplazamiento sin redondeo. Una página posterior a la última devuelve `data` vacío y conserva la página solicitada y los totales reales.
- **Motivo**: La conversión implícita y `parseInt` pueden aceptar formas excluidas por FR-007. Las claves duplicadas y los números inseguros pueden alterar silenciosamente la página.
- **Alternativas consideradas**: Conversión amplia con `Number()` o `parseInt`; imponer un máximo arbitrario de página agregaría un límite funcional no documentado.

## Persistencia y migración

- **Decisión**: Usar PostgreSQL, pgvector y Drizzle con un cliente Drizzle compartido (sin `pg.Pool` explícito). Una migración versionada habilitará `vector` antes de crear la tabla `phrases` con el esquema físico completo aprobado. F001 seleccionará solo `id`, `text` y `created_at`, además de contar todas las frases.
- **Motivo**: B05 fija la tecnología y el esquema, incluidos `embedding vector(384)` y columnas del modelo no nulas aunque F001 no las lea. El Docker Compose de la raíz ya ofrece pgvector y volumen persistente.
- **Alternativas consideradas**: Datos en memoria o una tabla reducida para F001 impedirían consultar frases reales o respetar el esquema. `phrase_validations` no aporta valor a esta funcionalidad.

## Consistencia y orden

- **Decisión**: Ordenar por `created_at DESC, id DESC`, paginar con `LIMIT/OFFSET` validado y calcular `totalPages = ceil(total/limit)`, o cero si no hay filas. Nota (implementación): conteo y filas son dos consultas secuenciales sin transacción. Original: procurar que el conteo y las filas compartan una vista de lectura dentro de una respuesta. No prometer estabilidad entre solicitudes.
- **Motivo**: La especificación y B05 fijan orden y paginación. El identificador desempata fechas iguales; una vista común evita metadatos contradictorios si ocurre una inserción entre consultas.
- **Alternativas consideradas**: Paginación por cursor u orden configurable cambiarían el contrato. Un índice compuesto sin medición sería prematuro para la escala local de aceptación.

## Validación HTTP y errores

- **Decisión**: Usar `ValidationPipe` global con `whitelist` y `forbidNonWhitelisted`, conversión controlada de query, un filtro compartido Problem Details. Traducir fallos de conexión, SQL y restricciones de base de datos a `DATABASE_ERROR` 500 y ocultar fallos inesperados mediante `INTERNAL_ERROR` 500.
- **Motivo**: Se retira el límite de solicitudes por decisión del usuario; F001 contempla 400 y 500. Una consulta fallida no puede presentarse como lista vacía.
- **Alternativas consideradas**: Los errores predeterminados de Nest o capturar fallos y devolver vacío incumplirían el contrato.

## Configuración y comprobación

- **Decisión**: Documentar `DATABASE_URL` y las variables HTTP de F001 con ejemplos locales seguros. Validarlas al iniciar y cerrar el pool al terminar. Añadir pruebas unitarias próximas al código, E2E HTTP con comportamiento controlado del repositorio y comprobación manual posterior a la migración en PostgreSQL.
- **Motivo**: El proyecto inicial carece de configuración y migraciones de base de datos. La constitución exige ambas capas automatizadas; B05 requiere comprobar migraciones y consultas reales.
- **Alternativas consideradas**: Solo usar dobles no detectaría errores SQL o de migración. Un nuevo entorno automatizado de base de datos aún no está justificado.

## Precedencia documental

- **Decisión**: Seguir la ubicación posterior `apps/backend` de B07, en vez de los ejemplos anteriores `apps/api` o pnpm workspaces. Seguir el requisito E2E de la constitución local frente al mínimo unitario anterior de B07.
- **Motivo**: B07 actualiza expresamente la ubicación física; la constitución gobierna los cambios actuales del backend.
- **Alternativas consideradas**: Copiar árboles anteriores u omitir E2E entraría en conflicto con el repositorio vigente.
