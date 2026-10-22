import { Catch, HttpStatus } from '@nestjs/common';
import { DomainExceptionFilter } from '../../../../../shared/infrastructure/http/filters/domain-exception.filter';
import { InvalidPhraseError } from '../../../domain/errors/invalid-phrase.error';

@Catch(InvalidPhraseError)
export class InvalidPhraseFilter extends DomainExceptionFilter {
  protected readonly status = HttpStatus.INTERNAL_SERVER_ERROR;
  protected readonly code = 'INVALID_PHRASE';
}
