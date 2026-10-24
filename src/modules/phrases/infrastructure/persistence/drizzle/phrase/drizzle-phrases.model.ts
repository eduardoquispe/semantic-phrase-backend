import { sql } from 'drizzle-orm';
import {
  check,
  index,
  pgTable,
  smallint,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { PhraseStatusEnum } from '../../../../domain/enums/phrase-status.enum';
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
    status: smallint('status').notNull().default(PhraseStatusEnum.ACTIVE),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    index('phrases_normalized_text_idx').on(table.normalizedText),
    check('phrases_status_check', sql`${table.status} IN (1, 2)`),
  ],
);
