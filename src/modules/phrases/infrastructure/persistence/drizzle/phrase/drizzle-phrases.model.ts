import {
  customType,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

const vector = customType<{
  data: string;
  driverData: string;
  config: { dimensions: number };
}>({
  dataType(config) {
    return `vector(${config?.dimensions ?? 384})`;
  },
});

export const DrizzlePhrasesModel = pgTable(
  'phrases',
  {
    id: uuid('id').primaryKey().notNull(),
    text: text('text').notNull(),
    normalizedText: text('normalized_text').notNull(),
    embedding: vector('embedding', { dimensions: 384 }).notNull(),
    modelId: varchar('model_id', { length: 255 }).notNull(),
    modelVersion: varchar('model_version', { length: 150 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  },
  (table) => [index('phrases_normalized_text_idx').on(table.normalizedText)],
);
