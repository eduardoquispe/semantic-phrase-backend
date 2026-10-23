import { ArgumentsHost, BadRequestException } from '@nestjs/common';
import { InvalidRegistrationRequestFilter } from './invalid-registration-request.filter';

describe('InvalidRegistrationRequestFilter', () => {
  const response = {
    status: jest.fn().mockReturnThis(),
    type: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };
  const host = {
    switchToHttp: () => ({ getResponse: () => response }),
  } as unknown as ArgumentsHost;

  it.each(['validationId', 'text', 'confirmed', 'extra'])(
    'preserves DTO messages for %s',
    (field) => {
      const errors = [{ field, messages: ['invalid field'] }];
      new InvalidRegistrationRequestFilter().catch(
        new BadRequestException({ errors }),
        host,
      );
      expect(response.status).toHaveBeenLastCalledWith(400);
      expect(response.type).toHaveBeenLastCalledWith(
        'application/problem+json',
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
