import { DrizzlePhraseMapper } from './drizzle-phrase.mapper';
import { InvalidPhraseValidationError } from '../../../../domain/errors/invalid-phrase-validation.error';
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
import { PhraseStatusEnum } from '../../../../domain/enums/phrase-status.enum';
import { ValidationMatchEnum } from '../../../../domain/enums/validation-match.enum';

describe('findValidationMatch', () => {
  const results: Promise<Record<string, unknown>[]>[] = [];
  const wheres: SQL[] = [];
  const orderBys: SQL[][] = [];
  interface Builder {
    from: () => Builder;
    where: (condition: SQL) => Builder;
    orderBy: (...order: SQL[]) => Builder;
    limit: () => Promise<Record<string, unknown>[]> | undefined;
  }
  const builder: Builder = {
    from: () => builder,
    where: (condition) => {
      wheres.push(condition);
      return builder;
    },
    orderBy: (...order) => {
      orderBys.push(order);
      return builder;
    },
    limit: () => results.shift(),
  };
  const select = jest.fn(() => builder);
  const repository = new DrizzlePhraseRepository({
    client: { select },
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
  const dialect = new PgDialect();
  const queue = (...rows: Record<string, unknown>[][]) =>
    rows.forEach((r) => results.push(Promise.resolve(r)));
  beforeEach(() => {
    results.length = 0;
    wheres.length = 0;
    orderBys.length = 0;
    select.mockClear();
  });
  it('parameterizes searches and orders candidates deterministically', async () => {
    queue([], [{ ...phrase, distance: 0.2 }]);
    await repository.findValidationMatch(input);
    expect(select).toHaveBeenCalledTimes(2);
    const textual = dialect.sqlToQuery(wheres[0]);
    const textualOrder = orderBys[0].map((o) => dialect.sqlToQuery(o).sql);
    const vectorWhere = dialect.sqlToQuery(wheres[1]);
    const vectorOrder = orderBys[1].map((o) => dialect.sqlToQuery(o));
    expect(textual.sql).not.toContain(input.normalizedText);
    expect(textual.params).toContain(input.normalizedText);
    expect(textualOrder.join(',')).toMatch(/created_at" desc.*"id" desc/i);
    expect(vectorWhere.params).toContain(teiConfig.AI_MODEL);
    expect(vectorWhere.params).toContain(teiConfig.AI_EMBEDDING_VERSION);
    expect(vectorOrder[0].sql).toContain('<=>');
    expect(vectorOrder[0].params).toContain(
      JSON.stringify(input.embedding.values),
    );
    expect(vectorOrder[0].sql).toMatch(/asc$/i);
    expect(vectorOrder[1].sql).toMatch(/"id" asc/i);
  });
  it('restricts every search stage to active phrases', async () => {
    queue([], [], []);
    await repository.findValidationMatch(input);
    expect(wheres).toHaveLength(3);
    for (const condition of wheres) {
      const { sql, params } = dialect.sqlToQuery(condition);
      expect(sql).toMatch(/"status" = \$\d+/);
      expect(params).toContain(PhraseStatusEnum.ACTIVE);
    }
    expect(select).toHaveBeenCalledTimes(3);
  });
  it.each([-1, -0.7, 0.8538613695045911, 1])(
    'preserves exact cosine %s',
    async (score) => {
      queue([], [{ ...phrase, distance: 1 - score }]);
      const result = await repository.findValidationMatch(input);
      expect(result?.type).toBe('vector');
      if (result?.type === ValidationMatchEnum.Vector)
        expect(result.similarityScore.value).toBe(1 - (1 - score));
    },
  );
  it.each([1 + 5e-7, -1 - 5e-7])(
    'clamps numerical epsilon %s only at the edge',
    async (score) => {
      queue([], [{ ...phrase, distance: 1 - score }]);
      const result = await repository.findValidationMatch(input);
      if (result?.type === ValidationMatchEnum.Vector)
        expect(Math.abs(result.similarityScore.value)).toBe(1);
    },
  );
  it.each([NaN, 1.01, -1.01])('rejects corrupt score %s', async (score) => {
    queue([], [{ ...phrase, distance: 1 - score }]);
    await expect(repository.findValidationMatch(input)).rejects.toBeInstanceOf(
      InvalidPhraseValidationError,
    );
  });
  it('projects text only, ignoring incompatible vector metadata', async () => {
    queue([phrase]);
    expect(await repository.findValidationMatch(input)).toEqual({
      type: ValidationMatchEnum.TextualExact,
      phrase,
      similarityScore: null,
    });
    expect(select).toHaveBeenCalledTimes(1);
  });
  it('returns null for an empty collection', async () => {
    queue([], [], []);
    await expect(repository.findValidationMatch(input)).resolves.toBeNull();
    expect(select).toHaveBeenCalledTimes(3);
  });
  it('rejects a nonempty collection without textual or compatible vector matches', async () => {
    queue([], [], [phrase]);
    await expect(repository.findValidationMatch(input)).rejects.toBeInstanceOf(
      IncompatiblePhraseCollectionError,
    );
    expect(select).toHaveBeenCalledTimes(3);
  });
  it.each([
    [{ cause: { code: '08006' } }, DatabaseError],
    [new Error('SQL'), DatabaseError],
    [{ code: '23505', detail: 'private constraint data' }, DatabaseError],
  ])(
    'wraps failures with their cause from every search stage',
    async (error, kind) => {
      for (const stage of [0, 1, 2]) {
        results.length = 0;
        select.mockClear();
        for (let previous = 0; previous < stage; previous++) queue([]);
        // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
        results.push(Promise.reject(error));
        await expect(
          repository.findValidationMatch(input),
        ).rejects.toMatchObject({ name: kind.name, cause: error });
        expect(select).toHaveBeenCalledTimes(stage + 1);
      }
    },
  );
});

describe('list phrases', () => {
  const countWhere = jest.fn();
  const from = jest.fn();
  const offset = jest.fn();
  const select = jest.fn(() => ({ from }));
  const repository = new DrizzlePhraseRepository({
    client: { select },
  } as unknown as DatabaseProvider);
  beforeEach(() => jest.resetAllMocks());
  function setup() {
    select.mockReturnValue({ from });
    countWhere.mockResolvedValueOnce([{ total: '1' }]);
    from.mockReturnValueOnce({ where: countWhere }).mockReturnValueOnce({
      where: () => ({ orderBy: () => ({ limit: () => ({ offset }) }) }),
    });
  }
  it.each([{ code: 'ECONNREFUSED' }, new Error('SQL'), { code: '23505' }])(
    'wraps count and page query errors with their cause: %p',
    async (cause) => {
      from.mockReturnValueOnce({ where: countWhere });
      countWhere.mockRejectedValueOnce(cause);
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

describe('softDelete phrase', () => {
  const returning = jest.fn();
  const where = jest.fn();
  const set = jest.fn();
  const update = jest.fn();
  const repository = new DrizzlePhraseRepository({
    client: { update },
  } as unknown as DatabaseProvider);
  const id = '550e8400-e29b-41d4-a716-446655440000';
  beforeEach(() => {
    jest.resetAllMocks();
    where.mockReturnValue({ returning });
    set.mockReturnValue({ where });
    update.mockReturnValue({ set });
  });
  it('marks an active phrase as deleted', async () => {
    returning.mockResolvedValueOnce([{ id }]);
    await expect(repository.softDelete(id)).resolves.toBe(true);
    expect(update).toHaveBeenCalledWith(DrizzlePhrasesModel);
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({ status: PhraseStatusEnum.DELETED }),
    );
  });
  it('returns false when no active phrase matched', async () => {
    returning.mockResolvedValueOnce([]);
    await expect(repository.softDelete(id)).resolves.toBe(false);
  });
  it.each([new Error('SQL'), { code: 'ECONNRESET' }])(
    'wraps failures as DatabaseError: %p',
    async (cause) => {
      returning.mockRejectedValueOnce(cause);
      await expect(repository.softDelete(id)).rejects.toMatchObject({
        name: 'DatabaseError',
        cause,
      });
    },
  );
});
