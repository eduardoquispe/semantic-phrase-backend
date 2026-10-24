# Data Model — F003

## Frase definitiva (`phrases`)

Se reutilizan `Phrase`, sus objetos de valor y `DrizzlePhrasesModel`.

| Campo | Tipo lógico | Procedencia/regla |
| --- | --- | --- |
| id | UUID v4 | Nuevo al registrar; independiente de validationId |
| text | PhraseText | Original exacto de la validación, 1–280 puntos de código para nuevas creaciones |
| normalizedText | string | Copia del normalizado almacenado por F002 |
| embedding | Embedding, 384 componentes | Mismos valores almacenados, sin inferencia ni nueva normalización |
| modelId / modelVersion | string | Copia de la validación, compatible con configuración activa |
| createdAt | Date con zona al serializar | Fecha nueva del registro, no fecha de la validación |

Respuesta HTTP solo id, text, createdAt. La lectura histórica conserva hasta 500 puntos de código. No existe unicidad textual ni asociación persistente con validationId.

## Validación temporal (`phrase_validations`)

Esquema existente sin migración. F003 no crea validaciones ni modifica expiración/alerta.

| Campo | Tipo lógico | Uso en registro |
| --- | --- | --- |
| id | UUID v4 | Lookup y actualización del consumo |
| text / normalizedText | string | Igualdad estricta del original y copia a frase |
| embedding | vector(384) | Fuente de representación semántica definitiva |
| modelId / modelVersion | string | Igualdad exacta con modelo activo |
| requiresConfirmation | boolean | Autoridad HITL almacenada, no recalcular desde score/umbral |
| createdAt / expiresAt | fecha con zona | Vigencia de F002; `now >= expiresAt` rechaza |
| consumedAt | fecha con zona o null | Único cambio persistente del comprobante al registrar |
| matchedPhraseId / similarityScore | UUID o null / número o null | Permanecen intactos; no se consultan ni exponen en registro |

No hay FK a la frase definitiva. La limpieza manual de una validación no afecta frases. No se conserva obligatoriamente confirmed, candidata ni decisión histórica por frase.

## Proyección de lectura y puertos de aplicación

`findById` devuelve la entidad `PhraseValidation` mediante el mapper existente, sin exponer filas ni tipos ORM.

- `findById(id: string): Promise<PhraseValidation | null>` mantiene la lectura del puerto temporal.
- `save(validation: PhraseValidation): Promise<void>` realiza exclusivamente INSERT mediante el mapper existente.
- `CreatePhraseInput`: text, validationId y confirmed opcional. `CreatePhrasePort.execute` retorna `Phrase` como resultado de aplicación.
- `PhraseRegistrationPort.register(phrase: Phrase, validationId: string, consumedAt: Date): Promise<void>`: en una transacción, UPDATE condicional de `consumed_at` (solo si es nulo) e INSERT de la frase. Si el UPDATE no afecta filas lanza `PhraseRegistrationError('VALIDATION_ALREADY_USED')` y revierte. El caso de uso construye Phrase y llama una sola vez al puerto.

## Reglas mínimas

1. Texto real, 1–280 puntos de código del original, trim no vacío, sin Unicode Cc. Admitir signos/emojis y conservar espacios externos. Reutilizar `PhraseText.forValidation` y el validador HTTP F002.
2. validationId UUID v4 obligatorio; inexistente no autoriza ni permite inferir historia.
3. confirmed ausente equivale a false; presente exige booleano real. true solo satisface la confirmación, no las otras reglas.
4. Original idéntico mediante igualdad estricta. Normalizar el texto recibido no permite cambiarlo.
5. Modelo/versión deben coincidir con configuración activa. No verificar identidad remota ni repetir cómputo.
6. Consumo nulo, vigencia estricta y confirmación cuando el booleano conservado lo exija. Comprobar el estado leído en aplicación antes de escribir. Orden real: existencia, consumida, expirada, texto, modelo, confirmación.

## Transiciones

| Estado derivado inicial | Evento | Resultado |
| --- | --- | --- |
| Pendiente vigente | Solicitud aplicable/autorizada | Transacción: UPDATE condicional de consumedAt + INSERT de frase |
| Pendiente vigente con alerta | confirmed omitido/false | 409 CONFIRMATION_REQUIRED; conserva fila |
| Pendiente vigente | Texto distinto | 400 PHRASE_MISMATCH; conserva fila |
| Pendiente vigente | Modelo incompatible | 409 INCOMPATIBLE_MODEL; conserva fila |
| Pendiente y now >= expiresAt | Registro | 409 VALIDATION_EXPIRED; conserva fila |
| Consumida | Registro que lee consumo previo | 409 VALIDATION_ALREADY_USED; ninguna frase nueva |
| Inexistente/eliminada | Registro | 400 INVALID_VALIDATION_ID |
| Pendiente vigente | Fallo de UPDATE o INSERT | Rollback: no se guarda la frase ni se consume; error propagado; reintento seguro |
| Pendiente vigente | Consumida por solicitud concurrente antes del UPDATE | Rollback; 409 VALIDATION_ALREADY_USED; ninguna frase nueva |
| Pendiente | Abandono sin solicitud | Sin transición de F003; vence lógicamente según F002 |

El registro es atómico (una transacción) y el consumo condicional garantiza una única frase por comprobante aun con concurrencia. Se usan UUID y fechas nuevos, con reloj de aplicación. No se vuelve a leer el comprobante durante las escrituras. No hay columna status, cancelación, renovación ni idempotencia garantizada.
