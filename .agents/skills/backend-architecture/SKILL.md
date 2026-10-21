---
name: backend-architecture
description: >-
  Organizes the NestJS backend by capabilities and hexagonal layers. Use it to
  decide where to place domain logic, use cases, ports or interfaces, DTOs,
  repositories, adapters, mappers, composition, and tests. It does not define
  business rules, API contracts, or specific providers; it does not apply to
  the frontend.
---

# Backend architecture

This skill describes the approved **code organization** for the backend: a
capability-based modular monolith, hexagonal architecture within each module,
and lightweight DDD. Use it when planning, implementing, or reviewing files.
For a task's behavior and technologies, consult the current specification and
decisions; do not copy MVP behavior from this skill.

Architecture documentation is in `docs/03-architecture/` at the project root.
`02-backend-architecture.md` defines the logical boundaries, and
`07-infrastructure-quality.md` updates the physical location to
`apps/backend/`. If a later document changes a criterion, follow the current
decision and then update this skill. The trees below show **where each
responsibility belongs**; create only the directories you need.

## 1. Capability first, layer second

All code specific to a capability belongs under `src/modules/<capability>/`.
A new action for an existing capability extends that module. A capability with
its own rules and vocabulary may have a separate module. Avoid organizing
features in global `controllers/`, `services/`, `entities/`, or
`repositories/` directories that mix distinct business concerns.

```text
src/
├── main.ts                           # Bootstrap and global HTTP configuration
├── app.module.ts                     # Business module composition
├── modules/
│   └── <capability>/
│       ├── domain/                   # Pure rules and invariants
│       │   ├── entities/             # Entities and aggregate roots
│       │   ├── value-objects/        # Only concepts with their own rules
│       │   └── errors/               # Domain violations
│       ├── application/              # Operations and contracts
│       │   ├── use-cases/            # One use case per business intent
│       │   ├── ports/
│       │   │   ├── inbound/          # Application API for its clients
│       │   │   └── outbound/         # Dependencies needed by the application
│       │   ├── commands/             # Inputs/results when they clarify the boundary
│       │   └── errors/               # Application flow failures
│       ├── infrastructure/           # Concrete details and adapters
│       │   ├── inbound/http/
│       │   │   ├── controllers/
│       │   │   ├── dtos/
│       │   │   └── mappers/
│       │   └── outbound/
│       │       ├── persistence/
│       │       │   ├── models/       # Or schema/, depending on current code
│       │       │   ├── repositories/
│       │       │   └── mappers/
│       │       └── <integration>/   # External provider, signing, files, etc.
│       └── <capability>.module.ts    # DI bindings for this capability
└── shared/                           # Truly cross-cutting pieces
```

The tree is a placement guide, **not scaffolding**. Do not create `commands/`,
`value-objects/`, `mappers/`, or integration directories in advance. Keep the
file naming style of neighboring files; names such as `cancel-order.use-case.ts`
or `order-repository.port.ts` indicate a role but do not require a class for
every noun.

## 2. Domain: rules independent of technology

`domain/entities/` contains entities with identity and behavior. An aggregate
root protects invariants within its own boundary; a use case may coordinate
multiple aggregates without merging them. Put a value object in
`domain/value-objects/` only when its value has rules or semantics that should
stay together. A domain service may live in `domain/` when a pure rule does
not naturally belong to a single entity. Invariant errors belong in
`domain/errors/`, without HTTP status codes.

| Do | Don't |
| --- | --- |
| `Order.cancel()` prevents cancellation of an already closed order. | `OrdersController` decides whether the state permits cancellation. |
| `Money` validates currency and operations, if those rules exist. | `OrderId` is a wrapper with no rule or expressive value. |
| A domain error expresses that an order cannot be cancelled. | An entity throws `HttpException` or queries the ORM. |

The domain does not import NestJS, DTOs, SQL, persistence schemas, SDKs, or
adapters. An interface that describes a **pure domain rule** may belong here.
An interface for loading, saving, or calling a provider belongs in
`application/ports/outbound/`.

## 3. Application: use cases and ports

`application/use-cases/` coordinates a business intent: it receives
application data, obtains the necessary aggregates, invokes their rules, and
requests effects through ports. It may depend on `domain/` and its own
contracts; it does not import controllers, ORM models, or provider
implementations.

