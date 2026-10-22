import { Phrase } from '../../../../domain/entities/phrase.entity';
import { DrizzlePhrasesModel } from './drizzle-phrases.model';
import { PhraseId } from '../../../../domain/value-objects/phrase-id.value-object';
import { PhraseText } from '../../../../domain/value-objects/phrase-text.value-object';
import { Embedding } from '../../../../domain/value-objects/embedding.value-object';

export class DrizzlePhraseMapper {
  static toDomain(raw: typeof DrizzlePhrasesModel.$inferSelect): Phrase {
    const embeddingValues = JSON.parse(raw.embedding) as number[];

    return new Phrase({
      id: new PhraseId(raw.id),
      text: new PhraseText(raw.text),
      normalizedText: raw.normalizedText,
      embedding: new Embedding(embeddingValues),
      modelId: raw.modelId,
      modelVersion: raw.modelVersion,
      createdAt: new Date(raw.createdAt),
    });
  }

  static toDomainMany(
    raws: (typeof DrizzlePhrasesModel.$inferSelect)[],
  ): Phrase[] {
    return raws.map((raw) => this.toDomain(raw));
  }

  static toPersistence(
    phrase: Phrase,
  ): typeof DrizzlePhrasesModel.$inferInsert {
    return {
      id: phrase.id,
      text: phrase.text.value,
      normalizedText: phrase.normalizedText,
      embedding: JSON.stringify(phrase.embedding.values),
      modelId: phrase.modelId,
      modelVersion: phrase.modelVersion,
      createdAt: phrase.createdAt,
    };
  }
}
