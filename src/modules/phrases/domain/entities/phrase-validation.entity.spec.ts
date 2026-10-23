import { PhraseValidation } from './phrase-validation.entity';
import type { PhraseValidationProps } from '../types/phrase-validation-props.interface';
import type { CreatePhraseValidationProps } from '../types/create-phrase-validation-input.interface';
import { PhraseValidationMatch } from '../value-objects/phrase-validation-match.value-object';
import { PhraseId } from '../value-objects/phrase-id.value-object';
import { PhraseText } from '../value-objects/phrase-text.value-object';
import { PhraseModel } from '../value-objects/phrase-model.value-object';
import { NormalizedPhraseText } from '../value-objects/normalized-phrase-text.value-object';
import { SimilarityScore } from '../value-objects/similarity-score.value-object';
import { Embedding } from '../value-objects/embedding.value-object';
import { ValidationMatchEnum } from '../enums/validation-match.enum';
import { InvalidDateError } from '../../../../shared/domain/errors/invalid-date.error';
import { InvalidPhraseValidationError } from '../errors/invalid-phrase-validation.error';
import { PhraseConfirmationRequiredError } from '../errors/confirmation-required.error';
import { IncompatibleValidationModelError } from '../errors/incompatible-validation-model.error';
import { PhraseMismatchError } from '../errors/phrase-mismatch.error';
import { PhraseValidationAlreadyUsedError } from '../errors/validation-already-used.error';
import { PhraseValidationExpiredError } from '../errors/validation-expired.error';

const id = '550e8400-e29b-41d4-a716-446655440000';
function validationProps(): PhraseValidationProps {
  return {
    id: new PhraseId(id),
    text: PhraseText.forValidation(' Hola '),
    embedding: new Embedding(Array<number>(384).fill(0.25)),
    model: new PhraseModel('MiniLM', 'version'),
    match: null,
    normalizedText: new NormalizedPhraseText('hola'),
    requiresConfirmation: false,
    consumedAt: null,
    createdAt: new Date('2026-10-22T12:00:00Z'),
    expiresAt: new Date('2026-10-22T12:15:00Z'),
  };
}
function createInput(): CreatePhraseValidationProps {
  const { id, text, embedding, model } = validationProps();
  return {
    id,
    text,
    embedding,
    model,
    match: null,
    threshold: 0.85,
    ttlMinutes: 15,
    now: new Date('2026-10-22T12:00:00.789Z'),
  };
}

