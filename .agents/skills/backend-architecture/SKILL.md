---
name: backend-architecture
description: >-
  Implement or review this NestJS backend using its capability-based hexagonal
  architecture and current phrases module conventions. Guides domain objects,
  use cases, ports, HTTP adapters, Drizzle persistence, shared infrastructure,
  composition, and tests. Does not apply to the frontend or define feature
  behavior and API contracts.
---

# Backend architecture

Use `src/modules/phrases/` as the implemented reference: a modular monolith
with hexagonal boundaries and lightweight DDD. Extend the capability that owns
the behavior; create a new module when it has its own rules and vocabulary.
Create only the files the task needs.

Read `.specify/memory/constitution.md` and the current feature's specification
for requirements. Architecture documents live at `../../docs/03-architecture/`
relative to `apps/backend/`. `02-backend-architecture.md` describes logical
boundaries; `07-infrastructure-quality.md` revises physical organization to
independent applications under `apps/`, without pnpm workspaces. Older proposed
trees differ from the implementation: follow current paths when extending code,
and surface substantive conflicts with approved requirements rather than
silently changing behavior.

## Current placement

Paths are relative to `apps/backend/`. This is a map of existing responsibilities,
not a scaffold to reproduce for every capability.

```text
src/
├── main.ts                            # Startup, shutdown hooks, listen
├── configure-app.ts                   # HTTP setup shared with E2E
├── app.module.ts                      # Config, database and capability composition
├── modules/phrases/
│   ├── domain/
│   │   ├── entities/                  # phrase, phrase-validation
│   │   ├── enums/                     # phrase status, validation match
│   │   ├── types/                     # *-props.interface.ts, match type
│   │   ├── value-objects/             # *.value-object.ts
│   │   └── errors/                    # DomainError and invariant failures
│   ├── application/
│   │   ├── errors/                    # Flow failures (not found, registration, collection)
│   │   ├── ports/inbound/             # list, validate, create, delete phrase
│   │   ├── ports/outbound/            # phrase/validation repositories, embedding generator
│   │   └── use-cases/                 # *.use-case.ts (+ spec beside)
│   ├── infrastructure/
│   │   ├── embeddings/                # huggin-face/ adapter (TEI via LangChain), errors/
│   │   ├── http/
│   │   │   ├── controllers/           # phrases, phrase-validations
│   │   │   ├── dtos/
│   │   │   ├── mapper/                # Singular: phrases.mapper.ts
│   │   │   ├── filters/               # Capability-specific error translation
│   │   │   └── validation/            # Custom class-validator rules
│   │   └── persistence/drizzle/
│   │       ├── phrase/                # model, repository, mapper
│   │       └── phrase-validation/     # model, repository, mapper
│   └── phrases.module.ts
└── shared/
    ├── application/
    │   ├── pagination/paginated-result.interface.ts
    │   └── ports/outbound/configuration.port.ts
    └── infrastructure/
        ├── configuration/             # Global ConfigurationModule, NestConfigurationAdapter
        ├── database/                  # DatabaseModule, DatabaseProvider, pg-vector column, errors/
        └── http/
            ├── filters/               # ProblemDetailsFilter, DomainExceptionFilter
            ├── problem-detail/        # Representation and builder
            └── validation/            # Validation exception factory

drizzle/migrations/
specs/                                 # Spec Kit features 001-004
test/                                  # *.e2e-spec.ts, jest-e2e.json, fixtures/
```

Inbound/outbound describe adapter roles but are directory names only under
`application/ports/` in the current implementation. Keep HTTP code under
`infrastructure/http/` and storage code under `infrastructure/persistence/`.
Group Drizzle models, repositories, and mappers together under `drizzle/`;
do not introduce parallel `models/`, `repositories/`, or `mappers/` trees for them.

## Domain

The domain imports no NestJS, HTTP DTOs, ORM models, SQL, or provider SDKs.
Entities protect invariants; value objects hold validation and value semantics.
`Phrase` uses `PhraseId`, `PhraseText`, `Embedding`, `NormalizedPhraseText`,
`PhraseModel`, and `PhraseCreatedAt`; `PhraseValidation` also uses
`SimilarityScore`. Preserve encapsulation and defensive
copying when changing construction or mapping. Add value objects for concrete
rules, not merely to wrap every primitive.

Domain violations extend the capability's `DomainError` in `domain/errors/`
without HTTP statuses. Loading, saving, and external provider contracts belong
in application outbound ports. A pure rule that does not fit an entity may be
a domain service when needed.

## Application and DI contracts

Use cases coordinate operations through outbound ports and return application
results. They do not import HTTP DTOs, concrete repositories, database clients,
or Drizzle types. Current use cases use NestJS `@Injectable()` and constructor
injection; the domain remains framework-independent.

- Inbound ports are abstract classes exposing `execute(...)`. Their files can
  also hold input interfaces and result types, as with `ListPhrasesInput` and
  `ListPhrasesResult`.
- Outbound ports are abstract classes exposing capability-specific operations.
  `PhraseRepositoryPort.list(...)` returns domain entities and a total, not
  database rows. Avoid generic SQL execution contracts.
- Abstract classes are runtime DI tokens. Use cases currently `implements`
  inbound ports; Drizzle repositories `implements` their outbound ports, while
  `HuggingFaceEmbeddingAdapter` and `NestConfigurationAdapter` `extends` theirs.
  An interface alone cannot replace a runtime token.
- Reuse `PaginatedResult<T>` from
  `src/shared/application/pagination/paginated-result.interface.ts` for
  equivalent pagination contracts. The use case computes metadata, the
  repository queries records and their total, and the HTTP mapper shapes
  the public response.

