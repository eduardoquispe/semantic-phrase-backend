# Contratos F002

[phrase-validations.openapi.yaml](phrase-validations.openapi.yaml) es la proyección de diseño de F002, basada en `../../docs/03-architecture/openapi.yaml` (ruta desde la raíz del backend) y las excepciones HITL de [spec.md](../spec.md). Describe solo la operación de validación; no declara implementados endpoints nuevos ni sustituye el YAML compartido como fuente del servicio completo.

## Alineación previa a implementar

El YAML compartido fue alineado durante T001: validación usa 280 puntos de código, `errors[].messages[]` y respuestas 201/400/500/503. `PhraseText` y las otras operaciones conservan su contrato. La tabla siguiente documenta los cambios aplicados antes de implementar controller/DTO.

| Ubicación en YAML compartido                 | Cambio exigido                                                                                                                                                                           |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ValidatePhraseRequest.properties.text`      | Referenciar esquema nuevo `ValidationPhraseText` con 1–280 puntos de código del original; trim no vacío y sin `Cc`; sin exigir letras                                                    |
| `PhraseText` usado por `CreatePhraseRequest` | Conservar comportamiento contractual existente hasta planificar registro; no cambiar globalmente el componente a 280 como efecto colateral de F002                                       |
| `POST /phrase-validations.responses`         | Solo 201, 400, 500 y 503; quitar 429 de esta operación                                                                                                                                   |
| `POST /phrase-validations.description`       | Explicitar incompatibilidad sin coincidencia textual como 500, colección vacía como éxito; textual prima y sigue requiriendo embedding válido                                            |
| `FieldError`                                 | Reemplazar `message:string` por `messages:string[]`, ambos `field` y `messages` obligatorios; actualizar ejemplos compartidos para representar el formato ya implementado por el backend |
| 503 de validación                            | Documentar solo `AI_UNAVAILABLE`; documentar `DATABASE_ERROR` en 500 para conexión, SQL y restricciones                                                                          |
| Respuesta 201                                | Mantener shape existente; añadir ejemplo vectorial bajo umbral con `requiresConfirmation=false`                                                                                          |

No eliminar 429 de otras operaciones ni cambiar sus contratos en este trabajo por asociación con F002. El backend actual no tiene throttle y F002 no lo añadirá. El cambio de `FieldError` es compartido porque el código existente ya usa `messages[]`; verificar regresión HTTP de F001, sin introducir un segundo formato por ruta. No añadir códigos de guardado al contrato reducido de F002.

Swagger, si se incorpora en otra tarea, debe seguir leyendo el YAML compartido actualizado; este archivo local no inicia una segunda especificación generada por decoradores. No añadir Swagger u otros cambios de bootstrap solo para servir este artefacto de planificación.

## Reglas adicionales comprobables

- Body obligatorio JSON con únicamente `text`; los parámetros de query no declarados se ignoran. Los esquemas expresan forma y máximo; trim y `Cc` requieren validación de ejecución.
- No autenticación, cabecera bearer ni token previo. El UUID temporal viaja en respuesta y luego se usará en el cuerpo del registro de otra funcionalidad.
- Igualdad textual: candidata y score nulo, siempre confirmación. Vector: candidata y coseno incluso bajo umbral. Colección vacía: match nulo y sin confirmación.
- `requiresConfirmation` vectorial usa comparación inclusiva con el umbral configurado. OpenAPI no prueba por sí solo esa regla dependiente de configuración.
- Error `application/problem+json` con estado igual al HTTP, sin `type`, `timestamp`, `traceId`, stack ni detalles de proveedor.
- No errores de token expirado/consumido o confirmación faltante en F002. No historial ni endpoint GET de validaciones.

Validación: revisar referencias locales y ejemplos del YAML, comparar manualmente con spec y ejecutar las pruebas unitarias/HTTP previstas en [quickstart.md](../quickstart.md) durante implementación.

## Transición a inferencia en Docker

La ruta, los campos y los estados posibles 201/400/500/503 se conservan. La unificación de BD cambia la respuesta que antes era 503/`DATABASE_UNAVAILABLE` a 500/`DATABASE_ERROR`; los clientes deben adaptar su manejo de errores. El servicio interno TEI y su identidad se definen en [embeddings-service.md](embeddings-service.md). Fallos de comunicación, HTTP remoto, formato, vector o timeout se traducen a 503 `AI_UNAVAILABLE`; un 429 remoto no añade una respuesta pública 429 ni activa retries.

La transición elimina el pipeline local por completo. La evidencia de alineación del YAML anterior no demuestra conectividad ni compatibilidad del nuevo runtime. Mantener filtro exacto por modelo/versión y comprobar corpus antes de activar; una colección antigua incompatible conserva el 500 aprobado sin reetiquetar vectores. Véanse [research.md](../research.md) y [quickstart.md](../quickstart.md).
