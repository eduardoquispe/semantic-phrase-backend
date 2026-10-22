# Plan de implementación: F001 — Listado de frases registradas

**Rama**: `feat/phrases-list` | **Fecha**: 2026-10-21 | **Especificación**: [spec.md](spec.md)

**Entrada**: `specs/001-list-phrases/spec.md`. El script `setup-plan.sh` informó el identificador `001-list-phrases`; la rama Git real es `feat/phrases-list`.

## Resumen

Implementar `GET /api/v1/phrases` para consultar la lista compartida sin autenticación. La respuesta contendrá solo `id`, `text` y `createdAt`, en orden `created_at DESC, id DESC`, con paginación estricta, total exacto y errores Problem Details. Incorporar la infraestructura mínima de lectura con PostgreSQL, pgvector y Drizzle sobre el esquema aprobado de `phrases`. F001 no crea ni valida frases.

## Contexto técnico

**Lenguaje y versiones**: TypeScript 5.7, Node.js 22.12 en el entorno local y NestJS 11. Durante la implementación, `package.json` y `pnpm-lock.yaml` fijarán las versiones efectivas.

**Dependencias principales**: NestJS, Jest, ts-jest y Supertest ya presentes; agregar Drizzle ORM/Kit, `pg`, `class-validator`, `class-transformer` para los usos concretos de F001. Comprobar compatibilidad de versiones al instalarlas.

**Persistencia**: PostgreSQL con pgvector (`pgvector/pgvector:pg17` en el `compose.yaml` de la raíz), Drizzle ORM, migraciones versionadas y un `pg.Pool` compartido. F001 lee únicamente la tabla `phrases`.

**Pruebas**: Unitarias Jest junto al código para validación de parámetros y caso de uso; pruebas HTTP E2E en `test/*.e2e-spec.ts` con dobles del repositorio; comprobación manual con PostgreSQL local para migración y consulta real.

**Plataforma objetivo**: Servicio HTTP local Node.js en el puerto 3000 y PostgreSQL del Docker Compose de la raíz.

**Tipo de proyecto**: Servicio REST NestJS; proyecto pnpm independiente en `apps/backend`.

**Restricciones**: Lista compartida sin autenticación; máximo 100 filas por respuesta; orden determinista; parámetros decimales estrictos y rechazo de claves desconocidas; ninguna columna privada ni secreto en respuestas; sin migración ni carga de datos automática al iniciar.

**Alcance**: Solo el GET de F001. Conjuntos de aceptación de 0, 1, 20, 21 y 45 frases. No se promete una vista inmutable entre solicitudes de páginas distintas.

## Comprobación de la constitución

*Puerta de calidad: superada antes de la investigación y revisada tras el diseño.*

| Principio | Comprobación del diseño | Resultado |
| --- | --- | --- |
| I. Arquitectura hexagonal modular | `PhrasesModule` contiene caso de uso, puertos y adaptadores HTTP/Drizzle; aplicación desconoce SQL y HTTP. | Cumple |
| II. Contratos API explícitos | [contracts/list-phrases.md](contracts/list-phrases.md) registra entradas, salida y errores de F001 conforme al OpenAPI canónico. | Cumple |
| III. Comportamiento probado | Pruebas unitarias junto al código y E2E HTTP; ejecutar compilación y ambas suites. | Cumple |
| IV. Dependencias simples | Un adaptador de repositorio y un proveedor de conexión; sin repositorio genérico, Unit of Work, IA ni mappers innecesarios. | Cumple |
| V. Configuración y secretos | Documentar `DATABASE_URL` y las variables HTTP de F001 en `.env.example`, validarlas al inicio y mantener `.env` ignorado. | Cumple |

El documento B07 anterior establecía pruebas unitarias como mínimo inicial. La constitución y las instrucciones actuales del backend exigen además pruebas E2E para cambios HTTP; F001 incluirá ambas. No hay excepción a la constitución.

## Estructura del proyecto

### Documentación de la funcionalidad

```text
specs/001-list-phrases/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/list-phrases.md
```

### Código previsto desde la raíz del backend

```text
src/
├── main.ts                                      # prefijo API y configuración HTTP global
├── app.module.ts                                # composición de PhrasesModule
├── modules/phrases/
│   ├── domain/
│   │   ├── entities/phrase.entity.ts             # agregado completo, independiente del listado
│   │   ├── factory/phrase.factory.ts             # creación y reconstitución desde primitivos
│   │   ├── value-objects/                        # PhraseText y Embedding
│   │   └── errors/                               # invariantes sin conceptos HTTP
│   ├── application/
│   │   ├── models/phrase-list-item.model.ts       # proyección de lectura
│   │   ├── ports/inbound/list-phrases.port.ts
│   │   ├── ports/outbound/phrase-repository.port.ts
│   │   └── use-cases/list-phrases.use-case.ts
│   ├── infrastructure/
│   │   ├── inbound/http/
│   │   │   ├── controllers/phrases.controller.ts
│   │   │   └── dtos/list-phrases.query.dto.ts
│   │   └── outbound/persistence/
│   │       ├── schema/phrases.schema.ts
│   │       └── repositories/drizzle-phrase.repository.ts
│   └── phrases.module.ts
└── shared/infrastructure/
    ├── database/                                # pool, proveedor y cierre
    └── http/filters/                            # respuestas Problem Details
drizzle/migrations/                              # extensión vector antes de la tabla
drizzle.config.ts
test/                                            # pruebas HTTP E2E
```

Las pruebas unitarias irán junto al código que cambia. El caso de lectura usa `PhraseListItem`, una proyección de aplicación con fecha tipada, y un resultado paginado pequeño. El caso de uso convierte la fecha al formato público. La consulta no reconstruye el agregado completo `Phrase`, definido por separado en `domain/entities/` con `PhraseText`, `Embedding`, metadatos del modelo e invariantes propias.

