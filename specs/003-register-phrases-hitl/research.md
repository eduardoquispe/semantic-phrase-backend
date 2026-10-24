# Research — F003

Investigación completada el 2026-10-22. Base: implementación actual, spec aprobada Q1–Q3, constitución y documentos 02/04/05/06/07 de `../../docs/03-architecture/`. No quedan aclaraciones pendientes.

## 1. Puerto de registro atómico

**Decision**: Puerto de salida `PhraseRegistrationPort.register(phrase, validationId, consumedAt)` con adaptador Drizzle que abre una transacción: UPDATE condicional de `consumed_at` (solo si es nulo) e INSERT de la frase. Se retiran `PhraseRepositoryPort.save` y `PhraseValidationRepositoryPort.update`, que quedan sin uso.

**Rationale**: Evita persistencia parcial (frase guardada con comprobante sin consumir) y cierra la carrera de duplicados. La operación toca dos tablas; un puerto propio mantiene a cada repositorio dueño de su tabla y evita exponer `tx` al caso de uso. Sustituye la simplificación de dos escrituras secuenciales.

## 2. Leer el resultado conservado sin recalcularlo

**Decision**: `findById` devuelve la entidad `PhraseValidation` (la proyección `StoredPhraseValidation` inicialmente prevista no se implementó), mapeada explícitamente. Incluye datos de registro y estado; el mapper convierte vector/fecha y usa objetos de valor existentes donde corresponde.

**Rationale**: `PhraseValidation` actual solo sirve para emitir: `consumedAt = null`, alerta recalculada desde match/threshold y normalizado derivado. No representa una fila ya consumida ni conserva una alerta histórica al cambiar umbral. Para registrar no se necesita reconstruir candidata ni score.

**Alternatives considered**: ampliar constructor con varios modos de emisión/restauración o consultar la frase candidata para reconstruir el agregado. No son necesarios para esta consulta; devolver filas Drizzle a aplicación violaría el límite.

## 3. Coordinación en aplicación

**Decision**: Leer y validar el comprobante, construir Phrase y esperar `register(...)`. Retornar al terminar la transacción.

**Rationale**: Si falla cualquier escritura se revierte todo y el error se propaga; el reintento es seguro. Si otra solicitud ya consumió el comprobante, el UPDATE condicional no afecta filas y se devuelve VALIDATION_ALREADY_USED.

## 4. Reloj de aplicación

**Decision**: Comprobar vencimiento inclusivo con Date en aplicación antes de escribir. Asignar createdAt al construir y consumedAt al llamar a `register`. Sin reloj de BD ni nueva comprobación tras bloqueos.

## 5. Compatibilidad de modelo sin inferencia

**Decision**: Comparar exactamente `modelId`/`modelVersion` conservados con `AI_MODEL`/`AI_EMBEDDING_VERSION` ya existentes, suministrados como `PhraseModel` por composición.

**Rationale**: el generador actual obtiene esos mismos valores. Registro no requiere invocar SDK, /info, recalibrar umbral ni validar de nuevo norma del vector. `Embedding` comprueba dimensión/finitud al representar el valor, sin modificarlo. El arranque de F002 permanece igual.

**Alternatives considered**: ampliar `EmbeddingGeneratorPort` con descubrimiento de perfil, hashes nuevos, identidad remota o servicio de compatibilidad. Aumentan alcance sin requisito.

## 6. DTO y traducción HTTP de alcance local

**Decision**: Reutilizar validación de texto F002, UUID v4, booleano opcional estricto y DTO query vacío. Filtro del POST traduce errores de referencia del DTO al código específico; builder compartido para el resto. Un error de aplicación con motivos funcionales evita una clase/filtro por código.

**Rationale**: el factory global actual produce 400 VALIDATION_ERROR para todos los campos; por sí solo no cumple INVALID_VALIDATION_ID. `IsOptional` aceptaría null; `ValidateIf` solo omite undefined. Los filtros GET actuales para texto inválido representan errores de datos persistidos, no entrada del POST.

**Alternatives considered**: sustituir el pipe global, múltiples nuevos validadores propios o lógica HTTP dentro del caso de uso. No son necesarios y arriesgan regresiones.

## 7. Esquema, auditoría y pruebas

**Decision**: Reutilizar tablas/PK/vector existentes; ningún DDL nuevo. Copiar vector y normalizado almacenados sin renormalizar. Consumo temporal sin FK ni auditoría permanente. Unitarias + HTTP exigidas por constitución con pruebas de transacción (orden, rollback y fallos de cada escritura).

**Rationale**: Q1 permite eliminación manual del comprobante sin afectar la frase. El diseño existente ya tiene `consumed_at`; no hace falta historial. El rollback y la exclusividad concurrente los da la transacción con UPDATE condicional.

**Alternatives considered**: tabla de historial, confirmed permanente, índice único textual, Testcontainers o base de integración nueva. Fuera del alcance aprobado.

## 8. Continuidad contractual

**Decision**: Contrato local acotado de diseño y lista precisa de sincronización para OpenAPI/bloque 06 compartidos antes de implementar HTTP. Alinear spec y artefactos con la simplificación autorizada.

**Rationale**: OpenAPI compartido todavía referencia texto 500 y respuesta 429 en creación. Q2 requiere 280/sin límite global. No modificar globalmente PhraseText de lectura ni borrar códigos usados fuera de esta operación.

**Alternatives considered**: cambiar todos los contratos por asociación o implementar antes de sincronizar. Incumplirían compatibilidad y la instrucción explícita del spec.
