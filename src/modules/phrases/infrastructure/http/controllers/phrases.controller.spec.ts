import { PhrasesController } from './phrases.controller';

import { Phrase } from '../../../domain/entities/phrase.entity';
import { PhraseId } from '../../../domain/value-objects/phrase-id.value-object';
import { PhraseText } from '../../../domain/value-objects/phrase-text.value-object';
import { Embedding } from '../../../domain/value-objects/embedding.value-object';
import { PhrasesMapper } from '../mapper/phrases.mapper';

describe('PhrasesController', () => {
  const result = {
    data: [],
    meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
  };
  const port = { execute: jest.fn().mockResolvedValue(result) };
  const create = { execute: jest.fn() };
  const remove = { execute: jest.fn() };
  const controller = new PhrasesController(port, create, remove);

  it('delegates registration and maps only public phrase fields', async () => {
    const phrase = new Phrase({
      id: new PhraseId('550e8400-e29b-41d4-a716-446655440000'),
      text: new PhraseText(' Hola '),
      normalizedText: 'hola',
      embedding: new Embedding(Array<number>(384).fill(0.25)),
      modelId: 'MiniLM',
      modelVersion: 'v1',
      createdAt: new Date('2026-10-22T12:00:00Z'),
    });
    create.execute.mockResolvedValueOnce(phrase);
    const input = {
      text: ' Hola ',
      validationId: 'validation',
      confirmed: true,
    };
    const response = {
      data: {
        id: phrase.id,
        text: ' Hola ',
        createdAt: '2026-10-22T12:00:00.000Z',
      },
    };
    await expect(controller.post(input)).resolves.toEqual(response);
    expect(create.execute).toHaveBeenCalledWith(input);
    expect(PhrasesMapper.toCreatePhraseResponse(phrase)).toEqual(response);
  });

  it('delegates deletion and returns no body', async () => {
    const id = '550e8400-e29b-41d4-a716-446655440000';
    await expect(controller.delete({ id })).resolves.toBeUndefined();
    expect(remove.execute).toHaveBeenCalledWith(id);
  });

  it('delegates defaults', async () => {
    await expect(
      controller.get({
        page: 1,
        limit: 20,
      }),
    ).resolves.toEqual(result);
    expect(port.execute).toHaveBeenCalledWith({ page: 1, limit: 20 });
  });

  it('delegates requested pagination', async () => {
    await controller.get({ page: 2, limit: 10 });
    expect(port.execute).toHaveBeenCalledWith({ page: 2, limit: 10 });
  });
});
