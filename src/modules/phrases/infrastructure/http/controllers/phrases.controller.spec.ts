import { PhrasesController } from './phrases.controller';

describe('PhrasesController', () => {
  const result = {
    data: [],
    meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
  };
  const port = { execute: jest.fn().mockResolvedValue(result) };
  const controller = new PhrasesController(port);

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
