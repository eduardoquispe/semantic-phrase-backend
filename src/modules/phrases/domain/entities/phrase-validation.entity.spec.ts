import { PhraseValidation } from './phrase-validation.entity';
import type { PhraseValidationProps } from '../types/phrase-validation-props.interface';
import { PhraseValidationMatch } from '../value-objects/phrase-validation-match.value-object';
import { PhraseId } from '../value-objects/phrase-id.value-object';
import { PhraseText } from '../value-objects/phrase-text.value-object';
import { PhraseModel } from '../value-objects/phrase-model.value-object';
import { Embedding } from '../value-objects/embedding.value-object';
import { SimilarityScore } from '../value-objects/similarity-score.value-object';
import { ValidationMatchEnum } from '../enums/validation-match.enum';

const id = '550e8400-e29b-41d4-a716-446655440000';
function validationProps(): PhraseValidationProps {
  return {
    id: new PhraseId(id),
    text: PhraseText.forValidation(' Hola '),
    embedding: new Embedding(Array<number>(384).fill(0.25)),
    model: new PhraseModel('MiniLM', 'version'),
    match: null,
    threshold: 0.85,
    createdAt: new Date('2026-10-22T12:00:00Z'),
    expiresAt: new Date('2026-10-22T12:15:00Z'),
  };
}
describe('PhraseValidation', () => {
  it('copies dates, preserves original, and expires at equality', () => {
    const props = validationProps();
    const v = new PhraseValidation(props);
    props.createdAt.setTime(0);
    v.expiresAt.setTime(0);
    expect(v.createdAt.toISOString()).toBe('2026-10-22T12:00:00.000Z');
    expect(v.isExpired(new Date('2026-10-22T12:14:59.999Z'))).toBe(false);
    expect(v.isExpired(new Date('2026-10-22T12:15:00Z'))).toBe(true);
    expect(v.text.value).toBe(' Hola ');
    expect(v.normalizedText).toBe('hola');
    expect(v.consumedAt).toBeNull();
    expect(v.requiresConfirmation).toBe(false);
  });
  it.each([-0.1, 0.849, 0.85, 0.851])(
    'decides with inclusive threshold for %s',
    (score) => {
      const v = new PhraseValidation({
        ...validationProps(),
        match: new PhraseValidationMatch({
          type: ValidationMatchEnum.Vector,
          phrase: { id, text: 'Candidate' },
          similarityScore: new SimilarityScore(score),
        }),
      });
      expect(v.requiresConfirmation).toBe(score >= 0.85);
    },
  );
  it('requires confirmation for textual without invented score', () => {
    const v = new PhraseValidation({
      ...validationProps(),
      match: new PhraseValidationMatch({
        type: ValidationMatchEnum.TextualExact,
        phrase: { id, text: 'Hola' },
        similarityScore: null,
      }),
    });
    expect(v.requiresConfirmation).toBe(true);
    expect(v.match!.similarityScore).toBeNull();
  });
  it('reuses the supplied domain values', () => {
    const props = validationProps();
    const validation = new PhraseValidation(props);
    expect(validation.text).toBe(props.text);
    expect(validation.embedding).toBe(props.embedding);
    expect(validation.model).toBe(props.model);
  });
});
