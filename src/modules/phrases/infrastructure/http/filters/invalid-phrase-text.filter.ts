import { Catch, HttpStatus } from '@nestjs/common';
import { DomainExceptionFilter } from '../../../../../shared/infrastructure/http/filters/domain-exception.filter';
import { InvalidPhraseTextError } from '../../../domain/errors/invalid-phrase-text.error';

@Catch(InvalidPhraseTextError)
export class InvalidPhraseTextFilter extends DomainExceptionFilter {
  protected readonly status = HttpStatus.INTERNAL_SERVER_ERROR;
  protected readonly code = 'INVALID_PHRASE_TEXT';
}
