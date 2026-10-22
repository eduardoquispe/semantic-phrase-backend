import { PhraseValidation } from '../../../../domain/entities/phrase-validation.entity';
import { DrizzlePhraseValidationsModel } from './drizzle-phrase-validations.model';
export class DrizzlePhraseValidationMapper {
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
