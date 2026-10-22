import { teiConfig } from '../../../../../../../test/fixtures/tei';
import { IncompatiblePhraseCollectionError } from '../../../../application/errors/incompatible-phrase-collection.error';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';
import { DrizzlePhraseRepository } from './drizzle-phrase.repository';
import { DatabaseProvider } from '../../../../../../shared/infrastructure/database/database.provider';
import { Embedding } from '../../../../domain/value-objects/embedding.value-object';
import { PhraseModel } from '../../../../domain/value-objects/phrase-model.value-object';
import { DatabaseUnavailableError } from '../../../../../../shared/infrastructure/database/errors/database-unavailable.error';
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
    await expect(repository.findValidationMatch(input)).rejects.toThrow();
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
    [{ cause: { code: '08006' } }, DatabaseUnavailableError],
    [new Error('SQL'), Error],
  ])(
    'propagates selective failures from every search stage',
    async (error, kind) => {
      for (const stage of [0, 1, 2]) {
        execute.mockReset();
        for (let previous = 0; previous < stage; previous++)
          execute.mockResolvedValueOnce({ rows: [] });
        execute.mockRejectedValueOnce(error);
        await expect(
          repository.findValidationMatch(input),
        ).rejects.toBeInstanceOf(kind);
        expect(execute).toHaveBeenCalledTimes(stage + 1);
      }
    },
  );
});
