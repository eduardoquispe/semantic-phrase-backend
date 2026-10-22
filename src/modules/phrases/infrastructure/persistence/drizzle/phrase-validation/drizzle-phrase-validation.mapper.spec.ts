import { teiConfig } from '../../../../../../../test/fixtures/tei';
import { PhraseValidationMatch } from '../../../../domain/value-objects/phrase-validation-match.value-object';
import { DrizzlePhraseValidationMapper } from './drizzle-phrase-validation.mapper';
import { PhraseValidation } from '../../../../domain/entities/phrase-validation.entity';
import type { PhraseValidationProps } from '../../../../domain/types/phrase-validation-props.interface';
import { PhraseId } from '../../../../domain/value-objects/phrase-id.value-object';
import { PhraseText } from '../../../../domain/value-objects/phrase-text.value-object';
import { PhraseModel } from '../../../../domain/value-objects/phrase-model.value-object';
import { Embedding } from '../../../../domain/value-objects/embedding.value-object';

const id = '550e8400-e29b-41d4-a716-446655440000';

function validationProps(): PhraseValidationProps {
  return {
    id: new PhraseId(id),
    text: PhraseText.forValidation(' Hola '),
    embedding: new Embedding(Array<number>(384).fill(0.25)),
    model: new PhraseModel(teiConfig.AI_MODEL, teiConfig.AI_EMBEDDING_VERSION),
    match: null,
    threshold: 0.85,
    createdAt: new Date('2026-10-22T12:00:00Z'),
    expiresAt: new Date('2026-10-22T12:15:00Z'),
  };
}

import { SimilarityScore } from '../../../../domain/value-objects/similarity-score.value-object';
import { ValidationMatchEnum } from '../../../../domain/enums/validation-match.enum';
describe('DrizzlePhraseValidationMapper', () => {
  it.each([null, -0.7, 0.9])(
    'maps exact original, embedding, model and dates (%s)',
    (score) => {
      const props = validationProps();
      if (score !== null)
        props.match = new PhraseValidationMatch({
          type: ValidationMatchEnum.Vector,
          phrase: { id: props.id.value, text: 'Candidate' },
          similarityScore: new SimilarityScore(score),
        });
      const v = new PhraseValidation(props);
      const row = DrizzlePhraseValidationMapper.toPersistence(v);
      expect(row).toEqual({
        id: v.id,
        text: ' Hola ',
        normalizedText: 'hola',
        embedding: JSON.stringify(v.embedding.values),
        modelId: teiConfig.AI_MODEL,
        modelVersion: teiConfig.AI_EMBEDDING_VERSION,
        matchedPhraseId: score === null ? null : v.id,
        similarityScore: score,
        requiresConfirmation: score !== null && score >= 0.85,
        createdAt: v.createdAt,
        expiresAt: v.expiresAt,
        consumedAt: null,
      });
    },
  );
});
