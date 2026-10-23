import {
  boolean,
  doublePrecision,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { pgVector } from '../../../../../../shared/infrastructure/database/pg-vector.column';

export const DrizzlePhraseValidationsModel = pgTable('phrase_validations', {
  id: uuid('id').primaryKey().notNull(),
  text: text('text').notNull(),
  normalizedText: text('normalized_text').notNull(),
  embedding: pgVector('embedding').notNull(),
  modelId: varchar('model_id', { length: 255 }).notNull(),
  modelVersion: varchar('model_version', { length: 150 }).notNull(),
  matchedPhraseId: uuid('matched_phrase_id'),
  similarityScore: doublePrecision('similarity_score'),
  requiresConfirmation: boolean('requires_confirmation').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  consumedAt: timestamp('consumed_at', { withTimezone: true }),
});
