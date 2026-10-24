import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';
import { PhraseValidationAlreadyUsedError } from '../../../../domain/errors/validation-already-used.error';
import { Phrase } from '../../../../domain/entities/phrase.entity';
import { Embedding } from '../../../../domain/value-objects/embedding.value-object';
import { PhraseId } from '../../../../domain/value-objects/phrase-id.value-object';
import { PhraseText } from '../../../../domain/value-objects/phrase-text.value-object';
import { DatabaseProvider } from '../../../../../../shared/infrastructure/database/database.provider';
import { DatabaseError } from '../../../../../../shared/infrastructure/database/errors/database.error';
import { DrizzlePhraseMapper } from '../phrase/drizzle-phrase.mapper';
import { DrizzlePhrasesModel } from '../phrase/drizzle-phrases.model';
import { DrizzlePhraseValidationsModel } from '../phrase-validation/drizzle-phrase-validations.model';
import { DrizzlePhraseRegistrationRepository } from './drizzle-phrase-registration.repository';
import { NormalizedPhraseText } from '../../../../domain/value-objects/normalized-phrase-text.value-object';
import { PhraseModel } from '../../../../domain/value-objects/phrase-model.value-object';

describe('DrizzlePhraseRegistrationRepository', () => {
  const validationId = '660e8400-e29b-41d4-a716-446655440000';
  const phrase = Phrase.reconstitute({
    id: new PhraseId('550e8400-e29b-41d4-a716-446655440000'),
    text: new PhraseText(' Hola '),
    normalizedText: new NormalizedPhraseText('stored-normalized'),
    embedding: new Embedding(Array<number>(384).fill(0.25)),
    model: new PhraseModel('MiniLM', 'v1'),
    createdAt: new Date('2026-10-22T12:00:00Z'),
  });
  const calls: string[] = [];
  const returning = jest.fn();
  const where = jest.fn<unknown, [SQL]>(() => ({ returning }));
  const set = jest.fn(() => ({ where }));
  const update = jest.fn(() => {
    calls.push('update');
    return { set };
  });
  const values = jest.fn();
  const insert = jest.fn(() => {
    calls.push('insert');
    return { values };
  });
  const tx = { update, insert };
  const transaction = jest.fn(
    async (callback: (tx: unknown) => Promise<void>) => {
      calls.push('begin');
      await callback(tx);
      calls.push('commit');
    },
  );
  const repository = new DrizzlePhraseRegistrationRepository({
    client: { transaction },
  } as unknown as DatabaseProvider);

  beforeEach(() => {
    jest.clearAllMocks();
    calls.length = 0;
    returning.mockResolvedValue([{ id: validationId }]);
    values.mockResolvedValue(undefined);
  });

  it('consumes the validation then inserts the phrase in one transaction', async () => {
    await repository.register(phrase, validationId);
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(calls).toEqual(['begin', 'update', 'insert', 'commit']);
    expect(update).toHaveBeenCalledWith(DrizzlePhraseValidationsModel);
    expect(set).toHaveBeenCalledWith({ consumedAt: phrase.createdAt });
    const query = new PgDialect().sqlToQuery(where.mock.calls[0][0]);
    expect(query.sql).toBe(
      '("phrase_validations"."id" = $1 and "phrase_validations"."consumed_at" is null)',
    );
    expect(query.params).toEqual([validationId]);
    expect(insert).toHaveBeenCalledWith(DrizzlePhrasesModel);
    expect(values).toHaveBeenCalledWith(
      DrizzlePhraseMapper.toPersistence(phrase),
    );
  });

  it('rolls back without inserting when the validation was already consumed', async () => {
    returning.mockResolvedValueOnce([]);
    await expect(repository.register(phrase, validationId)).rejects.toEqual(
      new PhraseValidationAlreadyUsedError(),
    );
    expect(insert).not.toHaveBeenCalled();
    expect(calls).toEqual(['begin', 'update']);
  });

  it.each([
    ['update', { cause: { code: 'ECONNRESET' } }],
    ['update', new Error('SQL')],
    ['insert', { code: '23505', detail: 'private constraint data' }],
    ['insert', new Error('SQL')],
  ] as const)('wraps %s failures in DatabaseError', async (stage, error) => {
    if (stage === 'update') returning.mockRejectedValueOnce(error);
    else values.mockRejectedValueOnce(error);
    await expect(
      repository.register(phrase, validationId),
    ).rejects.toMatchObject({ name: DatabaseError.name, cause: error });
    expect(calls).not.toContain('commit');
  });

  it('wraps transaction failures (begin/commit) in DatabaseError', async () => {
    const error = new Error('connection lost');
    transaction.mockRejectedValueOnce(error);
    await expect(
      repository.register(phrase, validationId),
    ).rejects.toMatchObject({ name: DatabaseError.name, cause: error });
  });

  it('propagates mapping failures before opening the transaction', async () => {
    const error = new Error('mapping failure');
    const mapper = jest
      .spyOn(DrizzlePhraseMapper, 'toPersistence')
      .mockImplementationOnce(() => {
        throw error;
      });
    await expect(repository.register(phrase, validationId)).rejects.toBe(error);
    expect(transaction).not.toHaveBeenCalled();
    mapper.mockRestore();
  });
});
