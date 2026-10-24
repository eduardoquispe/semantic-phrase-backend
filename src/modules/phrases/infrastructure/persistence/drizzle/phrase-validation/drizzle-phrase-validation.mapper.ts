import { PhraseId } from '../../../../domain/value-objects/phrase-id.value-object';
import { PhraseText } from '../../../../domain/value-objects/phrase-text.value-object';
import { PhraseValidation } from '../../../../domain/entities/phrase-validation.entity';
import { DrizzlePhraseValidationsModel } from './drizzle-phrase-validations.model';
import { Embedding } from '../../../../domain/value-objects/embedding.value-object';
import { PhraseModel } from '../../../../domain/value-objects/phrase-model.value-object';
export class DrizzlePhraseValidationMapper {
  static toDomain(
    raw: typeof DrizzlePhraseValidationsModel.$inferSelect,
  ): PhraseValidation {
    return new PhraseValidation({
      id: new PhraseId(raw.id),
      text: PhraseText.forValidation(raw.text),
      normalizedText: raw.normalizedText,
      embedding: new Embedding(JSON.parse(raw.embedding) as number[]),
      model: new PhraseModel(raw.modelId, raw.modelVersion),
      requiresConfirmation: raw.requiresConfirmation,
      match: null,
      createdAt: new Date(raw.createdAt),
      expiresAt: new Date(raw.expiresAt),
      consumedAt: raw.consumedAt === null ? null : new Date(raw.consumedAt),
    });
  }

  static toPersistence(
    validation: PhraseValidation,
  ): typeof DrizzlePhraseValidationsModel.$inferInsert {
    const match = validation.match;
    return {
      id: validation.id,
      text: validation.text.value,
      normalizedText: validation.normalizedText,
      embedding: JSON.stringify(validation.embedding.values),
      modelId: validation.model.id,
      modelVersion: validation.model.version,
      matchedPhraseId: match?.phrase.id ?? null,
      similarityScore: match?.similarityScore?.value ?? null,
      requiresConfirmation: validation.requiresConfirmation,
      createdAt: validation.createdAt,
      expiresAt: validation.expiresAt,
      consumedAt: null,
    };
  }
}
