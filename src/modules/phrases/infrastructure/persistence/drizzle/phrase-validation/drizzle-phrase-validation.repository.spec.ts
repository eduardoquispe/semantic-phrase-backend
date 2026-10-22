import { DrizzlePhraseValidationMapper } from './drizzle-phrase-validation.mapper';
import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { DrizzlePhraseValidationRepository } from './drizzle-phrase-validation.repository';
import { DrizzlePhraseValidationsModel } from './drizzle-phrase-validations.model';
import { DatabaseProvider } from '../../../../../../shared/infrastructure/database/database.provider';
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
    model: new PhraseModel('MiniLM', 'version'),
    match: null,
    normalizedText: 'hola',
    requiresConfirmation: false,
    consumedAt: null,
    createdAt: new Date('2026-10-22T12:00:00Z'),
    expiresAt: new Date('2026-10-22T12:15:00Z'),
  };
}

import { DatabaseError } from '../../../../../../shared/infrastructure/database/errors/database.error';
describe('temporary validation repository', () => {
  const values = jest.fn();
  const limit = jest.fn();
  const select = jest.fn(() => ({
    from: jest.fn(() => ({ where: jest.fn(() => ({ limit })) })),
  }));
  const where = jest.fn<Promise<void>, [SQL]>();
  const set = jest.fn(() => ({ where }));
  const update = jest.fn(() => ({ set }));
  const insert = jest.fn(() => ({ values }));
  const repository = new DrizzlePhraseValidationRepository({
    client: { insert, select, update },
  } as unknown as DatabaseProvider);
  beforeEach(() => {
    jest.clearAllMocks();
    values.mockResolvedValue(undefined);
    where.mockResolvedValue(undefined);
  });
  it('returns null for an absent reference and maps an existing stored row', async () => {
    limit.mockResolvedValueOnce([]);
    await expect(repository.findById(id)).resolves.toBeNull();
    const v = new PhraseValidation(validationProps());
    const raw = {
      id,
      text: v.text.value,
      normalizedText: v.normalizedText,
      embedding: JSON.stringify(v.embedding.values),
      modelId: v.model.id,
      modelVersion: v.model.version,
      createdAt: v.createdAt,
      expiresAt: v.expiresAt,
      consumedAt: v.createdAt,
      requiresConfirmation: true,
    };
    limit.mockResolvedValueOnce([raw]);
    const result = await repository.findById(id);
    expect(result).toBeInstanceOf(PhraseValidation);
    expect(result).toMatchObject({
      id,
      text: v.text,
      requiresConfirmation: true,
      consumedAt: raw.consumedAt,
      model: v.model,
    });
  });
  it.each([{ code: 'ECONNREFUSED' }, new Error('SQL'), { code: '23505' }])(
    'wraps read failures with their cause: %p',
    async (cause) => {
      limit.mockRejectedValueOnce(cause);
      await expect(repository.findById(id)).rejects.toMatchObject({
        name: 'DatabaseError',
        cause,
      });
    },
  );
  it('preserves read and write mapping failures', async () => {
    const error = new Error('mapping failure');
    limit.mockResolvedValueOnce([{}]);
    const read = jest
      .spyOn(DrizzlePhraseValidationMapper, 'toDomain')
      .mockImplementationOnce(() => {
        throw error;
      });
    await expect(repository.findById(id)).rejects.toBe(error);
    read.mockRestore();
    const save = jest
      .spyOn(DrizzlePhraseValidationMapper, 'toPersistence')
      .mockImplementationOnce(() => {
        throw error;
      });
    await expect(
      repository.save(new PhraseValidation(validationProps())),
    ).rejects.toBe(error);
    expect(insert).not.toHaveBeenCalled();
    save.mockRestore();
    const updateMapper = jest
      .spyOn(DrizzlePhraseValidationMapper, 'toPartialPersistence')
      .mockImplementationOnce(() => {
        throw error;
      });
    await expect(repository.update(id, {})).rejects.toBe(error);
    expect(update).not.toHaveBeenCalled();
    updateMapper.mockRestore();
  });
  it('updates only consumedAt for the requested id and awaits completion', async () => {
    const consumedAt = new Date();
    let finish!: () => void;
    where.mockReturnValueOnce(
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    );
    let saved = false;
    const pending = repository.update(id, { consumedAt }).then(() => {
      saved = true;
    });
    await Promise.resolve();
    expect(saved).toBe(false);
    expect(update).toHaveBeenCalledWith(DrizzlePhraseValidationsModel);
    expect(set).toHaveBeenCalledWith({ consumedAt });
    const query = new PgDialect().sqlToQuery(where.mock.calls[0][0]);
    expect(query.sql).toBe('"phrase_validations"."id" = $1');
    expect(query.params).toEqual([id]);
    expect(insert).not.toHaveBeenCalled();
    finish();
    await pending;
    expect(saved).toBe(true);
  });
  it.each([
    [{ cause: { code: 'ECONNREFUSED' } }, DatabaseError],
    [new Error('SQL'), DatabaseError],
    [{ code: '23505', detail: 'private constraint data' }, DatabaseError],
  ])('propagates consumption errors', async (error, kind) => {
    where.mockRejectedValueOnce(error);
    await expect(
      repository.update(id, { consumedAt: new Date() }),
    ).rejects.toMatchObject({ name: kind.name, cause: error });
    expect(insert).not.toHaveBeenCalled();
  });
  it('updates provided fields beyond consumption without inserting', async () => {
    await repository.update(id, {
      text: PhraseText.forValidation('Updated'),
      requiresConfirmation: false,
      consumedAt: null,
    });
    expect(set).toHaveBeenCalledWith({
      text: 'Updated',
      requiresConfirmation: false,
      consumedAt: null,
    });
    expect(insert).not.toHaveBeenCalled();
  });
  it('awaits exactly one INSERT into temporary table', async () => {
    let finish!: () => void;
    values.mockReturnValue(
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
    );
    let saved = false;
    const pending = repository
      .save(new PhraseValidation(validationProps()))
      .then(() => {
        saved = true;
      });
    await Promise.resolve();
    expect(saved).toBe(false);
    expect(insert).toHaveBeenCalledWith(DrizzlePhraseValidationsModel);
    finish();
    await pending;
    expect(saved).toBe(true);
    expect(values).toHaveBeenCalledTimes(1);
    expect(update).not.toHaveBeenCalled();
  });
  it.each([
    [{ cause: { code: 'ECONNREFUSED' } }, DatabaseError],
    [new Error('SQL'), DatabaseError],
    [{ code: '23505', detail: 'private constraint data' }, DatabaseError],
  ])('propagates appropriate error', async (error, kind) => {
    values.mockRejectedValue(error);
    await expect(
      repository.save(new PhraseValidation(validationProps())),
    ).rejects.toMatchObject({ name: kind.name, cause: error });
  });
});
