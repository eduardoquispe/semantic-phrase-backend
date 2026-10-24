# Implementation Plan: F003 — Registro de Frases con Confirmación HITL

**Feature**: `003-register-phrases-hitl` | **Date**: 2026-10-22 | **Spec**: [spec.md](spec.md)

**Branch**: Git permanece en `main`, como indica la especificación. `setup-plan.sh` resuelve `BRANCH=003-register-phrases-hitl` como identificador de funcionalidad; no se ha creado una rama.

**Input**: `specs/003-register-phrases-hitl/spec.md`. Instrucciones adicionales: validaciones solo necesarias, sin sobreingeniería, respetar arquitectura actual y mantener código fácil de leer y enlazar.

## Summary

`CreatePhraseUseCase` lee y comprueba el comprobante, construye `Phrase` con UUID y fecha nuevos y los datos almacenados, llama a `PhraseRepositoryPort.save(phrase)` y después a `PhraseValidationRepositoryPort.update(id, { consumedAt })`. Devuelve la frase tras ambas llamadas; el contrato 201 permanece igual.

Sin transacción ni compensación: si falla el INSERT no se consume; si falla el consumo se propaga el error y permanece la frase. No se garantiza registro único concurrente. Esta decisión autorizada sustituye los requisitos transaccionales anteriores y las referencias compartidas. Sin migraciones ni nuevas dependencias.

## Technical Context

**Language/Version**: TypeScript 5.7, NestJS 11; runtime Node.js compatible con la aplicación existente.

**Primary Dependencies**: Drizzle ORM 0.45.4, pg 8.23, class-validator 0.15, class-transformer 0.5, `ConfigurationPort` (adaptador sobre ConfigService) y pnpm existentes. LangChain/TEI sigue siendo dependencia de F002; registro no lo invoca.

**Storage**: PostgreSQL + pgvector, tablas existentes `phrases` y `phrase_validations`; vector de 384 componentes. Un cliente Drizzle compartido mediante `DatabaseProvider`.

**Testing**: Jest/ts-jest, pruebas cercanas y Supertest HTTP con `configureApp`; pruebas de orden, construcción, rechazos y fallos de ambas escrituras.

**Target Platform**: Servicio Node.js con PostgreSQL/pgvector del despliegue actual.

**Project Type**: Web service REST; aplicación backend independiente.

**Performance Goals**: Sin objetivo nuevo de latencia. Registro solo hace persistencia local; los 5 segundos de F002 no se trasladan a esta operación.

**Constraints**: Escrituras secuenciales sin unicidad concurrente; expiración inclusiva; booleano estricto; texto original de 1–280 puntos de código; sin nueva inferencia, normalización del vector, búsqueda ni evaluación de umbral; lectura histórica hasta 500 intacta.

**Scale/Scope**: Una operación nueva sobre dos tablas existentes de la colección compartida. Sin límite global de solicitudes, auditoría permanente ni FK entre frase y validación.

No quedan decisiones técnicas por aclarar; justificaciones y fuentes en [research.md](research.md).

## Constitution Check

| Principio | Antes de Phase 0 | Después de Phase 1 |
| --- | --- | --- |
| I. Arquitectura modular hexagonal | PASS: ampliar `phrases`; aplicación depende de puertos | PASS: dos repositorios Drizzle existentes; sin ORM/DTO en aplicación ni framework en dominio |
| II. Contratos explícitos | PASS: spec aprobada con Q1–Q3 | PASS: contrato local completo y cambios compartidos delimitados en `contracts/README.md`; sincronización previa a código HTTP |
| III. Comportamiento probado | PASS: plan exige unitarias y HTTP | PASS: escenarios y comandos en quickstart, verificación de persistencia parcial con dobles |
| IV. Dependencias simples | PASS: reutilizar implementación F001/F002 | PASS: dos puertos de repositorio existentes, reglas de aplicabilidad como métodos de la entidad `PhraseValidation`, sin capas genéricas |
| V. Configuración y secretos | PASS: configuración existente | PASS: reutilizar `AI_MODEL` y `AI_EMBEDDING_VERSION`; sin variable o secreto nuevo |

No hay excepciones constitucionales. Q1-A es una excepción aprobada al brief sobre auditoría, no a la constitución. La discrepancia con OpenAPI compartido queda documentada como trabajo obligatorio de sincronización antes de implementar el endpoint; no se considera ya corregida.

## Project Structure

### Documentation (this feature)

```text
specs/003-register-phrases-hitl/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/
    ├── README.md
    └── create-phrase.openapi.yaml
```

`tasks.md` generado mediante `speckit-tasks`; implementación completada con evidencia en `quickstart.md`.

### Source Code (backend root; diseño, no archivos creados)