| Piece | Location | Do | Don't |
| --- | --- | --- | --- |
| Use case | `application/use-cases/` | `CancelOrderUseCase` coordinates loading, cancelling, and saving. | A controller runs the entire flow. |
| Inbound port | `application/ports/inbound/` | Exposes an operation a controller or another adapter can invoke. | A contract uses HTTP `Request` or `Response`. |
| Outbound port | `application/ports/outbound/` | `OrderRepositoryPort` expresses `findById` and `save` in the capability's language. | `DatabasePort.executeSql(...)` leaks SQL into the application. |
| Command or result | `application/commands/` or beside the use case | Application types decouple the operation from transport when useful. | Copy every HTTP DTO into another file without a reason. |
| Application error | `application/errors/` | Expresses a flow condition, such as an expired operation. | Includes an HTTP status or driver details. |

**Ports are where interfaces between layers belong**. The current
architecture decision uses TypeScript abstract classes for inbound and
outbound ports, also using them as NestJS DI tokens. A TypeScript `interface`
does not exist at runtime: if one is adopted, the module needs an explicit
token. Follow the project's current decision; the contract's location does
not change with the choice of DI mechanism.

An inbound port represents the operation, and the use case implements it. An
outbound port represents a dependency of the operation, and an infrastructure
adapter implements it. Do not create a port or mapper that merely forwards a
call without separating a real responsibility.

## 4. Infrastructure: inbound, outbound, and composition

`infrastructure/inbound/http/` contains controllers, DTOs, and request shape
validation. An HTTP mapper, when needed, converts a DTO to or from an
application command or result. The inbound adapter calls the inbound port and
translates the result or error to the protocol; it does not decide invariants.

`infrastructure/outbound/` contains port implementations: persistence, SDKs,
and other external services. `persistence/repositories/` holds the **concrete**
repository; its contract belongs in `application/ports/outbound/`.
`persistence/models/` or `schema/` holds the storage representation.
`persistence/mappers/` holds row/model to domain conversion when it has real
complexity. Never move persistence models into `domain/`.

| Do | Don't |
| --- | --- |
| `http/dtos/cancel-order.request.dto.ts` defines transport input. | An entity receives an HTTP DTO. |
| `http/mappers/` converts a complex request into a command. | Create a mapper for every trivial property assignment. |
| `persistence/repositories/order.repository.ts` implements the required port. | `application/use-cases/` imports the concrete repository. |
| `persistence/mappers/` reconstructs an aggregate from stored data. | A use case knows about rows, tables, or columns. |
| A port promises atomic `confirmReservation(...)`, and the adapter opens the transaction. | A use case receives `db` or `tx`, or controls `commit`. |

`<capability>.module.ts` is the module's composition root: it registers
controllers, use cases, and bindings between ports and adapters. It contains
no business rules. `app.module.ts` brings modules together; `main.ts`
configures startup and global concerns. Migrations and technical
configuration go in the locations required by the tool and repository,
separate from the domain and use cases.

## 5. Shared code, errors, and tests

Use `src/shared/` only for cross-cutting responsibilities with no knowledge of
a specific capability. For example, a database client or generic HTTP filter
may be shared; order queries and rules stay in `modules/orders/`. Duplicate
use alone is not a reason to move a business policy into `shared/`. Do not
create a global `SharedModule` for convenience.

An error originates where its meaning is known: an invariant in
`domain/errors/`, a flow condition in `application/errors/`, or a controlled
technical failure in the adapter. The HTTP boundary translates it into the
response agreed in the API contract. Do not let the domain or application
know about HTTP status codes.

Place `*.spec.ts` unit tests beside entities and use cases. An application
test uses outbound port doubles to verify the flow. Adapter integration tests
and E2E tests, when appropriate, live in `test/` according to the current
strategy. A test with mocks does not prove that a real transaction or query
works.

## 6. Complete placement example

For a **fictional** `orders` capability with cancellation, files could be
arranged as follows. Create only those the use case requires:

```text
src/modules/orders/
├── domain/
│   ├── entities/order.entity.ts
│   └── errors/order-not-cancellable.error.ts
├── application/
│   ├── ports/inbound/cancel-order.port.ts
│   ├── ports/outbound/order-repository.port.ts
│   └── use-cases/cancel-order.use-case.ts
├── infrastructure/
│   ├── inbound/http/
│   │   ├── controllers/orders.controller.ts
│   │   └── dtos/cancel-order.request.dto.ts
│   └── outbound/persistence/
│       ├── repositories/order.repository.ts
│       └── mappers/order.persistence.mapper.ts  # Only if it performs real conversion
└── orders.module.ts
```

The controller delegates to the inbound port. The use case obtains `Order`
through the outbound port, calls `cancel()`, and requests persistence. The
adapter implements the repository and translates between storage and domain.
The NestJS module connects the implementations. Do not create
`OrdersRepository` in `shared/` or import the concrete repository from the
use case.

Before finishing a change, check which capability owns each file, the
direction of its imports, where each contract and adapter lives, and whether
each new directory or abstraction protects a real boundary.
