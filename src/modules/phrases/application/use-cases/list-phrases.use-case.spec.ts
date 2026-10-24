import { Phrase } from '../../domain/entities/phrase.entity';
import { Embedding } from '../../domain/value-objects/embedding.value-object';
import { PhraseId } from '../../domain/value-objects/phrase-id.value-object';
import { PhraseText } from '../../domain/value-objects/phrase-text.value-object';
import { PhraseRepositoryPort } from '../ports/outbound/phrase-repository.port';
import { ListPhrasesUseCase } from './list-phrases.use-case';

describe('ListPhrasesUseCase', () => {
  const list = jest.fn<
    ReturnType<PhraseRepositoryPort['list']>,
    Parameters<PhraseRepositoryPort['list']>
  >();
  const useCase = new ListPhrasesUseCase({
    list,
    findValidationMatch: jest.fn(),
    softDelete: jest.fn(),
  });

  beforeEach(() => list.mockReset());

  it.each([
    [1, 20, 0, 0],
    [1, 20, 45, 3],
    [2, 10, 45, 5],
    [4, 20, 45, 3],
    [1, 1, 45, 45],
    [1, 100, 45, 1],
  ])(
    'calculates metadata for page %i, limit %i and total %i',
    async (page, limit, total, totalPages) => {
      list.mockResolvedValue({ data: [], total });

      await expect(useCase.execute({ page, limit })).resolves.toEqual({
        data: [],
        meta: { page, limit, total, totalPages },
      });
      expect(list).toHaveBeenCalledWith(page, limit);
    },
  );

  it('preserves the domain objects and order returned by the repository', async () => {
    const phrase = new Phrase({
      id: new PhraseId('550e8400-e29b-41d4-a716-446655440000'),
      text: new PhraseText('Una frase'),
      normalizedText: 'una frase',
      embedding: new Embedding(Array<number>(384).fill(0.25)),
      modelId: 'MiniLM',
      modelVersion: 'revision-1',
      createdAt: new Date('2026-10-21T12:00:00Z'),
    });
    const olderPhrase = new Phrase({
      id: new PhraseId('550e8400-e29b-41d4-a716-446655440001'),
      text: phrase.text,
      normalizedText: phrase.normalizedText,
      embedding: phrase.embedding,
      modelId: phrase.modelId,
      modelVersion: phrase.modelVersion,
      createdAt: new Date('2026-10-20T12:00:00Z'),
    });
    const data = [phrase, olderPhrase];
    list.mockResolvedValue({ data, total: 2 });

    const result = await useCase.execute({ page: 1, limit: 20 });

    expect(result.data).toBe(data);
    expect(result.meta).toEqual({
      page: 1,
      limit: 20,
      total: 2,
      totalPages: 1,
    });
  });

  it('propagates repository failures instead of returning an empty page', async () => {
    const error = new Error('Database unavailable');
    list.mockRejectedValue(error);

    await expect(useCase.execute({ page: 1, limit: 20 })).rejects.toBe(error);
  });
});
