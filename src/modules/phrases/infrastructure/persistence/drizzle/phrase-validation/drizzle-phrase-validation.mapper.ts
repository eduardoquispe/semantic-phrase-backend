import { PhraseId } from '../../../../domain/value-objects/phrase-id.value-object';
import { PhraseText } from '../../../../domain/value-objects/phrase-text.value-object';
import { PhraseValidation } from '../../../../domain/entities/phrase-validation.entity';
import { DrizzlePhraseValidationsModel } from './drizzle-phrase-validations.model';
import { Embedding } from '../../../../domain/value-objects/embedding.value-object';
import { NormalizedPhraseText } from '../../../../domain/value-objects/normalized-phrase-text.value-object';
import { SimilarityScore } from '../../../../domain/value-objects/similarity-score.value-object';
import { PhraseModel } from '../../../../domain/value-objects/phrase-model.value-object';
export class DrizzlePhraseValidationMapper {
  static toDomain(
    raw: typeof DrizzlePhraseValidationsModel.$inferSelect,
  ): PhraseValidation {
    return PhraseValidation.reconstitute({
      id: new PhraseId(raw.id),
      text: new PhraseText(raw.text),
      normalizedText: new NormalizedPhraseText(raw.normalizedText),
      embedding: new Embedding(JSON.parse(raw.embedding) as number[]),
      model: new PhraseModel(raw.modelId, raw.modelVersion),
      requiresConfirmation: raw.requiresConfirmation,
      matchedPhraseId: raw.matchedPhraseId
        ? new PhraseId(raw.matchedPhraseId)
        : null,
      similarityScore: raw.similarityScore
        ? new SimilarityScore(raw.similarityScore)
        : null,
      createdAt: new Date(raw.createdAt),
      expiresAt: new Date(raw.expiresAt),
      consumedAt: raw.consumedAt ? new Date(raw.consumedAt) : null,
    });
  }

  static toPersistence(
    validation: PhraseValidation,
  ): typeof DrizzlePhraseValidationsModel.$inferInsert {
    return {
      id: validation.id,
      text: validation.text.value,
      normalizedText: validation.normalizedText,
      embedding: JSON.stringify(validation.embedding.values),
      modelId: validation.model.id,
      modelVersion: validation.model.version,
      matchedPhraseId: validation.matchedPhraseId,
      similarityScore: validation.similarityScore?.value ?? null,
      requiresConfirmation: validation.requiresConfirmation,
      createdAt: validation.createdAt,
      expiresAt: validation.expiresAt,
      consumedAt: null,
    };
  }
}
