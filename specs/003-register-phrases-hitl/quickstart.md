# Quickstart de validación — F003

F003 implementado y verificado el 2026-10-22. Esta guía describe los escenarios de aceptación; la evidencia ejecutada se registra en §4. Contrato: [contracts/create-phrase.openapi.yaml](contracts/create-phrase.openapi.yaml). Datos/estados: [data-model.md](data-model.md).

## Prerrequisitos

- Backend con F001/F002, pnpm y dependencias instaladas.
- PostgreSQL con pgvector y migraciones existentes aplicadas explícitamente. No se espera migración nueva para F003.
- Configuración de `.env.example`: DATABASE_URL y perfil AI existente; sin variables nuevas. El servicio TEI debe permitir la inferencia inicial de F002 antes de escuchar HTTP.
- Sincronizar primero OpenAPI/bloque 06 según [contracts/README.md](contracts/README.md).
- Para escenarios de escritura usar el entorno de desarrollo de pruebas autorizado. Identificar todos los UUID creados; no borrar corpus ni validaciones ajenas y no cambiar el servicio compartido de embeddings.

Desde `apps/backend/`:

```sh
pnpm install
pnpm run db:migrate
pnpm run build
pnpm test --runInBand
pnpm run test:e2e --runInBand
pnpm run start:dev
```

Aplicar migraciones solo en la BD de desarrollo elegida. Los comandos anteriores permiten reproducir la configuración. No se aplicaron migraciones nuevas durante F003.

## 1. Validar, registrar y leer

Utilizar un texto identificable por ejecución. La colección puede producir alerta; seguir `requiresConfirmation` de la respuesta. Capturar el UUID de F002:

```sh
curl -i http://localhost:3000/api/v1/phrase-validations \
  -H 'Content-Type: application/json' \
  -d '{"text":"Ejemplo F003 de registro"}'
```

Esperado: 201 con `data.validationId`, `expiresAt` y `requiresConfirmation`. Sustituir `<validationId>` en el registro siguiente; `confirmed:true` también es válido si no hay alerta:

```sh
curl -i http://localhost:3000/api/v1/phrases \
  -H 'Content-Type: application/json' \
  -d '{"text":"Ejemplo F003 de registro","validationId":"<validationId>","confirmed":true}'

curl -i 'http://localhost:3000/api/v1/phrases?page=1&limit=20'
```

Esperado: registro 201 exactamente `{data:{id,text,createdAt}}`; UUID nuevo, texto idéntico y fecha con zona. El listado mantiene contrato/orden F001 y contiene la frase. Repetir el POST con la misma referencia: 409 `VALIDATION_ALREADY_USED`, sin otra frase.

## 2. Casos de aplicación y HTTP

Usar validaciones independientes para cada éxito. En cada rechazo comprobar que no cambió la cantidad de frases y que no se consumió esa validación por la solicitud fallida. Para un intento sobre una validación ya consumida, comprobar que conserva el consumo original.

| Escenario | Resultado esperado |
| --- | --- |
| Sin alerta y confirmed omitido/false/true | 201 en cada validación independiente |
| Alerta textual y vectorial; confirmed omitido/false | 409 CONFIRMATION_REQUIRED; el mismo comprobante permite reintento con true si sigue vigente |
| Coincidencia textual exacta confirmada | 201; no hay unicidad global |
| Colección vacía y candidata bajo umbral | Sin alerta; permite registro |
| confirmed cadena, número o null | 400 VALIDATION_ERROR; sin coerción |
| validationId ausente, no UUID, UUID no v4 o v4 inexistente | 400 INVALID_VALIDATION_ID |
| Texto distinto solo en mayúsculas o espacios | 400 PHRASE_MISMATCH |
| requiresConfirmation u otra propiedad extra o validationToken en el body | 400 VALIDATION_ERROR cuando no haya otra causa aislada |
| Query extra (`?extra=1`) | Ignorada; el resultado no cambia |
| Texto ausente/no cadena, vacío tras trim o con tab/LF/CR/u otro Cc | 400 VALIDATION_ERROR |
| 280 puntos de código originales, signos o emojis sin letras | Permite registro con comprobante aplicable; espacios cuentan y se conservan |
| 281 puntos de código | 400 VALIDATION_ERROR |
| now == expiresAt o now > expiresAt en validación pendiente | 409 VALIDATION_EXPIRED |
| Modelo o versión conservada incompatibles | 409 INCOMPATIBLE_MODEL |
| Fallo de BD / error inesperado ajeno a BD | 500 DATABASE_ERROR / 500 INTERNAL_ERROR |
| Más de 60 solicitudes/minuto con entradas controladas | Sin 429 por volumen; cada una sigue sus condiciones funcionales |
| Validar y abandonar sin POST de registro | Cero frases nuevas; sin estado de cancelación |
| Dos validaciones distintas con el mismo original confirmado | Dos éxitos y dos frases |

Unitarias con tiempo fijo prueban igualdad exacta de expiración sin esperar 15 minutos. Dobles de puertos y spies verifican que registro no invoca inferencia, búsqueda de coincidencia ni normalización vectorial. Comparar el vector y normalizado persistidos entre validación y frase definitiva.

El corpus vacío se comprueba solo en entorno controlado vacío, sin vaciar la colección compartida. Los casos inválidos se aíslan para no exigir una precedencia de errores que la spec no define. Para todo error verificar `application/problem+json`, HTTP == status y ausencia de type/timestamp/traceId/trazas/secretos.

## 3. Verificación de la simplificación

El flujo usa `PhraseRegistrationPort`: una transacción con UPDATE condicional de consumedAt e INSERT de la frase.

- Unitarias: construcción fiel de Phrase, UUID/fecha nuevos, comprobaciones previas, una sola llamada a `register` y retorno después de ella.
- Persistencia: adaptador con dobles de `client.transaction`: orden UPDATE→INSERT, 0 filas → VALIDATION_ALREADY_USED sin INSERT, fallos envueltos en DatabaseError; se conservan pruebas de creación de validaciones.
- Fallos: cualquier fallo de `register` no guarda ni consume nada; HTTP cubre 500 con reintento exitoso y 409 por consumo concurrente.
- Concurrencia: el UPDATE condicional dentro de la transacción deja pasar solo una de dos peticiones simultáneas; la otra recibe 409. No se vuelve a comprobar expiración tras leer.
- Un consumo previo observado al leer continúa produciendo VALIDATION_ALREADY_USED.

No se requieren migraciones ni dependencias nuevas. Los E2E usan dobles de puertos, no PostgreSQL real: la atomicidad real se comprueba manualmente contra Postgres (doble POST simultáneo → un 201 y un 409).

## 4. Resultados de verificación

- `pnpm run build`: PASS.
- ESLint, Prettier y `git diff --check`: PASS.
- `pnpm test`: PASS, 28 suites y 318 pruebas (revisión 2026-10-24).
- `pnpm run test:e2e`: PASS, 4 suites y 115 pruebas (revisión 2026-10-24).
- `npx tsc --noEmit -p tsconfig.json`: PASS.

Jest encontró EPERM al abrir conexiones locales dentro del sandbox; ambas suites pasaron fuera del sandbox con permiso. No se ejecutaron pruebas contra PostgreSQL real para esta revisión.
