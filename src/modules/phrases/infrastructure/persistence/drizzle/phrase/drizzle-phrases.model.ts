import {
  index,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { pgVector } from '../../../../../../shared/infrastructure/database/pg-vector.column';

export const DrizzlePhrasesModel = pgTable(
  'phrases',
  {
    id: uuid('id').primaryKey().notNull(),
    text: text('text').notNull(),
    normalizedText: text('normalized_text').notNull(),
    embedding: pgVector('embedding').notNull(),
    modelId: varchar('model_id', { length: 255 }).notNull(),
    modelVersion: varchar('model_version', { length: 150 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  },
  (table) => [index('phrases_normalized_text_idx').on(table.normalizedText)],
);
