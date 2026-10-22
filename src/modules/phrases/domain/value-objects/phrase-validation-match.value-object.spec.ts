import { ValidationMatchEnum } from '../enums/validation-match.enum';
import { PhraseValidationMatch } from './phrase-validation-match.value-object';
import { SimilarityScore } from './similarity-score.value-object';

describe('PhraseValidationMatch', () => {
  const phrase = { id: '550e8400-e29b-41d4-a716-446655440000', text: 'Hola' };

  it('requires confirmation for an exact match without inventing a score', () => {
    const match = new PhraseValidationMatch({
      type: ValidationMatchEnum.TextualExact,
      phrase,
      similarityScore: null,
    });
    expect(match.requiresConfirmation(0.85)).toBe(true);
    expect(match.similarityScore).toBeNull();
  });

  it.each([-0.1, 0.849, 0.85, 0.851])(
    'compares score %s against the inclusive threshold',
    (score) => {
      const match = new PhraseValidationMatch({
        type: ValidationMatchEnum.Vector,
        phrase,
        similarityScore: new SimilarityScore(score),
      });
      expect(match.requiresConfirmation(0.85)).toBe(score >= 0.85);
    },
  );

  it('keeps an immutable snapshot of the matched phrase', () => {
    const source = { ...phrase };
    const match = new PhraseValidationMatch({
      type: ValidationMatchEnum.TextualExact,
      phrase: source,
      similarityScore: null,
    });
    source.text = 'Changed';
    expect(match.phrase.text).toBe('Hola');
    expect(() => Object.assign(match.phrase, { text: 'Changed' })).toThrow();
    expect(() => Object.assign(match, { similarityScore: null })).toThrow();
  });
});
