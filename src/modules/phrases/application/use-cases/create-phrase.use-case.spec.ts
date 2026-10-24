import { ConfigurationStub } from '../../../../../test/fixtures/configuration';
import { PhraseValidation } from '../../domain/entities/phrase-validation.entity';
import { PhraseId } from '../../domain/value-objects/phrase-id.value-object';
import { PhraseText } from '../../domain/value-objects/phrase-text.value-object';
import { CreatePhraseUseCase } from './create-phrase.use-case';
import { PhraseModel } from '../../domain/value-objects/phrase-model.value-object';
import { Embedding } from '../../domain/value-objects/embedding.value-object';
import { Phrase } from '../../domain/entities/phrase.entity';
import { PhraseRegistrationError } from '../errors/phrase-registration.error';

describe('CreatePhraseUseCase', () => {
  const model = new PhraseModel('MiniLM', 'v1');
  const props = {
    id: new PhraseId('550e8400-e29b-41d4-a716-446655440000'),
    text: PhraseText.forValidation(' Hola '),
    normalizedText: 'stored-normalized-text',
    model,
    embedding: new Embedding(Array<number>(384).fill(0.25)),
    requiresConfirmation: false,
    match: null,
    consumedAt: null,
    createdAt: new Date('2026-10-22'),
    expiresAt: new Date('2099-01-01'),
  };
  const stored = new PhraseValidation(props);
  const validations = {
    findById: jest.fn(),
    save: jest.fn(),
  };
  const registration = { register: jest.fn() };
  const useCase = new CreatePhraseUseCase(
    validations,
    registration,
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
            registration,
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
      expect(phrase.modelId).toBe(model.id);
      expect(phrase.modelVersion).toBe(model.version);
      expect(phrase.createdAt.getTime()).toBeGreaterThanOrEqual(before);
      expect(phrase.createdAt.getTime()).toBeLessThanOrEqual(Date.now());
      expect(registration.register).toHaveBeenCalledTimes(1);
      expect(registration.register).toHaveBeenCalledWith(
        phrase,
        stored.id,
        expect.any(Date),
      );
      expect(validations.findById).toHaveBeenCalledWith(stored.id);
    },
  );
  it('awaits the atomic registration before returning', async () => {
    let registered!: () => void;
    registration.register.mockReturnValue(
      new Promise<void>((resolve) => {
        registered = resolve;
      }),
    );
    let returned = false;
    const pending = useCase.execute(input).then((phrase) => {
      returned = true;
      return phrase;
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(registration.register).toHaveBeenCalledTimes(1);
    expect(returned).toBe(false);
    registered();
    await pending;
    expect(returned).toBe(true);
  });
  it.each([
    [null, 'INVALID_VALIDATION_ID'],
    [{ ...props, consumedAt: new Date() }, 'VALIDATION_ALREADY_USED'],
    [{ ...props, expiresAt: new Date(0) }, 'VALIDATION_EXPIRED'],
    [{ ...props, text: PhraseText.forValidation('hola') }, 'PHRASE_MISMATCH'],
    [{ ...props, model: new PhraseModel('other', 'v1') }, 'INCOMPATIBLE_MODEL'],
    [
      { ...props, model: new PhraseModel(model.id, 'other') },
      'INCOMPATIBLE_MODEL',
    ],
    [{ ...props, requiresConfirmation: true }, 'CONFIRMATION_REQUIRED'],
  ])(
    'rejects inapplicable validation before writes (%s)',
    async (validation, message) => {
      validations.findById.mockResolvedValue(
        validation === null ? null : new PhraseValidation(validation),
      );
      for (const confirmed of message === 'CONFIRMATION_REQUIRED'
        ? [undefined, false]
        : [undefined, false, true]) {
        await expect(useCase.execute({ ...input, confirmed })).rejects.toThrow(
          message,
        );
      }
      expect(registration.register).not.toHaveBeenCalled();
    },
  );
  it('allows explicit confirmation of a stored alert', async () => {
    validations.findById.mockResolvedValue(
      new PhraseValidation({
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
          'VALIDATION_EXPIRED',
        );
        expect(registration.register).not.toHaveBeenCalled();
      } finally {
        jest.useRealTimers();
      }
    },
  );
  it('validates direct input before reading persistence', async () => {
    await expect(useCase.execute({ ...input, text: 'a\nb' })).rejects.toThrow();
    expect(validations.findById).not.toHaveBeenCalled();
    expect(registration.register).not.toHaveBeenCalled();
  });
  it('propagates read failure without writes', async () => {
    const error = new Error('read failed');
    validations.findById.mockRejectedValueOnce(error);
    await expect(useCase.execute(input)).rejects.toBe(error);
    expect(registration.register).not.toHaveBeenCalled();
  });
  it.each([
    new Error('register failed'),
    new PhraseRegistrationError('VALIDATION_ALREADY_USED'),
  ])('propagates registration failure: %p', async (error) => {
    registration.register.mockRejectedValueOnce(error);
    await expect(useCase.execute(input)).rejects.toBe(error);
    expect(registration.register).toHaveBeenCalledTimes(1);
  });
});
