import { ArgumentsHost } from '@nestjs/common';
import { InvalidValidationTextFilter } from './invalid-validation-text.filter';
import { InvalidPhraseTextError } from '../../../domain/errors/invalid-phrase-text.error';
describe('InvalidValidationTextFilter', () => {
  it('returns safe 400 with messages[] for direct domain validation', () => {
    const response = {
      status: jest.fn().mockReturnThis(),
      type: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    new InvalidValidationTextFilter().catch(
      new InvalidPhraseTextError('private input'),
      {
        switchToHttp: () => ({ getResponse: () => response }),
      } as unknown as ArgumentsHost,
    );
    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.type).toHaveBeenCalledWith('application/problem+json');
    expect(response.json).toHaveBeenCalledWith({
      title: 'Bad Request',
      status: 400,
      detail: 'Los datos enviados no son válidos.',
      code: 'VALIDATION_ERROR',
      errors: [
        {
          field: 'text',
          messages: [
            'El texto debe contener de 1 a 280 puntos de código Unicode, sin controles ni texto vacío.',
          ],
        },
      ],
    });
  });
});
