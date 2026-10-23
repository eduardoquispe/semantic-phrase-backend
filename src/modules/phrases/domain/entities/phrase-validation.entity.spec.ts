import { PhraseValidation } from './phrase-validation.entity';
import type { PhraseValidationProps } from '../types/phrase-validation-props.interface';
import { PhraseValidationMatch } from '../value-objects/phrase-validation-match.value-object';
import { PhraseId } from '../value-objects/phrase-id.value-object';
import { PhraseText } from '../value-objects/phrase-text.value-object';
import { PhraseModel } from '../value-objects/phrase-model.value-object';
import { Embedding } from '../value-objects/embedding.value-object';
import { ValidationMatchEnum } from '../enums/validation-match.enum';
import { InvalidPhraseError } from '../errors/invalid-phrase.error';
import { InvalidPhraseValidationError } from '../errors/invalid-phrase-validation.error';

const id = '550e8400-e29b-41d4-a716-446655440000';
function validationProps(): PhraseValidationProps {
  return {
    id: new PhraseId(id),
    text: PhraseText.forValidation(' Hola '),
    embedding: new Embedding(Array<number>(384).fill(0.25)),
    model: new PhraseModel('MiniLM', 'version'),
    match: null,
    normalizedText: 'hola',
    requiresConfirmation: false,
    consumedAt: null,
    createdAt: new Date('2026-10-22T12:00:00Z'),
    expiresAt: new Date('2026-10-22T12:15:00Z'),
  };
}
describe('PhraseValidation', () => {
  it.each([null, new Date('2026-10-22T12:01:00Z')])(
    'preserves supplied state and defensively copies all dates (%s)',
    (consumedAt) => {
      const props = {
        ...validationProps(),
        normalizedText: 'stored-normalized-text',
        requiresConfirmation: true,
        consumedAt,
      };
      const validation = new PhraseValidation(props);
      const created = props.createdAt.getTime();
      const expires = props.expiresAt.getTime();
      const consumed = consumedAt?.getTime() ?? null;
      props.createdAt.setTime(0);
      props.expiresAt.setTime(0);
      consumedAt?.setTime(0);
      validation.createdAt.setTime(0);
      validation.expiresAt.setTime(0);
      validation.consumedAt?.setTime(0);
      expect(validation.createdAt.getTime()).toBe(created);
      expect(validation.expiresAt.getTime()).toBe(expires);
      expect(validation.consumedAt?.getTime() ?? null).toBe(consumed);
      expect(validation.normalizedText).toBe(props.normalizedText);
      expect(validation.requiresConfirmation).toBe(true);
      expect(validation.match).toBeNull();
      expect(Object.isFrozen(validation)).toBe(true);
    },
  );
  it('copies dates, preserves original, and expires at equality', () => {
    const props = validationProps();
    const v = new PhraseValidation(props);
    props.createdAt.setTime(0);
    v.expiresAt.setTime(0);
    expect(v.createdAt.toISOString()).toBe('2026-10-22T12:00:00.000Z');
    expect(v.isExpired(new Date('2026-10-22T12:14:59.999Z'))).toBe(false);
    expect(v.isExpired(new Date('2026-10-22T12:15:00Z'))).toBe(true);
    expect(v.isExpired(new Date('2026-10-22T12:15:00.001Z'))).toBe(true);
    expect(v.text.value).toBe(' Hola ');
    expect(v.normalizedText).toBe('hola');
    expect(v.consumedAt).toBeNull();
    expect(v.requiresConfirmation).toBe(false);
  });
  it.each([false, true])(
    'preserves the supplied confirmation decision (%s) and match',
    (requiresConfirmation) => {
      const match = new PhraseValidationMatch({
        type: ValidationMatchEnum.TextualExact,
        phrase: { id, text: 'Hola' },
        similarityScore: null,
      });
      const validation = new PhraseValidation({
        ...validationProps(),
        match,
        requiresConfirmation,
      });
      expect(validation.match).toBe(match);
      expect(validation.requiresConfirmation).toBe(requiresConfirmation);
      expect(Object.isFrozen(validation)).toBe(true);
      expect(() => {
        Object.assign(validation, {
          requiresConfirmation: !requiresConfirmation,
        });
      }).toThrow(TypeError);
    },
  );
  it('reuses the supplied domain values', () => {
    const props = validationProps();
    const validation = new PhraseValidation(props);
    expect(validation.id).toBe(props.id.value);
    expect(validation.text).toBe(props.text);
    expect(validation.embedding).toBe(props.embedding);
    expect(validation.model).toBe(props.model);
  });

  it.each(['', '  ', null, undefined, 42])(
    'rejects missing or blank normalizedText: %p',
    (normalizedText) => {
      expect(
        () =>
          new PhraseValidation({
            ...validationProps(),
            normalizedText: normalizedText as string,
          }),
      ).toThrow(InvalidPhraseError);
    },
  );

  it.each(['createdAt', 'expiresAt'] as const)(
    'rejects invalid %s',
    (field) => {
      for (const value of [new Date(NaN), '2026-10-22', null, undefined]) {
        expect(
          () =>
            new PhraseValidation({
              ...validationProps(),
              [field]: value,
            }),
        ).toThrow(InvalidPhraseValidationError);
      }
    },
  );

  it.each([new Date(NaN), '2026-10-22'])(
    'rejects an invalid consumedAt when not null: %p',
    (consumedAt) => {
      expect(
        () =>
          new PhraseValidation({
            ...validationProps(),
            consumedAt: consumedAt as Date,
          }),
      ).toThrow(InvalidPhraseValidationError);
    },
  );

  it('exposes an epoch consumedAt instead of treating it as null', () => {
    const validation = new PhraseValidation({
      ...validationProps(),
      consumedAt: new Date(0),
    });
    expect(validation.consumedAt).toEqual(new Date(0));
  });
});
