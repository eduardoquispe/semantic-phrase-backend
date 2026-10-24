import { PhraseNotFoundError } from '../errors/phrase-not-found.error';
import { PhraseRepositoryPort } from '../ports/outbound/phrase-repository.port';
import { DeletePhraseUseCase } from './delete-phrase.use-case';

describe('DeletePhraseUseCase', () => {
  const softDelete = jest.fn<
    ReturnType<PhraseRepositoryPort['softDelete']>,
    Parameters<PhraseRepositoryPort['softDelete']>
  >();
  const useCase = new DeletePhraseUseCase({
    list: jest.fn(),
    findValidationMatch: jest.fn(),
    save: jest.fn(),
    softDelete,
  });
  const id = '550e8400-e29b-41d4-a716-446655440000';

  beforeEach(() => softDelete.mockReset());

  it('resolves when the phrase was deleted', async () => {
    softDelete.mockResolvedValue(true);
    await expect(useCase.execute(id)).resolves.toBeUndefined();
    expect(softDelete).toHaveBeenCalledWith(id);
  });

  it('throws PhraseNotFoundError when no active phrase matched', async () => {
    softDelete.mockResolvedValue(false);
    await expect(useCase.execute(id)).rejects.toBeInstanceOf(
      PhraseNotFoundError,
    );
  });

  it('propagates repository failures', async () => {
    const error = new Error('db');
    softDelete.mockRejectedValue(error);
    await expect(useCase.execute(id)).rejects.toBe(error);
  });
});
