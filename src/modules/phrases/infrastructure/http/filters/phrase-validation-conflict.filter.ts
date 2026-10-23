import { Catch, HttpStatus } from '@nestjs/common';
import { PhraseConfirmationRequiredError } from '../../../domain/errors/confirmation-required.error';
import { IncompatibleValidationModelError } from '../../../domain/errors/incompatible-validation-model.error';
import { PhraseValidationAlreadyUsedError } from '../../../domain/errors/validation-already-used.error';
import { PhraseValidationExpiredError } from '../../../domain/errors/validation-expired.error';
import { PhraseValidationRejectedFilter } from './phrase-validation-rejected.filter';

@Catch(
  IncompatibleValidationModelError,
  PhraseValidationExpiredError,
  PhraseValidationAlreadyUsedError,
  PhraseConfirmationRequiredError,
)
export class PhraseValidationConflictFilter extends PhraseValidationRejectedFilter {
  protected readonly status = HttpStatus.CONFLICT;
}
