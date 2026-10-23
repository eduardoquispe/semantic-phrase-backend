import { ConfigurationStub } from '../../../../../test/fixtures/configuration';
import { PhraseValidation } from '../../domain/entities/phrase-validation.entity';
import { PhraseId } from '../../domain/value-objects/phrase-id.value-object';
import { PhraseText } from '../../domain/value-objects/phrase-text.value-object';
import { CreatePhraseUseCase } from './create-phrase.use-case';
import { PhraseModel } from '../../domain/value-objects/phrase-model.value-object';
import { NormalizedPhraseText } from '../../domain/value-objects/normalized-phrase-text.value-object';
import { Embedding } from '../../domain/value-objects/embedding.value-object';
import { Phrase } from '../../domain/entities/phrase.entity';
import { PhraseConfirmationRequiredError } from '../../domain/errors/confirmation-required.error';
import { IncompatibleValidationModelError } from '../../domain/errors/incompatible-validation-model.error';
import { PhraseMismatchError } from '../../domain/errors/phrase-mismatch.error';
import { PhraseValidationAlreadyUsedError } from '../../domain/errors/validation-already-used.error';
import { PhraseValidationExpiredError } from '../../domain/errors/validation-expired.error';
import { PhraseValidationNotFoundError } from '../errors/phrase-validation-not-found.error';

