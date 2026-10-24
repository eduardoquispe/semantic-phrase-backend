import { Catch, HttpStatus } from '@nestjs/common';
import { DomainExceptionFilter } from '../../../../../shared/infrastructure/http/filters/domain-exception.filter';
import { PhraseNotFoundError } from '../../../application/errors/phrase-not-found.error';

@Catch(PhraseNotFoundError)
export class PhraseNotFoundFilter extends DomainExceptionFilter {
  protected readonly status = HttpStatus.NOT_FOUND;
  protected readonly code = 'PHRASE_NOT_FOUND';
}