describe('PhraseValidation', () => {
  describe('create', () => {
    it('derives dates, normalized text and initial state', () => {
      const input = createInput();
      const v = PhraseValidation.create(input);
      expect(v.id).toBe(id);
      expect(v.text).toBe(input.text);
      expect(v.normalizedText).toBe('hola');
      expect(v.createdAt.toISOString()).toBe('2026-10-22T12:00:00.000Z');
      expect(v.expiresAt.toISOString()).toBe('2026-10-22T12:15:00.000Z');
      expect(v.consumedAt).toBeNull();
      expect(v.requiresConfirmation).toBe(false);
    });

    it.each([
      [0.9, true],
      [0.8, false],
    ])(
      'decides confirmation from the match score (%s => %s)',
      (score, expected) => {
        const match = new PhraseValidationMatch({
          type: ValidationMatchEnum.Vector,
          phrase: { id, text: 'Hola' },
          similarityScore: new SimilarityScore(score),
        });
        const v = PhraseValidation.create({ ...createInput(), match });
        expect(v.requiresConfirmation).toBe(expected);
      },
    );

    it.each([0, -1, NaN, Infinity])('rejects ttlMinutes %p', (ttlMinutes) => {
      expect(() =>
        PhraseValidation.create({ ...createInput(), ttlMinutes }),
      ).toThrow(InvalidPhraseValidationError);
    });

    it('rejects an invalid now', () => {
      expect(() =>
        PhraseValidation.create({ ...createInput(), now: new Date(NaN) }),
      ).toThrow(InvalidDateError);
    });
  });

  describe('reconstitute', () => {
    it.each([null, new Date('2026-10-22T12:01:00Z')])(
      'preserves supplied state and defensively copies all dates (%s)',
      (consumedAt) => {
        const props = {
          ...validationProps(),
          normalizedText: new NormalizedPhraseText('stored-normalized-text'),
          requiresConfirmation: true,
          consumedAt,
        };
        const validation = PhraseValidation.reconstitute(props);
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
        expect(validation.normalizedText).toBe('stored-normalized-text');
        expect(validation.requiresConfirmation).toBe(true);
        expect(validation.match).toBeNull();
        expect(Object.isFrozen(validation)).toBe(true);
      },
    );

    it('reuses the supplied domain values', () => {
      const props = validationProps();
      const validation = PhraseValidation.reconstitute(props);
      expect(validation.id).toBe(props.id.value);
      expect(validation.text).toBe(props.text);
      expect(validation.embedding).toBe(props.embedding);
      expect(validation.model).toBe(props.model);
    });

    it.each(['createdAt', 'expiresAt'] as const)(
      'rejects invalid %s',
      (field) => {
        for (const value of [new Date(NaN), '2026-10-22', null, undefined]) {
          expect(() =>
            PhraseValidation.reconstitute({
              ...validationProps(),
              [field]: value,
            }),
          ).toThrow(InvalidDateError);
        }
      },
    );

    it.each([new Date(NaN), '2026-10-22'])(
      'rejects an invalid consumedAt when not null: %p',
      (consumedAt) => {
        expect(() =>
          PhraseValidation.reconstitute({
            ...validationProps(),
            consumedAt: consumedAt as Date,
          }),
        ).toThrow(InvalidDateError);
      },
    );

    it('exposes an epoch consumedAt instead of treating it as null', () => {
      const validation = PhraseValidation.reconstitute({
        ...validationProps(),
        consumedAt: new Date(0),
      });
      expect(validation.consumedAt).toEqual(new Date(0));
    });
  });

  describe('behavior', () => {
    it('expires at equality', () => {
      const v = PhraseValidation.reconstitute(validationProps());
      expect(v.isExpired(new Date('2026-10-22T12:14:59.999Z'))).toBe(false);
      expect(v.isExpired(new Date('2026-10-22T12:15:00Z'))).toBe(true);
    });

    it('is compatible only with the same model id and version', () => {
      const v = PhraseValidation.reconstitute(validationProps());
      expect(v.isCompatibleWith(new PhraseModel('MiniLM', 'version'))).toBe(
        true,
      );
      expect(v.isCompatibleWith(new PhraseModel('MiniLM', 'other'))).toBe(
        false,
      );
      expect(v.isCompatibleWith(new PhraseModel('other', 'version'))).toBe(
        false,
      );
    });

    describe('assertCanRegister', () => {
      const valid = {
        text: validationProps().text.value,
        model: new PhraseModel('MiniLM', 'version'),
        confirmed: false,
        now: new Date('2026-10-22T12:01:00Z'),
      };

      it('accepts an applicable validation', () => {
        const v = PhraseValidation.reconstitute(validationProps());
        expect(() => v.verifyUsable(valid)).not.toThrow();
      });

      it('accepts a confirmed alert', () => {
        const v = PhraseValidation.reconstitute({
          ...validationProps(),
          requiresConfirmation: true,
        });
        expect(() =>
          v.verifyUsable({ ...valid, confirmed: true }),
        ).not.toThrow();
      });

      it.each([
        [
          { consumedAt: new Date('2026-10-22T12:00:30Z') },
          {},
          PhraseValidationAlreadyUsedError,
        ],
        [
          {},
          { now: new Date('2026-10-22T12:15:00Z') },
          PhraseValidationExpiredError,
        ],
        [{}, { text: 'Adios' }, PhraseMismatchError],
        [
          {},
          { model: new PhraseModel('other', 'version') },
          IncompatibleValidationModelError,
        ],
        [{ requiresConfirmation: true }, {}, PhraseConfirmationRequiredError],
      ])('rejects with the matching error (%#)', (props, input, errorClass) => {
        const v = PhraseValidation.reconstitute({
          ...validationProps(),
          ...props,
        });
        expect(() => v.verifyUsable({ ...valid, ...input })).toThrow(
          errorClass,
        );
      });
    });
  });
});
