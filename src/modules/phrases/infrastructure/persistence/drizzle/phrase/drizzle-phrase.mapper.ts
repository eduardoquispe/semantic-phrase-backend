import { Phrase } from '../../../../domain/entities/phrase.entity';
import { DrizzlePhrasesModel } from './drizzle-phrases.model';
import { PhraseId } from '../../../../domain/value-objects/phrase-id.value-object';
import { PhraseText } from '../../../../domain/value-objects/phrase-text.value-object';
import { NormalizedPhraseText } from '../../../../domain/value-objects/normalized-phrase-text.value-object';
import { PhraseModel } from '../../../../domain/value-objects/phrase-model.value-object';
import { Embedding } from '../../../../domain/value-objects/embedding.value-object';

export class DrizzlePhraseMapper {
  static toDomain(raw: typeof DrizzlePhrasesModel.$inferSelect): Phrase {
    const embeddingValues = JSON.parse(raw.embedding) as number[];

    return Phrase.reconstitute({
      id: new PhraseId(raw.id),
      text: new PhraseText(raw.text),
      normalizedText: new NormalizedPhraseText(raw.normalizedText),
      embedding: new Embedding(embeddingValues),
      model: new PhraseModel(raw.modelId, raw.modelVersion),
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
      modelId: phrase.model.id,
      modelVersion: phrase.model.version,
      createdAt: phrase.createdAt,
    };
  }
}
