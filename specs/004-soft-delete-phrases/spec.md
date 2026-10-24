# Feature Specification: F004 — Eliminación lógica de frases (soft delete)

**Feature Branch**: Sin rama nueva; rama observada `main`.

**Created**: 2026-10-23

**Status**: Draft

**Input**: User description: "implementa soft delete toma en cuenta los docs de ../../03-XXX solo los referentes a esto y si hay que actualizar, actualiza. Tambien el openapi.yml"

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Eliminar una frase de la lista compartida (Priority: P1)

Como persona que usa la lista compartida, quiero eliminar una frase para que deje de mostrarse, sin que el sistema pierda el dato.

**Why this priority**: Es el núcleo de UF-006 / FR-018 del brief; sin ella la lista no puede depurarse.

**Independent Test**: Registrar una frase, eliminarla por su identificador y consultar el listado: la frase no aparece y el total disminuye.

**Acceptance Scenarios**:

1. **Given** una frase activa, **When** se solicita `DELETE /api/v1/phrases/{id}`, **Then** se responde 204 sin cuerpo y la frase queda marcada con su fecha de eliminación.
2. **Given** la frase eliminada, **When** se consulta `GET /api/v1/phrases`, **Then** no aparece y `meta.total` y `totalPages` reflejan solo frases activas.
3. **Given** la frase eliminada, **When** se inspecciona el almacenamiento, **Then** la fila sigue existiendo con su texto, representación semántica y fecha de creación intactos.

---

### User Story 2 — Excluir frases eliminadas de futuras validaciones (Priority: P1)

Como persona que valida una frase nueva, quiero que las frases eliminadas no generen advertencias de coincidencia.

**Why this priority**: BR-016 / DEC-014: evita resultados obsoletos.

**Independent Test**: Eliminar una frase y validar su mismo texto y uno semánticamente similar: no hay coincidencia.

**Acceptance Scenarios**:

1. **Given** una frase eliminada, **When** se valida el mismo texto normalizado, **Then** no hay coincidencia textual con ella.
2. **Given** una frase eliminada que sería la más similar, **When** se valida un texto parecido, **Then** la candidata vectorial es otra frase activa o ninguna.
3. **Given** una validación creada antes de la eliminación que citaba esa frase, **When** se registra con ella, **Then** el comportamiento de F003 no cambia y la validación no se modifica.
4. **Given** una colección donde todas las frases están eliminadas, **When** se valida, **Then** se trata como colección vacía.

---

### User Story 3 — Rechazar eliminaciones no aplicables (Priority: P2)

Como cliente del backend, quiero respuestas claras cuando la frase no existe, ya fue eliminada o el identificador es inválido.

**Why this priority**: Contrato predecible; sin él el cliente no distingue errores.

**Independent Test**: Eliminar dos veces la misma frase, un UUID inexistente y un identificador mal formado.

**Acceptance Scenarios**:

1. **Given** una frase ya eliminada o un UUID inexistente, **When** se solicita eliminarla, **Then** se responde 404/`PHRASE_NOT_FOUND` sin modificar datos.
2. **Given** un `id` que no es UUID, **When** se solicita eliminar, **Then** se responde 400/`VALIDATION_ERROR`.
3. **Given** un fallo de base de datos, **When** se solicita eliminar, **Then** se responde 500/`DATABASE_ERROR` y la frase sigue activa.

### Edge Cases

