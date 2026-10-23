import { Catch, HttpStatus } from '@nestjs/common';
import { DomainExceptionFilter } from '../../../../../shared/infrastructure/http/filters/domain-exception.filter';
import { PhraseValidationNotFoundError } from '../../../application/errors/phrase-validation-not-found.error';

@Catch(PhraseValidationNotFoundError)
export class PhraseValidationNotFoundFilter extends DomainExceptionFilter {
  protected readonly status = HttpStatus.BAD_REQUEST;
  protected readonly code = 'INVALID_VALIDATION_ID';
}