describe('CreatePhraseUseCase', () => {
  const model = new PhraseModel('MiniLM', 'v1');
  const props = {
    id: new PhraseId('550e8400-e29b-41d4-a716-446655440000'),
    text: PhraseText.forValidation(' Hola '),
    normalizedText: new NormalizedPhraseText('stored-normalized-text'),
    model,
    embedding: new Embedding(Array<number>(384).fill(0.25)),
    requiresConfirmation: false,
    match: null,
    consumedAt: null,
    createdAt: new Date('2026-10-22'),
    expiresAt: new Date('2099-01-01'),
  };
  const stored = PhraseValidation.reconstitute(props);
  const validations = {
    findById: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  };
  const phrases = {
    list: jest.fn(),
    findValidationMatch: jest.fn(),
    save: jest.fn(),
  };
  const useCase = new CreatePhraseUseCase(
    validations,
    phrases,
    new ConfigurationStub({
      AI_MODEL: model.id,
      AI_EMBEDDING_VERSION: model.version,
    }),
  );
  it.each(['AI_MODEL', 'AI_EMBEDDING_VERSION'])(
    'requires %s during construction',
    (key) => {
      const values: Record<string, unknown> = {
        AI_MODEL: model.id,
        AI_EMBEDDING_VERSION: model.version,
      };
      delete values[key];
      expect(
        () =>
          new CreatePhraseUseCase(
            validations,
            phrases,
            new ConfigurationStub(values),
          ),
      ).toThrow(`Configuration key "${key}" does not exist`);
    },
  );
  const input = { validationId: stored.id, text: stored.text.value };
  beforeEach(() => {
    jest.resetAllMocks();
    validations.findById.mockResolvedValue(stored);
  });
  it.each([undefined, false, true])(
    'constructs and saves the phrase with confirmed=%s',
    async (confirmed) => {
      const before = Date.now();
      const phrase = await useCase.execute({ ...input, confirmed });
      expect(phrase).toBeInstanceOf(Phrase);
      expect(phrase.id).toMatch(
        /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/,
      );
      expect(phrase.text.value).toBe(stored.text.value);
      expect(phrase.normalizedText).toBe(stored.normalizedText);
      expect(phrase.embedding.values).toEqual(stored.embedding.values);
      expect(phrase.model).toBe(stored.model);
      expect(phrase.createdAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(phrase.createdAt.getTime()).toBeLessThanOrEqual(Date.now());
      expect(phrases.save).toHaveBeenCalledWith(phrase);
      expect(validations.findById).toHaveBeenCalledWith(stored.id);
      expect(validations.update).toHaveBeenCalledWith(stored.id, {
        consumedAt: expect.any(Date) as Date,
      });
      expect(phrases.findValidationMatch).not.toHaveBeenCalled();
    },
  );
  it('awaits insertion before consumption and consumption before returning', async () => {
    let inserted!: () => void;
    let consumed!: () => void;
    phrases.save.mockReturnValue(
      new Promise<void>((resolve) => {
        inserted = resolve;
      }),
    );
    validations.update.mockReturnValue(
      new Promise<void>((resolve) => {
        consumed = resolve;
      }),
    );
    let returned = false;
    const pending = useCase.execute(input).then((phrase) => {
      returned = true;
      return phrase;
    });
    await Promise.resolve();
    expect(phrases.save).toHaveBeenCalledTimes(1);
    expect(validations.update).not.toHaveBeenCalled();
    inserted();
    await Promise.resolve();
    expect(validations.update).toHaveBeenCalledTimes(1);
    expect(returned).toBe(false);
    consumed();
    await pending;
    expect(returned).toBe(true);
  });
  it.each([
    [{ ...props, consumedAt: new Date() }, PhraseValidationAlreadyUsedError],
    [{ ...props, expiresAt: new Date(0) }, PhraseValidationExpiredError],
    [{ ...props, text: PhraseText.forValidation('hola') }, PhraseMismatchError],
    [
      { ...props, model: new PhraseModel('other', 'v1') },
      IncompatibleValidationModelError,
    ],
    [
      { ...props, model: new PhraseModel(model.id, 'other') },
      IncompatibleValidationModelError,
    ],
    [{ ...props, requiresConfirmation: true }, PhraseConfirmationRequiredError],
  ])(
    'rejects inapplicable validation before writes (%#)',
    async (validation, errorClass) => {
      validations.findById.mockResolvedValue(
        PhraseValidation.reconstitute(validation),
      );
      for (const confirmed of errorClass === PhraseConfirmationRequiredError
        ? [undefined, false]
        : [undefined, false, true]) {
        await expect(useCase.execute({ ...input, confirmed })).rejects.toThrow(
          errorClass,
        );
      }
      expect(phrases.save).not.toHaveBeenCalled();
      expect(validations.update).not.toHaveBeenCalled();
    },
  );
  it('rejects unknown validation before writes', async () => {
    validations.findById.mockResolvedValue(null);
    await expect(useCase.execute(input)).rejects.toBeInstanceOf(
      PhraseValidationNotFoundError,
    );
    expect(phrases.save).not.toHaveBeenCalled();
    expect(validations.update).not.toHaveBeenCalled();
  });
  it('allows explicit confirmation of a stored alert', async () => {
    validations.findById.mockResolvedValue(
      PhraseValidation.reconstitute({
        ...props,
        requiresConfirmation: true,
      }),
    );
    await expect(
      useCase.execute({ ...input, confirmed: true }),
    ).resolves.toBeInstanceOf(Phrase);
  });
  it.each([undefined, false, true])(
    'rejects expiry at equality even with confirmed=%s',
    async (confirmed) => {
      jest.useFakeTimers().setSystemTime(props.expiresAt);
      try {
        await expect(useCase.execute({ ...input, confirmed })).rejects.toThrow(
          PhraseValidationExpiredError,
        );
        expect(phrases.save).not.toHaveBeenCalled();
        expect(validations.update).not.toHaveBeenCalled();
      } finally {
        jest.useRealTimers();
      }
    },
  );
  it('validates direct input before reading persistence', async () => {
    await expect(useCase.execute({ ...input, text: 'a\nb' })).rejects.toThrow();
    expect(validations.findById).not.toHaveBeenCalled();
    expect(phrases.save).not.toHaveBeenCalled();
    expect(validations.update).not.toHaveBeenCalled();
  });
  it('propagates read failure without writes', async () => {
    const error = new Error('read failed');
    validations.findById.mockRejectedValueOnce(error);
    await expect(useCase.execute(input)).rejects.toBe(error);
    expect(phrases.save).not.toHaveBeenCalled();
    expect(validations.update).not.toHaveBeenCalled();
  });
  it('does not consume when insertion fails', async () => {
    const error = new Error('insert failed');
    phrases.save.mockRejectedValueOnce(error);
    await expect(useCase.execute(input)).rejects.toBe(error);
    expect(validations.update).not.toHaveBeenCalled();
  });
  it('propagates consumption failure after inserting without compensation', async () => {
    const inserted: Phrase[] = [];
    phrases.save.mockImplementation((phrase: Phrase) => {
      inserted.push(phrase);
      return Promise.resolve();
    });
    const error = new Error('consume failed');
    validations.update.mockRejectedValueOnce(error);
    await expect(useCase.execute(input)).rejects.toBe(error);
    expect(inserted).toHaveLength(1);
    expect(phrases.save).toHaveBeenCalledTimes(1);
    expect(validations.update).toHaveBeenCalledTimes(1);
  });
});