```text
src/modules/phrases/
├── application/
│   ├── errors/phrase-registration.error.ts
│   ├── ports/inbound/create-phrase.port.ts
│   ├── ports/outbound/phrase-validation-repository.port.ts  # ampliar lectura
│   ├── ports/outbound/phrase-repository.port.ts             # añadir save
│   └── use-cases/create-phrase.use-case.ts
├── infrastructure/
│   ├── http/
│   │   ├── controllers/phrases.controller.ts               # añadir POST
│   │   ├── dtos/create-phrase-request.dto.ts
│   │   ├── dtos/create-phrase-response.dto.ts
│   │   ├── filters/phrase-registration.filter.ts
│   │   └── mapper/phrases.mapper.ts
│   └── persistence/drizzle/
│       ├── phrase/                                        # conservar repositorio, modelo y mapper
│       ├── phrase-validation/                             # ampliar repositorio y mapper
└── phrases.module.ts

test/phrase-registration.e2e-spec.ts
```

Pruebas unitarias junto a los componentes afectados. No reproducir árboles antiguos de `apps/api` ni directorios `infrastructure/outbound` de los documentos de arquitectura.

**Structure Decision**: nombres enlazados al flujo existente: `CreatePhrasePort → CreatePhraseUseCase → PhraseValidationRepositoryPort / PhraseRepositoryPort → adaptadores Drizzle`. Registrar `CreatePhrasePort` con `useExisting` y el adaptador con `useClass` en `PhrasesModule`. `AppModule` y `configureApp` no necesitan cambios funcionales.

## Phase 0 — Research

Decisiones actualizadas en [research.md](research.md): dos escrituras independientes y comprobaciones en aplicación.

## Phase 1 — Design

### Flujo de aplicación y persistencia

1. El DTO valida el body con la configuración HTTP actual (la query no se declara y se ignora). `CreatePhraseUseCase` reutiliza `PhraseText.forValidation`, recupera `findById(validationId)` y comprueba aplicabilidad en línea con los métodos de la entidad `PhraseValidation` (`isConsumed`, `isExpired`, `matches`, `isCompatibleWith`, `needsConfirmation`), en este orden: existencia, consumida, expirada, texto, modelo, confirmación.
2. `findById` devuelve la entidad `PhraseValidation` (no existe una proyección `StoredPhraseValidation`); el mapper conserva `requiresConfirmation`, `normalizedText`, `consumedAt`, modelo y vector persistidos.
3. El modelo activo se construye en el constructor de `CreatePhraseUseCase` con `getOrThrow('AI_MODEL')` y `getOrThrow('AI_EMBEDDING_VERSION')` (sin token `REGISTRATION_MODEL`) y la compatibilidad se comprueba en aplicación.
4. Construir Phrase con UUID v4 y fecha nueva, copiando original, normalizado, embedding y modelo conservados.
5. Esperar `phrases.save(phrase)`: INSERT normal mediante DrizzlePhraseMapper.
6. Esperar `validations.update(id, { consumedAt: new Date() })`: UPDATE parcial por id, usado para consumedAt en registro. Conservar el INSERT de nuevas validaciones.
7. Retornar Phrase. Propagar errores sin compensación; no volver a comprobar la fila ni imponer exclusividad concurrente.

### Validaciones y errores mínimos

- Reutilizar `IsValidPhraseText` en el DTO y `PhraseText.forValidation` en aplicación: misma regla que F002, sin otro validador de texto. Mantener el constructor histórico de 500 para lectura.
- UUID v4 obligatorio mediante `IsUUID('4')`. `confirmed` usa `ValidateIf(value !== undefined)` e `IsBoolean`; no `IsOptional` porque también omite null, ni coerción `Type(() => Boolean)`.
- No hay DTO de query: los parámetros de consulta no declarados se ignoran. `forbidNonWhitelisted` rechaza campos ajenos en el body.
- Un único error de aplicación `PhraseRegistrationError` con motivo tipado para referencia, mismatch y conflictos; sin estados HTTP. El motivo `INCOMPATIBLE_MODEL` se traduce a 409; un fallo inesperado llega al 500 seguro existente.
- Un filtro de registro, aplicado solo al método POST, traduce motivos y `BadRequestException` del DTO. Si los errores de campos señalan `validationId`, usa `INVALID_VALIDATION_ID`; el resto mantiene `VALIDATION_ERROR` y `errors[].messages[]`. No alterar globalmente la clasificación 400 de F001/F002. Reutilizar builder y formato compartidos.
- Reutilizar `InvalidValidationTextFilter` en POST para el error de `PhraseText`; las lecturas GET conservan sus filtros de datos persistidos. `DATABASE_ERROR` se traduce globalmente con el mecanismo existente; ningún filtro local debe absorber errores técnicos ajenos.

### Verificación y compatibilidad

Los artefactos [data-model.md](data-model.md), [contracts/README.md](contracts/README.md), [create-phrase.openapi.yaml](contracts/create-phrase.openapi.yaml) y [quickstart.md](quickstart.md) definen datos, contrato, sincronización y escenarios verificables. Cubrir reglas y mapeos mediante unitarias, frontera HTTP completa con `configureApp` y regresión F001/F002. Verificar fallos de cada guardado y persistencia parcial; no se prometen rollback, exclusividad ni verificación tras esperas.

## Complexity Tracking

Sin violaciones. Cada pieza nueva responde a registro, lectura de validación o traducción HTTP; no se introducen UnitOfWork, reloj inyectable, repositorios genéricos, nuevas jerarquías de VOs ni servicios para copiar propiedades.
