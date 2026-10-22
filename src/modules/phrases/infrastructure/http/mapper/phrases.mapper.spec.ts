import { PhraseValidationMatch } from '../../../domain/value-objects/phrase-validation-match.value-object';
import { PhrasesMapper } from './phrases.mapper';
import { SimilarityScore } from '../../../domain/value-objects/similarity-score.value-object';
import { ValidationMatchEnum } from '../../../domain/enums/validation-match.enum';

describe('PhrasesMapper validation', () => {
  it.each([null, -0.5, 0.9])(
    'extracts score without leaking domain structures (%s)',
    (score) => {
      const phrase = { id: 'id', text: 'Original' };
      const result = PhrasesMapper.toValidationResponse({
        validationId: '550e8400-e29b-41d4-a716-446655440000',
        expiresAt: new Date(0),
        requiresConfirmation: score === null,
        match: new PhraseValidationMatch(
          score === null
            ? {
                type: ValidationMatchEnum.TextualExact,
                phrase,
                similarityScore: null,
              }
            : {
                type: ValidationMatchEnum.Vector,
                phrase,
                similarityScore: new SimilarityScore(score),
              },
        ),
      });
      expect(result).toEqual({
        data: {
          validationId: '550e8400-e29b-41d4-a716-446655440000',
          expiresAt: '1970-01-01T00:00:00.000Z',
          requiresConfirmation: score === null,
          match: {
            type: score === null ? 'textual_exact' : 'vector',
            phrase,
            similarityScore: score,
          },
        },
      });
    },
  );
});
