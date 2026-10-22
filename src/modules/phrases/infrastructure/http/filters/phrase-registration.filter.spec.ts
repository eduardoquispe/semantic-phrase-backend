import { ArgumentsHost, BadRequestException } from '@nestjs/common';
import { PhraseRegistrationFilter } from './phrase-registration.filter';
import {
  PhraseRegistrationError,
  PhraseRegistrationReason,
} from '../../../application/errors/phrase-registration.error';
describe('registration error translation', () => {
  const response = {
    status: jest.fn().mockReturnThis(),
    type: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };
  const host = {
    switchToHttp: () => ({ getResponse: () => response }),
  } as unknown as ArgumentsHost;
  it.each([
    ['INVALID_VALIDATION_ID', 400],
    ['PHRASE_MISMATCH', 400],
    ['VALIDATION_EXPIRED', 409],
    ['VALIDATION_ALREADY_USED', 409],
    ['CONFIRMATION_REQUIRED', 409],
  ] as [PhraseRegistrationReason, number][])('maps %s', (reason, status) => {
    new PhraseRegistrationFilter().catch(
      new PhraseRegistrationError(reason),
      host,
    );
    expect(response.status).toHaveBeenLastCalledWith(status);
    expect(response.json).toHaveBeenLastCalledWith(
      expect.objectContaining({ status, code: reason }),
    );
    expect(response.type).toHaveBeenLastCalledWith('application/problem+json');
  });
  it.each(['validationId', 'text', 'confirmed', 'extra'])(
    'preserves DTO messages for %s',
    (field) => {
      const errors = [{ field, messages: ['invalid field'] }];
      new PhraseRegistrationFilter().catch(
        new BadRequestException({ errors }),
        host,
      );
      expect(response.json).toHaveBeenLastCalledWith(
        expect.objectContaining({
          errors,
          code:
            field === 'validationId'
              ? 'INVALID_VALIDATION_ID'
              : 'VALIDATION_ERROR',
        }),
      );
    },
  );
});
