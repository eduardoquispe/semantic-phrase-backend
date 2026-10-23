import { ConfigurationStub } from '../../../../../test/fixtures/configuration';
import { teiConfig } from '../../../../../test/fixtures/tei';
import { ValidatePhraseUseCase } from './validate-phrase.use-case';
import { Embedding } from '../../domain/value-objects/embedding.value-object';
import { PhraseModel } from '../../domain/value-objects/phrase-model.value-object';
import { SimilarityScore } from '../../domain/value-objects/similarity-score.value-object';
import { PhraseValidation } from '../../domain/entities/phrase-validation.entity';
import { IncompatiblePhraseCollectionError } from '../errors/incompatible-phrase-collection.error';
import { InvalidPhraseTextError } from '../../domain/errors/invalid-phrase-text.error';
import { ValidationMatchEnum } from '../../domain/enums/validation-match.enum';
describe('ValidatePhraseUseCase', () => {
  const generator = { generate: jest.fn() };
  const repository = {
    list: jest.fn(),
    findValidationMatch: jest.fn(),
    save: jest.fn(),
  };
  const validations = {
    findById: jest.fn(),
    update: jest.fn(),
    save: jest.fn<Promise<void>, [PhraseValidation]>(),
  };
  const settings = { threshold: 0.8538613695045911, ttlMinutes: 15 };
  const useCase = new ValidatePhraseUseCase(
    generator,
    repository,
    validations,
    new ConfigurationStub(),
  );
  const phrase = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    text: 'Candidate',
  };
  const generated = {
    embedding: new Embedding([1, ...Array<number>(383).fill(0)]),
    model: new PhraseModel(teiConfig.AI_MODEL, teiConfig.AI_EMBEDDING_VERSION),
  };
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-22T12:00:00.999Z'));
    jest.resetAllMocks();
    generator.generate.mockResolvedValue(generated);
    repository.findValidationMatch.mockResolvedValue(null);
    validations.save.mockResolvedValue(undefined);
  });
  afterEach(() => jest.useRealTimers());
  it('generates with original, resolves textual first, saves before returning without creating a phrase', async () => {
    repository.findValidationMatch.mockResolvedValue({
      type: ValidationMatchEnum.TextualExact,
      phrase,
      similarityScore: null,
    });
    const result = await useCase.execute({ text: ' Hola   Cusco ' });
    expect(generator.generate).toHaveBeenCalledWith(' Hola   Cusco ');
    expect(repository.findValidationMatch).toHaveBeenCalledWith({
      ...generated,
      normalizedText: 'hola cusco',
    });
    expect(result.match).toEqual({
      type: ValidationMatchEnum.TextualExact,
      phrase,
      similarityScore: null,
    });
    expect(result.requiresConfirmation).toBe(true);
    const saved = validations.save.mock.calls[0][0];
    expect(saved.normalizedText).toBe('hola cusco');
    expect(saved.requiresConfirmation).toBe(true);
    expect(saved.consumedAt).toBeNull();
    expect(saved.match).toBe(result.match);
    expect(result.validationId).toBe(saved.id);
    expect(repository.list).not.toHaveBeenCalled();
  });
  it.each([-0.7, 0.853861369504591, 0.8538613695045911, 0.9])(
    'compares score %s inclusively without rounding',
    async (score) => {
      repository.findValidationMatch.mockResolvedValue({
        type: ValidationMatchEnum.Vector,
        phrase,
        similarityScore: new SimilarityScore(score),
      });
      const result = await useCase.execute({ text: 'Hola' });
      expect(result.requiresConfirmation).toBe(score >= settings.threshold);
      const saved = validations.save.mock.calls[0][0];
      expect(saved.requiresConfirmation).toBe(score >= settings.threshold);
      expect(saved.normalizedText).toBe('hola');
      expect(saved.consumedAt).toBeNull();
      expect(saved.match).toBe(result.match);
      expect(result.match?.phrase).toEqual(phrase);
      expect(result.match?.similarityScore?.value).toBe(score);
    },
  );
  it('supports empty corpus with embedding preserved and no additional writes', async () => {
    const result = await useCase.execute({ text: ' Hola ' });
    expect(result.match).toBeNull();
    expect(result.requiresConfirmation).toBe(false);
    expect(generator.generate).toHaveBeenCalledTimes(1);
    const v = validations.save.mock.calls[0][0];
    expect(v.normalizedText).toBe('hola');
    expect(v.requiresConfirmation).toBe(false);
    expect(v.consumedAt).toBeNull();
    expect(v.match).toBeNull();
    expect(v.embedding.values).toEqual(generated.embedding.values);
    expect(v.model).toEqual(generated.model);
    expect(validations.save).toHaveBeenCalledTimes(1);
  });
  it('rejects incompatible collection after inference before save', async () => {
    repository.findValidationMatch.mockRejectedValue(
      new IncompatiblePhraseCollectionError(),
    );
    await expect(useCase.execute({ text: 'Hola' })).rejects.toBeInstanceOf(
      IncompatiblePhraseCollectionError,
    );
    expect(generator.generate).toHaveBeenCalledTimes(1);
    expect(validations.save).not.toHaveBeenCalled();
  });
  it.each(['', ' ', 'a\nb', '😀'.repeat(281), null, 42])(
    'rejects invalid direct input before inference',
    async (text) => {
      await expect(
        useCase.execute({ text: text as string }),
      ).rejects.toBeInstanceOf(InvalidPhraseTextError);
      expect(generator.generate).not.toHaveBeenCalled();
      expect(repository.findValidationMatch).not.toHaveBeenCalled();
      expect(validations.save).not.toHaveBeenCalled();
    },
  );
  it.each(['generate', 'find', 'save'])(
    'stops effects after %s fails and allows manual retry',
    async (stage) => {
      const failure = new Error('private failure');
      const operation = {
        generate: generator.generate,
        find: repository.findValidationMatch,
        save: validations.save,
      }[stage];
      operation?.mockRejectedValueOnce(failure);
      await expect(useCase.execute({ text: 'Hola' })).rejects.toBe(failure);
      if (stage === 'generate')
        expect(repository.findValidationMatch).not.toHaveBeenCalled();
      if (stage === 'generate' || stage === 'find')
        expect(validations.save).not.toHaveBeenCalled();
      await expect(useCase.execute({ text: 'Hola' })).resolves.toHaveProperty(
        'validationId',
      );
    },
  );
  it('uses one second-aligned clock for saved dates and response and creates independent UUIDs', async () => {
    const first = await useCase.execute({ text: ' Hola ' });
    const previous = validations.save.mock.calls[0][0];
    await useCase.execute({ text: 'Otra' });
    const next = validations.save.mock.calls[1][0];
    expect(previous.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(next.id).not.toBe(previous.id);
    expect(previous.createdAt.toISOString()).toBe('2026-10-22T12:00:00.000Z');
    expect(previous.expiresAt.toISOString()).toBe('2026-10-22T12:15:00.000Z');
    expect(first.expiresAt).toEqual(previous.expiresAt);
    expect(first.validationId).toBe(previous.id);
    expect(previous.text.value).toBe(' Hola ');
    expect(previous.consumedAt).toBeNull();
  });
  it('honors configurable TTL', async () => {
    const custom = new ValidatePhraseUseCase(
      generator,
      repository,
      validations,
      new ConfigurationStub({ PHRASE_VALIDATION_TTL_MINUTES: '2' }),
    );
    const result = await custom.execute({ text: 'Hola' });
    expect(result.expiresAt.toISOString()).toBe('2026-10-22T12:02:00.000Z');
  });
});
