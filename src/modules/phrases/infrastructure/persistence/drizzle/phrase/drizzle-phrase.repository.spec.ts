import { DrizzlePhraseMapper } from './drizzle-phrase.mapper';
import { InvalidPhraseValidationError } from '../../../../domain/errors/invalid-phrase-validation.error';
import { Phrase } from '../../../../domain/entities/phrase.entity';
import { PhraseId } from '../../../../domain/value-objects/phrase-id.value-object';
import { PhraseText } from '../../../../domain/value-objects/phrase-text.value-object';
import { DrizzlePhrasesModel } from './drizzle-phrases.model';
import { teiConfig } from '../../../../../../../test/fixtures/tei';
import { IncompatiblePhraseCollectionError } from '../../../../application/errors/incompatible-phrase-collection.error';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';
import { DrizzlePhraseRepository } from './drizzle-phrase.repository';
import { DatabaseProvider } from '../../../../../../shared/infrastructure/database/database.provider';
import { Embedding } from '../../../../domain/value-objects/embedding.value-object';
import { PhraseModel } from '../../../../domain/value-objects/phrase-model.value-object';
import { DatabaseError } from '../../../../../../shared/infrastructure/database/errors/database.error';
import { ValidationMatchEnum } from '../../../../domain/enums/validation-match.enum';

describe('findValidationMatch', () => {
  const execute = jest.fn<
    Promise<{ rows: Record<string, unknown>[] }>,
    [SQL]
  >();
  const repository = new DrizzlePhraseRepository({
    client: { execute },
  } as unknown as DatabaseProvider);
  const input = {
    normalizedText: "private ' text",
    embedding: new Embedding([1, ...Array<number>(383).fill(0)]),
    model: new PhraseModel(teiConfig.AI_MODEL, teiConfig.AI_EMBEDDING_VERSION),
  };
  const phrase = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    text: 'Candidate',
  };
  beforeEach(() => execute.mockReset());
  it('parameterizes searches and orders candidates deterministically', async () => {
    execute
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ ...phrase, distance: 0.2 }] });
    await repository.findValidationMatch(input);
    expect(execute).toHaveBeenCalledTimes(2);
    const dialect = new PgDialect();
    const textual = dialect.sqlToQuery(execute.mock.calls[0][0]);
    const vector = dialect.sqlToQuery(execute.mock.calls[1][0]);
    expect(textual.sql).not.toContain(input.normalizedText);
    expect(textual.params).toContain(input.normalizedText);
    expect(textual.sql).toMatch(/created_at DESC, id DESC/i);
    expect(textual.sql).not.toContain('<=>');
    expect(vector.params).toContain(teiConfig.AI_MODEL);
    expect(vector.params).toContain(teiConfig.AI_EMBEDDING_VERSION);
    expect(vector.params).toContain(JSON.stringify(input.embedding.values));
    expect(vector.sql).toMatch(/distance ASC, id ASC/i);
    expect(vector.sql).toContain('<=>');
  });
  it.each([-1, -0.7, 0.8538613695045911, 1])(
    'preserves exact cosine %s',
    async (score) => {
      execute.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({
        rows: [
          { type: ValidationMatchEnum.Vector, ...phrase, distance: 1 - score },
        ],
      });
      const result = await repository.findValidationMatch(input);
      expect(result?.type).toBe('vector');
      if (result?.type === ValidationMatchEnum.Vector)
        expect(result.similarityScore.value).toBe(1 - (1 - score));
    },
  );
  it.each([1 + 5e-7, -1 - 5e-7])(
    'clamps numerical epsilon %s only at the edge',
    async (score) => {
      execute.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({
        rows: [
          { type: ValidationMatchEnum.Vector, ...phrase, distance: 1 - score },
        ],
      });
      const result = await repository.findValidationMatch(input);
      if (result?.type === ValidationMatchEnum.Vector)
        expect(Math.abs(result.similarityScore.value)).toBe(1);
    },
  );
  it.each([NaN, 1.01, -1.01])('rejects corrupt score %s', async (score) => {
    execute.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({
      rows: [
        { type: ValidationMatchEnum.Vector, ...phrase, distance: 1 - score },
      ],
    });
    await expect(repository.findValidationMatch(input)).rejects.toBeInstanceOf(
      InvalidPhraseValidationError,
    );
  });
  it('projects text only, ignoring incompatible vector metadata', async () => {
    execute.mockResolvedValue({
      rows: [phrase],
    });
    expect(await repository.findValidationMatch(input)).toEqual({
      type: ValidationMatchEnum.TextualExact,
      phrase,
      similarityScore: null,
    });
    expect(execute).toHaveBeenCalledTimes(1);
  });
  it('returns null for an empty collection', async () => {
    execute.mockResolvedValue({ rows: [] });
    await expect(repository.findValidationMatch(input)).resolves.toBeNull();
    expect(execute).toHaveBeenCalledTimes(3);
  });
  it('rejects a nonempty collection without textual or compatible vector matches', async () => {
    execute
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [phrase] });
    await expect(repository.findValidationMatch(input)).rejects.toBeInstanceOf(
      IncompatiblePhraseCollectionError,
    );
    expect(execute).toHaveBeenCalledTimes(3);
  });
  it.each([
    [{ cause: { code: '08006' } }, DatabaseError],
    [new Error('SQL'), DatabaseError],
    [{ code: '23505', detail: 'private constraint data' }, DatabaseError],
  ])(
    'wraps failures with their cause from every search stage',
    async (error, kind) => {
      for (const stage of [0, 1, 2]) {
        execute.mockReset();
        for (let previous = 0; previous < stage; previous++)
          execute.mockResolvedValueOnce({ rows: [] });
        execute.mockRejectedValueOnce(error);
        await expect(
          repository.findValidationMatch(input),
        ).rejects.toMatchObject({ name: kind.name, cause: error });
        expect(execute).toHaveBeenCalledTimes(stage + 1);
      }
    },
  );
});

