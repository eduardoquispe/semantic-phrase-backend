import { defineConfig } from 'drizzle-kit';

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required for Drizzle commands');
}

export default defineConfig({
  schema:
    './src/modules/phrases/infrastructure/persistence/drizzle/drizzle-phrases.model.ts',
  out: './drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL },
});
