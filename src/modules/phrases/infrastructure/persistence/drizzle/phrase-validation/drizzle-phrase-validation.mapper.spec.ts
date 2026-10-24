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
    normalizedText: 'hola',
    requiresConfirmation: false,
    consumedAt: null,
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
      props.requiresConfirmation = score !== null && score >= 0.85;
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

describe('stored validation mapping', () => {
  it('preserves a pending validation without reevaluating stored similarity', () => {
    const props = validationProps();
    const result = DrizzlePhraseValidationMapper.toDomain({
      id: props.id.value,
      text: props.text.value,
      normalizedText: 'stored',
      embedding: JSON.stringify(props.embedding.values),
      modelId: props.model.id,
      modelVersion: props.model.version,
      matchedPhraseId: id,
      similarityScore: 1,
      requiresConfirmation: false,
      createdAt: props.createdAt,
      expiresAt: props.expiresAt,
      consumedAt: null,
    });
    expect(result.requiresConfirmation).toBe(false);
    expect(result.match).toBeNull();
    expect(result.consumedAt).toBeNull();
  });
  it('preserves stored alert, normalized text and consumed time without recomputing', () => {
    const row = DrizzlePhraseValidationMapper.toPersistence(
      new PhraseValidation(validationProps()),
    );
    const consumedAt = new Date('2026-10-22T12:01:00Z');
    const result = DrizzlePhraseValidationMapper.toDomain({
      ...row,
      requiresConfirmation: true,
      consumedAt,
      normalizedText: 'preserved',
    } as Parameters<typeof DrizzlePhraseValidationMapper.toDomain>[0]);
    expect(result).toBeInstanceOf(PhraseValidation);
    expect(result.match).toBeNull();
    expect(result.createdAt).toEqual(row.createdAt);
    expect(result.requiresConfirmation).toBe(true);
    expect(result.normalizedText).toBe('preserved');
    expect(result.consumedAt).toEqual(consumedAt);
    expect(result.text.value).toBe(' Hola ');
    expect(result.embedding.values).toEqual(Array<number>(384).fill(0.25));
    expect(result.model.id).toBe(teiConfig.AI_MODEL);
    expect(result.expiresAt).toEqual(row.expiresAt);
  });
});