- Eliminaciones concurrentes de la misma frase: una obtiene 204; las demás 404.
- Misma frase registrada de nuevo tras eliminarla: se crea una frase nueva con otro identificador; la eliminada no se reactiva.
- Frase eliminada citada como `matched_phrase_id` en validaciones previas: la referencia permanece sin cambios.
- Eliminar la única frase activa: el listado queda vacío con `total=0`, `totalPages=0`.
- Cuerpo o parámetros de consulta enviados en `DELETE`: se ignoran.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: El sistema DEBE ofrecer `DELETE /api/v1/phrases/{id}` que elimina lógicamente una frase activa, sin autenticación ni propiedad individual (BR-017).
- **FR-002**: La eliminación DEBE registrar la fecha y hora de eliminación en la frase y NO DEBE borrar físicamente la fila ni alterar su texto, texto normalizado, representación semántica, modelo, versión ni fecha de creación.
- **FR-003**: El éxito DEBE responder 204 sin cuerpo.
- **FR-004**: El listado de frases DEBE devolver solo frases activas, con el mismo orden y contrato de F001; `total` y `totalPages` DEBEN contar únicamente frases activas.
- **FR-005**: La búsqueda de coincidencia textual y la de similitud vectorial de la validación (F002) DEBEN considerar solo frases activas.
- **FR-006**: Una frase inexistente o ya eliminada DEBE responder 404/`PHRASE_NOT_FOUND`; un `id` que no sea UUID, 400/`VALIDATION_ERROR`; un fallo de persistencia, 500/`DATABASE_ERROR`. Ningún rechazo DEBE modificar datos.
- **FR-007**: La eliminación DEBE ser irreversible desde la API: no existe restauración ni reactivación.
- **FR-008**: La eliminación NO DEBE modificar ni borrar validaciones temporales existentes; el registro con una validación previa (F003) conserva su comportamiento.
- **FR-009**: Los errores DEBEN usar `application/problem+json` con `title`, `status`, `detail`, `code`, sin `type`, trazas ni datos internos (convención vigente).
- **FR-010**: La documentación fuente DEBE reflejar el cambio de eliminación permanente a lógica: brief (objetivos, FR-018, BR-016, DEC-006), arquitectura de datos, catálogo de API, arquitectura backend, UI spec y `openapi.yaml` (operación `deletePhrase`, código `PHRASE_NOT_FOUND`, respuesta 404). Ya aplicado en esta especificación.
- **FR-011**: Los datos existentes DEBEN conservarse al aplicar el cambio: toda frase previa queda activa.

### Key Entities

- **Frase**: texto validado con identidad, fecha de creación y, nueva, fecha de eliminación opcional. Activa si `status = 1`; eliminada si `status = 2` (con `deleted_at` informado por `softDelete`). El filtro de todas las consultas es `status`, no la nulidad de `deleted_at`.
- **Validación temporal**: sin cambios; puede citar una frase que luego se elimina.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: El 100 % de las eliminaciones confirmadas hace desaparecer la frase del listado en la siguiente consulta.
- **SC-002**: El 100 % de las frases eliminadas permanece almacenado con su contenido original intacto.
- **SC-003**: Tras eliminar una frase, cero validaciones posteriores la devuelven como coincidencia textual o semántica.
- **SC-004**: Una segunda eliminación de la misma frase siempre se distingue de la primera (404 frente a 204).
- **SC-005**: El 100 % de los escenarios de error devuelve el resultado público documentado sin datos internos y sin modificar datos.
- **SC-006**: Las frases existentes antes del cambio siguen visibles y comparables tras aplicarlo.

## Assumptions

- Eliminar no es idempotente: repetir devuelve 404 (default; evita ocultar errores del cliente).
- Sin restauración, papelera ni purga física; la limpieza física queda fuera de alcance.
- La confirmación de eliminación es responsabilidad del frontend (UI spec); la API no exige confirmación adicional.
- Sin autenticación: cualquier usuario puede eliminar cualquier frase (DEC-009).
- Reutiliza el modelo de errores, el filtro global y la convención `{data, meta}` existentes.
- Fuera de alcance: edición, restauración, auditoría de quién eliminó, eliminación masiva.

## Traceability

| Fuente | Elementos |
|---|---|
| `docs/00-discovery/product-brief.md` | FR-016–FR-019, UF-006, BR-016, BR-017, AC-011–AC-013, EC-014, EC-015, DEC-006, DEC-009, DEC-014 (actualizados a eliminación lógica) |
| `docs/03-architecture/05-data-architecture.md` | §4.1 `status`, `deleted_at`, §6 consultas, §7 índices |
| `docs/03-architecture/06-api-security.md` | §2, §3, §4.4, §7 |
| `docs/03-architecture/openapi.yaml` | `DELETE /phrases/{id}`, `PHRASE_NOT_FOUND` |
