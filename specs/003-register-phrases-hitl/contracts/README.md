# Contrato de registro F003

[create-phrase.openapi.yaml](create-phrase.openapi.yaml) describe el contrato de `POST /api/v1/phrases` aprobado en [spec.md](../spec.md), incluyendo Q1-A/Q2-A/Q3-A. La implementación y su verificación están registradas en quickstart.md; este contrato acotado no sustituye la fuente compartida del servicio.

## Sincronización obligatoria antes de implementar HTTP

Rutas desde la raíz del backend:

| Fuente compartida | Ajuste delimitado |
| --- | --- |
| `../../docs/03-architecture/openapi.yaml`: CreatePhraseRequest.text | Referenciar `ValidationPhraseText` existente (1–280 puntos de código originales, trim no vacío, sin Cc); no reducir el límite histórico de PhraseText globalmente |
| Mismo YAML: CreatePhraseRequest | Conservar solo text, validationId UUID v4 obligatorio y confirmed booleano opcional; aclarar null inválido, ausencia=false |
| Mismo YAML: POST /phrases | Quitar respuesta 429; documentar que no se declara query (se ignora), no límite global, original estricto, sin segunda inferencia y duplicados confirmados permitidos |
| Mismo YAML: errores de creación | Especificar inexistente=400 INVALID_VALIDATION_ID, incompatible=409 INCOMPATIBLE_MODEL; conservar catálogo restante, problems y errors[].messages[] |
| `../../docs/03-architecture/06-api-security.md`: §4.2 y secciones de validación/límites/errores afectadas | Alinear nuevas creaciones a 280, signos/emojis admitidos y sin límite global; referencia inexistente e incompatibilidad según Q3 |

La sincronización T001 se completó durante la implementación con permiso de escritura para los dos documentos compartidos. Conservar respuestas de listado/validación y componentes ajenos a F003.

## Semántica no expresable solo con JSON Schema

- Conteo Unicode por puntos de código originales, trim no vacío y ausencia de controles Cc; preservar el original.
- Los parámetros de query no declarados se ignoran; body con propiedades adicionales rechazado (400).
- UUID v4; ausencia o malformación usa INVALID_VALIDATION_ID. Otros errores DTO usan VALIDATION_ERROR. Cuando se mezclan causas el spec no impone precedencia.
- Leer requiresConfirmation almacenado; solo true real satisface alerta. Normalización equivalente no satisface igualdad original.
- La aplicación comprueba la fila leída antes de escribir; expiración inclusiva. UPDATE condicional de consumedAt e INSERT de frase en una única transacción, sin segunda inferencia.
- Fallos de conexión, SQL o restricciones de BD son 500/`DATABASE_ERROR`; fallos inesperados 500 seguro; modelo/versión incompatible 409 `INCOMPATIBLE_MODEL`. No AI_UNAVAILABLE propio de registro ni endpoint de cancelación.
- Una respuesta perdida no permite repetir éxito con la misma referencia: un consumo previo observado produce ALREADY_USED en el reenvío.
- Si falla cualquier escritura se revierte todo (ni frase ni consumo) y se propaga el error. Solicitudes concurrentes con la misma validación: una tiene éxito y las demás reciben 409 `VALIDATION_ALREADY_USED`.

Ejemplos y catálogo completo están en el YAML; validación ejecutable en [quickstart.md](../quickstart.md).
