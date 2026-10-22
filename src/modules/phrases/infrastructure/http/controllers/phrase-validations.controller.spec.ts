import { PhraseValidationsController } from './phrase-validations.controller';
describe('PhraseValidationsController', () => {
  it('delegates only input to inbound port and maps public response', async () => {
    const execute = jest.fn().mockResolvedValue({
      validationId: '550e8400-e29b-41d4-a716-446655440000',
      expiresAt: new Date('2026-10-22T12:15:00Z'),
      requiresConfirmation: false,
      match: null,
      internal: 'hidden',
    });
    const controller = new PhraseValidationsController({ execute });
    expect(await controller.validate({ text: ' Hola ' })).toEqual({
      data: {
        validationId: '550e8400-e29b-41d4-a716-446655440000',
        expiresAt: '2026-10-22T12:15:00.000Z',
        requiresConfirmation: false,
        match: null,
      },
    });
    expect(execute).toHaveBeenCalledWith({ text: ' Hola ' });
  });
});