Keep input/result types beside their port when sufficient. `application/errors/` holds flow failures such as `PhraseNotFoundError`; introduce
`application/commands/` only when an operation requires it. Application errors express flow failures without HTTP or driver details.

## HTTP boundary

Controllers inject inbound ports, delegate operations, and map results. DTOs
use `class-validator` and `class-transformer` for transport validation and
conversion. Domain invariants remain in domain objects even if a DTO also
validates input.

`PhrasesMapper` in `infrastructure/http/mapper/` converts application results
into response DTOs, extracting value object values and serializing dates.
Follow this explicit mapping boundary so public responses do not accidentally
expose entity or storage fields. A DTO may be structurally compatible with an
application input; do not create another input class or mapper solely to copy
identical properties.

`configureApp(app)` centralizes the prefix, validation pipe, CORS (fixed origin
`http://localhost:5173`), and global filter.
Both bootstrap and HTTP E2E setup call it. Keep common HTTP configuration there
so tests exercise the server setup. Controllers declare versioned capability
paths (`v1/phrases`, `v1/phrase-validations`); the global `api` prefix is
applied centrally. `configureApp` still passes `exclude: ['/']` for a starter
`GET /` that no longer exists (it returns 404).

Error translation belongs at this boundary:

- Capability filters in `infrastructure/http/filters/` use `@Catch(...)` for
  specific domain or application errors and are attached with `@UseFilters(...)`.
  Most extend shared `DomainExceptionFilter` with status and code; some
  (`PhraseRegistrationFilter`, `InvalidValidationTextFilter`) implement
  `ExceptionFilter` directly.
- Shared `ProblemDetailsFilter` handles other failures globally using
  `application/problem+json`. Reuse the problem-detail builder and validation
  exception factory instead of introducing another error format.
- Controlled technical errors belong in infrastructure. For example,
  `DatabaseError` lives under shared database errors and `ProblemDetailsFilter`
  translates it to 500 `DATABASE_ERROR`. Both Drizzle repositories wrap every
  query in try/catch and throw it.

Choose statuses and response fields from the feature contract. Current list
filters treat invalid persisted domain data as server errors; that status is
not a universal rule for invalid client input in future operations.

## Persistence and composition

`DrizzlePhraseRepository` and `DrizzlePhraseValidationRepository` implement the
outbound contracts and own SQL, ordering, similarity search, and pagination
through `DatabaseProvider`. `*.model.ts` files define storage;
`DrizzlePhraseMapper` and `DrizzlePhraseValidationMapper` reconstruct domain
objects and translate vector/date representations. Keep ORM inference types
in infrastructure. Never expose `db`, `tx`, commit, or rollback to use cases.
When atomic behavior is required, express the operation through a port and
implement its transaction in the adapter.

`DatabaseModule` exports shared `DatabaseProvider`; repositories reuse its
client rather than opening their own pools. The provider reads and validates
`DATABASE_URL` through `ConfigurationPort` (implemented by
`NestConfigurationAdapter` over `ConfigService`) and closes its pool on application
shutdown; `main.ts` enables shutdown hooks. Preserve this lifecycle.

Root `drizzle.config.ts` locates models (`**/*.model.ts`) and writes to `drizzle/migrations/`.
Update schema discovery when adding models needed for migration generation.
Use existing `db:generate` and `db:migrate` scripts for their respective tasks;
generating a migration does not require applying it to a database.

Each `<capability>.module.ts` is its composition root. Follow `PhrasesModule`:

```ts
imports: [DatabaseModule],
controllers: [PhrasesController, PhraseValidationsController],
providers: [
  ListPhrasesUseCase,
  { provide: ListPhrasesPort, useExisting: ListPhrasesUseCase },
  { provide: PhraseRepositoryPort, useClass: DrizzlePhraseRepository },
  { provide: EmbeddingGeneratorPort, useClass: HuggingFaceEmbeddingAdapter },
  // ...other use cases, ports and filters
],
```

`useExisting` aliases the registered use case instance. `app.module.ts`
composes capabilities and global configuration; modules contain no business
rules. Shared code has no capability knowledge: configuration port, database
lifecycle, generic HTTP handling, and pagination contracts can be shared; phrase queries and
invariants stay in `modules/phrases/`. No global `SharedModule` is needed.

## Tests and scope

Place `*.spec.ts` beside the component, including adapter unit tests. Domain
tests construct objects without NestJS. Use-case tests inject outbound port
doubles; controller tests substitute inbound ports. HTTP tests live directly
under `test/` as `*.e2e-spec.ts` and call `configureApp`.

The E2E suites override the repository ports, `EmbeddingGeneratorPort` and
`ConfigurationPort`: they verify
the HTTP/application boundary, not real Drizzle queries, PostgreSQL ordering
or the embeddings service.
Use isolated adapter integration tests when real persistence guarantees need
verification. For API changes, run `pnpm run build`, `pnpm test`, and
`pnpm run test:e2e` as required by the constitution. Documentation-only skill
updates need skill/documentation validation rather than application tests.

The `phrases` capability implements listing, semantic validation, confirmed
registration and soft deletion. Registration goes through `PhraseRegistrationPort`:
`DrizzlePhraseRegistrationRepository` inserts the phrase and conditionally marks
the validation consumed in a single transaction (rollback + `VALIDATION_ALREADY_USED`
when it was already consumed).
Consult the feature specifications in `specs/` when requested; this skill does
not authorize scaffolding new behavior. Before finishing a change,
check capability ownership, import direction, DI bindings, and whether each
new abstraction serves the requested behavior.
