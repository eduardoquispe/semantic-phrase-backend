import { ArgumentsHost, ExceptionFilter, Type } from '@nestjs/common';
import { PhraseValidationBadRequestFilter } from './phrase-validation-bad-request.filter';
import { PhraseValidationConflictFilter } from './phrase-validation-conflict.filter';
import { PhraseValidationNotFoundFilter } from './phrase-validation-not-found.filter';
import { PhraseConfirmationRequiredError } from '../../../domain/errors/confirmation-required.error';
import { IncompatibleValidationModelError } from '../../../domain/errors/incompatible-validation-model.error';
import { PhraseMismatchError } from '../../../domain/errors/phrase-mismatch.error';
import { PhraseValidationAlreadyUsedError } from '../../../domain/errors/validation-already-used.error';
import { PhraseValidationExpiredError } from '../../../domain/errors/validation-expired.error';
import { PhraseValidationNotFoundError } from '../../../application/errors/phrase-validation-not-found.error';

describe('phrase registration filters', () => {
  it.each([
    [
      PhraseValidationBadRequestFilter,
      new PhraseMismatchError(),
      400,
      'PHRASE_MISMATCH',
    ],
    [
      PhraseValidationConflictFilter,
      new IncompatibleValidationModelError(),
      409,
      'INCOMPATIBLE_MODEL',
    ],
    [
      PhraseValidationConflictFilter,
      new PhraseValidationExpiredError(),
      409,
      'VALIDATION_EXPIRED',
    ],
    [
      PhraseValidationConflictFilter,
      new PhraseValidationAlreadyUsedError(),
      409,
      'VALIDATION_ALREADY_USED',
    ],
    [
      PhraseValidationConflictFilter,
      new PhraseConfirmationRequiredError(),
      409,
      'CONFIRMATION_REQUIRED',
    ],
    [
      PhraseValidationNotFoundFilter,
      new PhraseValidationNotFoundError(),
      400,
      'INVALID_VALIDATION_ID',
    ],
  ] as [Type<ExceptionFilter<Error>>, Error, number, string][])(
    '%p returns %p as %i %s problem+json',
    (Filter, error, status, code) => {
      const response = {
        status: jest.fn().mockReturnThis(),
        type: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      new Filter().catch(error, {
        switchToHttp: () => ({ getResponse: () => response }),
      } as unknown as ArgumentsHost);
      expect(response.status).toHaveBeenCalledWith(status);
      expect(response.type).toHaveBeenCalledWith('application/problem+json');
      expect(response.json).toHaveBeenCalledWith(
        expect.objectContaining({ status, code, detail: error.message }),
      );
    },
  );
});