**Decisión de estructura**: `apps/backend` es la raíz del proyecto y `PhrasesModule` es la raíz de la capacidad. El proveedor de conexión y el filtro HTTP son preocupaciones técnicas transversales. `src/main.ts` establece el prefijo global `/api` y cada controlador versionado define su segmento `v1`; el controlador de frases expone así `GET /api/v1/phrases`. La ruta inicial `GET /` queda excluida del prefijo y conserva su contrato.

## Fase 0: Investigación

Las decisiones están en [research.md](research.md). La arquitectura aprobada y el estado del repositorio resuelven tecnología, persistencia, seguridad y pruebas. No quedan aspectos que requieran aclaración.

## Fase 1: Diseño

Consultar [data-model.md](data-model.md), [contracts/list-phrases.md](contracts/list-phrases.md) y [quickstart.md](quickstart.md).

- Validar léxicamente los parámetros decimales antes de convertirlos a números; rechazar claves duplicadas y desconocidas, y valores que pierdan precisión. Aplicar valores predeterminados solo cuando falte la clave. Activar `ValidationPipe` al incorporar la paginación en US2; completar la respuesta Problem Details de validación en US3.
- Obtener total y filas mediante el puerto de repositorio. Usar una misma vista de lectura de base de datos para ambos valores cuando sea viable; no se garantiza una vista común entre solicitudes HTTP distintas.
- Traducir indisponibilidad conocida de base de datos a 503 y fallos inesperados a 500 seguro. El filtro compartido producirá `application/problem+json` para 400, 500 y 503.
- Centralizar el cuerpo en `buildProblemDetail`, con contratos `ProblemDetail` y `ProblemFieldError`; validación agrupada en `messages: string[]`, sin `timestamp` ni `traceId`. Registrar `InvalidEmbeddingFilter` en el controlador mediante `@UseFilters`, usando la base compartida `DomainExceptionFilter`; devolver 500/`INVALID_EMBEDDING` con su mensaje público porque el listado no recibe embeddings del cliente.
- Mantener `docs/03-architecture/openapi.yaml` de la raíz como contrato canónico. El documento de F001 es una guía de implementación.
- Crear el índice `(created_at DESC, id DESC)` solo si un plan de consulta lo justifica. El índice aprobado de `normalized_text` forma parte de la migración del esquema completo.

**Revisión de la constitución tras el diseño**: Cumple. La tecnología queda en los adaptadores, los contratos HTTP y de datos son explícitos, se planifican ambas capas de pruebas y no se agregan abstracciones de negocio sin uso.

## Incorporación del dominio completo

Refinar la construcción mediante `PhraseFactory.create` (normalización derivada) y `reconstitute` (normalización persistida obligatoria), sin efectos externos. Extraer la regla UUID v4 al value object inmutable `PhraseId`; exigirlo en `PhraseProps` y conservar el getter público string. La entidad confía en los value objects tipados, sin conversiones de primitivos ni comprobaciones redundantes de sus clases. Validar metadatos y fecha directamente en el constructor, sin helpers adicionales, y aceptar vectores de solo lectura en `Embedding`. Verificar estas reglas con pruebas junto al código y mantener el listado desacoplado del agregado.

Implementar únicamente dominio y sus pruebas, manteniendo intactas la proyección de lectura y las capas de aplicación e infraestructura. `Phrase` recibe UUID v4, fecha válida, `PhraseText`, `normalizedText` explícito y no vacío, `Embedding` y metadatos del modelo obligatorios. La entidad conserva el texto normalizado recibido sin recalcularlo para permitir reconstruir valores persistidos. `PhraseText` conserva el original, limita a 500 puntos de código Unicode y rechaza texto vacío tras trim y todo control Unicode `Cc`, incluidas tabulación, LF y CR. La normalización pura y única aplica trim, minúsculas y compresión de espacios `\s`, preservando tildes y puntuación. `Embedding` encapsula 384 números finitos sin normalizarlos; el generador conserva la responsabilidad de verificar norma L2.

Proteger el estado mediante copias defensivas e inmutabilidad y expresar violaciones con errores de dominio locales sin HTTP ni datos sensibles. No agregar dependencias, puertos, DTOs, mappers, registro ni validación semántica. Verificar invariantes, límites Unicode, controles e inmutabilidad con Jest y ejecutar compilación y suite unitaria completa (`pnpm test --runInBand`). Los detalles del modelo están en `data-model.md` y las tareas adicionales en T031–T035.

## Ajustes de implementación aprobados — 2026-10-22

Prevalecen las decisiones de revisión de `spec.md`. Conservar las carpetas actuales `infrastructure/http/` e `infrastructure/persistence/drizzle/`; `drizzle.config.ts` debe apuntar a `src/modules/phrases/infrastructure/persistence/drizzle/drizzle-phrases.model.ts`. No mover adaptadores ni generar migraciones por este ajuste.

Mantener el constructor público de `Phrase` y ambos mappers. El constructor de la entidad compone `NormalizedPhraseText`, `PhraseModel` y `PhraseCreatedAt`, sin validadores genéricos ni bucles. Los getters públicos y `PhraseProps` conservan sus tipos existentes. Las validaciones usan `InvalidPhraseError`; no crear nuevos errores por campo. Registrar `InvalidPhraseTextFilter` junto a los filtros existentes de frase y embedding, todos con HTTP 500. Los errores originales PostgreSQL continúan como 500 genérico. Agregar únicamente pruebas de casos de uso y corregir las suites existentes.