describe('save phrase', () => {
  const values = jest.fn();
  const insert = jest.fn(() => ({ values }));
  const repository = new DrizzlePhraseRepository({
    client: { insert },
  } as unknown as DatabaseProvider);
  const phrase = new Phrase({
    id: new PhraseId('550e8400-e29b-41d4-a716-446655440000'),
    text: PhraseText.forValidation(' Hola '),
    normalizedText: 'stored-normalized',
    embedding: new Embedding(Array<number>(384).fill(0.25)),
    modelId: 'MiniLM',
    modelVersion: 'v1',
    createdAt: new Date('2026-10-22T12:00:00Z'),
  });
  beforeEach(() => jest.clearAllMocks());
  it('awaits a normal INSERT with all stored phrase data', async () => {
    let finish!: () => void;
    values.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    );
    let saved = false;
    const pending = repository.save(phrase).then(() => {
      saved = true;
    });
    await Promise.resolve();
    expect(saved).toBe(false);
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalledWith(DrizzlePhrasesModel);
    expect(values).toHaveBeenCalledWith({
      id: phrase.id,
      text: ' Hola ',
      normalizedText: 'stored-normalized',
      embedding: JSON.stringify(phrase.embedding.values),
      modelId: 'MiniLM',
      modelVersion: 'v1',
      createdAt: phrase.createdAt,
    });
    finish();
    await pending;
    expect(saved).toBe(true);
  });
  it('propagates mapping failures before INSERT', async () => {
    const error = new Error('mapping failure');
    const mapper = jest
      .spyOn(DrizzlePhraseMapper, 'toPersistence')
      .mockImplementationOnce(() => {
        throw error;
      });
    await expect(repository.save(phrase)).rejects.toBe(error);
    expect(insert).not.toHaveBeenCalled();
    mapper.mockRestore();
  });
  it.each([
    [{ cause: { code: 'ECONNRESET' } }, DatabaseError],
    [new Error('SQL'), DatabaseError],
    [{ code: '23505', detail: 'private constraint data' }, DatabaseError],
  ])('propagates insert errors', async (error, kind) => {
    values.mockRejectedValueOnce(error);
    await expect(repository.save(phrase)).rejects.toMatchObject({
      name: kind.name,
      cause: error,
    });
  });
});

describe('list phrases', () => {
  const from = jest.fn();
  const offset = jest.fn();
  const select = jest.fn(() => ({ from }));
  const repository = new DrizzlePhraseRepository({
    client: { select },
  } as unknown as DatabaseProvider);
  beforeEach(() => jest.resetAllMocks());
  function setup() {
    select.mockReturnValue({ from });
    from.mockResolvedValueOnce([{ total: '1' }]).mockReturnValueOnce({
      orderBy: () => ({ limit: () => ({ offset }) }),
    });
  }
  it.each([{ code: 'ECONNREFUSED' }, new Error('SQL'), { code: '23505' }])(
    'wraps count and page query errors with their cause: %p',
    async (cause) => {
      from.mockRejectedValueOnce(cause);
      select.mockReturnValue({ from });
      await expect(repository.list(1, 20)).rejects.toMatchObject({
        name: 'DatabaseError',
        cause,
      });
      setup();
      offset.mockRejectedValueOnce(cause);
      await expect(repository.list(1, 20)).rejects.toMatchObject({
        name: 'DatabaseError',
        cause,
      });
    },
  );
  it('maps a successful page outside the query error boundary', async () => {
    setup();
    offset.mockResolvedValueOnce([]);
    await expect(repository.list(2, 20)).resolves.toEqual({
      data: [],
      total: 1,
    });
    expect(offset).toHaveBeenCalledWith(20);
    setup();
    offset.mockResolvedValueOnce([]);
    const error = new Error('mapping failure');
    const mapper = jest
      .spyOn(DrizzlePhraseMapper, 'toDomainMany')
      .mockImplementationOnce(() => {
        throw error;
      });
    await expect(repository.list(1, 20)).rejects.toBe(error);
    mapper.mockRestore();
  });
});
