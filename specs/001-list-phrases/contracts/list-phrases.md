# Contrato HTTP: F001 — Listado de frases

Fuente canónica: `docs/03-architecture/openapi.yaml` de la raíz del repositorio, operación `listPhrases`. Este documento registra la superficie de implementación y aceptación de F001 sin sustituir esa fuente.

## Solicitud

`GET /api/v1/phrases` no requiere autenticación ni cuerpo. Parámetros opcionales:

| Clave | Valor admitido | Predeterminado |
| --- | --- | --- |
| `page` | Entero `>= 1` (se convierte con `Number()`; p. ej. `1e2` equivale a 100) | `1` |
| `limit` | Entero entre `1` y `100` (misma conversión) | `20` |

Se responde 400 ante claves desconocidas o duplicadas, cadenas vacías, signos, fracciones, notación exponencial, valores no numéricos, cero, `limit` fuera de rango o valores que no puedan procesarse sin pérdida de precisión. Los predeterminados se aplican solo a claves omitidas.

## Respuesta correcta

Estado `200`, tipo de contenido `application/json`:

```json
{
  "data": [
    {
      "id": "123e4567-e89b-42d3-a456-426614174000",
      "text": "Me gusta viajar a Cusco",
      "createdAt": "2026-10-21T19:02:00.000Z"
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 }
}
```

Cada elemento contiene exactamente `id` (UUID), `text` y `createdAt` (fecha y hora con zona). El orden es fecha de creación descendente e identificador descendente en empates. Sin frases, la consulta predeterminada devuelve `data=[]`, `page=1`, `limit=20`, `total=0` y `totalPages=0`. Una página válida posterior a la última devuelve `data=[]`, la página solicitada y los totales reales. No aparecen texto normalizado, embedding, modelo ni datos de validación.

## Errores

Todos usan `application/problem+json` con `title`, `status`, `detail` y `code` obligatorios, y `errors: [{field, messages: string[]}]` opcional para validación. Cada campo agrupa sus mensajes en un arreglo. El estado HTTP coincide con `status`. No se exponen SQL, trazas, cadenas de conexión ni secretos.

| HTTP | `code` | Causa |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | Parámetro inválido o desconocido |
| 500 | `INTERNAL_ERROR` | Fallo inesperado del servidor |
| 500 | `INVALID_PHRASE` | Identidad, metadatos o fecha de una frase persistida inválidos; mensaje público del dominio |
| 500 | `INVALID_PHRASE_TEXT` | Texto de una frase persistida inválido; mensaje público del dominio |
| 500 | `INVALID_EMBEDDING` | Embedding inválido detectado durante el listado; `detail` contiene el mensaje público del error de dominio |
| 500 | `DATABASE_ERROR` | Fallo de conexión, SQL o restricciones durante la consulta |
| 404 / 5xx otros | `HTTP_ERROR` | Cualquier otra `HttpException` (p. ej. ruta inexistente; `detail`: «No se pudo completar la solicitud.») |

Ejemplo ilustrativo de validación:

```json
{
  "title": "Bad Request",
  "status": 400,
  "detail": "Los parámetros de la solicitud no son válidos.",
  "code": "VALIDATION_ERROR",
  "errors": [{ "field": "page", "messages": ["page must not be less than 1"] }]
}
```

Los clientes deben usar `status`, `code` y `errors` en vez de interpretar el texto de `detail`. El valor `title` del ejemplo sigue la respuesta aprobada en OpenAPI.

`buildProblemDetail` centraliza la construcción para los filtros global y de dominio. No incluye `timestamp` ni `traceId`. El cambio de `message` a `messages` requiere que los clientes lean el arreglo de mensajes por campo.

El controlador registra `InvalidEmbeddingFilter`, basado en `DomainExceptionFilter`, para traducir `InvalidEmbeddingError`. El listado no recibe embeddings del cliente: este error conserva HTTP 500, pero ahora devuelve un código específico y su mensaje público en lugar de `INTERNAL_ERROR` y el mensaje genérico. Es una ampliación de los códigos de respuesta; los clientes deben seguir admitiendo códigos desconocidos. Los errores inesperados permanecen bajo el filtro global y no exponen su mensaje original.

## Decisiones de revisión — 2026-10-22

Se conservan los mappers y la reconstrucción del agregado completo. Los tres errores concretos de dominio son `InvalidPhraseError`, `InvalidPhraseTextError` e `InvalidEmbeddingError`, cada uno con un filtro HTTP específico registrado en el controlador. Todos devuelven 500: el listado no recibe campos de frase del cliente. Sus mensajes describen la regla sin incluir el contenido rechazado. Los clientes deben admitir los nuevos códigos `INVALID_PHRASE` e `INVALID_PHRASE_TEXT`.

Los fallos de conexión, SQL y restricciones se traducen a 500/`DATABASE_ERROR` con el mensaje «Ocurrió un error de base de datos.». Los repositorios generan `DatabaseError` con su causa original, y el filtro global la registra una sola vez junto al stack.

Se mantiene la conversión numérica actual de la query: la validación léxica decimal estricta queda pospuesta. Por ejemplo, `page=1e2` se convierte a 100; no se añade comprobación de entero seguro en esta revisión.
