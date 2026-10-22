# Guía de validación: F001 — Listado de frases

Esta guía valida F001. Las respuestas esperadas están en [contracts/list-phrases.md](contracts/list-phrases.md) y el esquema físico en [data-model.md](data-model.md).

## Requisitos y preparación

Se necesitan Node.js, pnpm y Docker Compose. Desde `apps/backend`:

```sh
pnpm install
cp .env.example .env
```

Configurar `DATABASE_URL` en `.env` para PostgreSQL local y revisar los valores HTTP seguros documentados allí. La aplicación carga `.env` automáticamente mediante `ConfigModule` en `DatabaseModule`; las variables existentes del shell tienen prioridad. Drizzle CLI mantiene su configuración independiente y requiere exportar `DATABASE_URL` en el shell o usar un cargador de entorno. Desde la raíz del repositorio, iniciar la base existente:

```sh
docker compose up -d postgres
```

Desde `apps/backend`, aplicar la migración Drizzle de F001 con `DATABASE_URL=postgresql://semantic:semantic@localhost:5432/semantic_phrase pnpm run db:migrate` (ajustar la URL al entorno local). La migración se invoca expresamente; iniciar el servidor no migra ni carga datos. Para generar una migración posterior se usa `pnpm run db:generate` y se revisa el SQL generado antes de aplicarlo. Iniciar la API con `pnpm run start:dev`.

## Comprobaciones

1. Con una base migrada y vacía, ejecutar `curl -i 'http://localhost:3000/api/v1/phrases'`. Esperar 200, `data=[]` y `meta={page:1,limit:20,total:0,totalPages:0}`.
2. Cargar por separado un conjunto aislado de 45 filas válidas, mediante datos de prueba o el futuro flujo de registro aprobado. Consultar las páginas 1, 2 y 3; esperar 20, 20 y 5 elementos, `total=45`, `totalPages=3`, fechas descendentes e identificadores descendentes en empates. Ningún elemento debe contener `embedding`, `normalized_text`, `model_id` ni datos de validación.

   Ejemplo de carga aislada desde la raíz del repositorio, una vez aplicada la migración:

   ```sh
   docker compose exec -T postgres psql -U semantic -d semantic_phrase <<'SQL'
   INSERT INTO phrases (id, text, normalized_text, embedding, model_id, model_version, created_at)
   SELECT gen_random_uuid(), 'Frase de prueba ' || n, 'frase de prueba ' || n,
          ('[' || trim(trailing ',' from repeat('0,', 384)) || ']')::vector,
          'f001-manual-fixture', '1',
          TIMESTAMPTZ '2026-10-21 00:00:00+00' + (n / 2) * INTERVAL '1 second'
   FROM generate_series(1, 45) AS n;
   SQL
   ```

   Usar una base vacía para obtener `total=45`. Al terminar, retirar solamente ese conjunto:

   ```sh
   docker compose exec -T postgres psql -U semantic -d semantic_phrase -c "DELETE FROM phrases WHERE model_id = 'f001-manual-fixture'"
   ```

3. Consultar `?page=4`. Esperar 200, `data` vacío, `page=4`, `total=45` y `totalPages=3`.
4. Consultar `?page=0`, `?limit=101`, `?page=1.5` y `?unexpected=1`. Esperar 400, `application/problem+json` y `VALIDATION_ERROR`. Repetir con claves duplicadas y números que pierdan precisión.
5. Detener la base después de una consulta correcta y volver a consultar. Esperar 503, `application/problem+json` y `DATABASE_UNAVAILABLE`, nunca 200 con una lista vacía. Reiniciar la base al terminar.

Ejecutar `pnpm run build`, `pnpm test` y `pnpm run test:e2e`. La suite E2E debe comprobar el contrato HTTP con resultados y fallos controlados del repositorio; la comprobación manual verifica migración y SQL reales.
