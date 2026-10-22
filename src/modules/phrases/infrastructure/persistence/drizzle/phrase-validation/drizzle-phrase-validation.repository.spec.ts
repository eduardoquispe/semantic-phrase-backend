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
    threshold: 0.85,
    createdAt: new Date('2026-10-22T12:00:00Z'),
    expiresAt: new Date('2026-10-22T12:15:00Z'),
  };
}

import { DatabaseUnavailableError } from '../../../../../../shared/infrastructure/database/errors/database-unavailable.error';
describe('temporary validation repository', () => {
  const values = jest.fn();
  const insert = jest.fn(() => ({ values }));
  const repository = new DrizzlePhraseValidationRepository({
    client: { insert },
  } as unknown as DatabaseProvider);
  beforeEach(() => {
    jest.clearAllMocks();
    values.mockResolvedValue(undefined);
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
  });
  it.each([
    [{ cause: { code: 'ECONNREFUSED' } }, DatabaseUnavailableError],
    [new Error('SQL'), Error],
  ])('propagates appropriate error', async (error, kind) => {
    values.mockRejectedValue(error);
    await expect(
      repository.save(new PhraseValidation(validationProps())),
    ).rejects.toBeInstanceOf(kind);
  });
});
