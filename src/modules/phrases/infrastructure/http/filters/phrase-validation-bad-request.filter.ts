import { Catch, HttpStatus } from '@nestjs/common';
import { PhraseMismatchError } from '../../../domain/errors/phrase-mismatch.error';
import { PhraseValidationRejectedFilter } from './phrase-validation-rejected.filter';

@Catch(PhraseMismatchError)
export class PhraseValidationBadRequestFilter extends PhraseValidationRejectedFilter {
  protected readonly status = HttpStatus.BAD_REQUEST;
}
