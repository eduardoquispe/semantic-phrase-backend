import { Catch, HttpStatus } from '@nestjs/common';
import { DomainExceptionFilter } from '../../../../../shared/infrastructure/http/filters/domain-exception.filter';
import { InvalidEmbeddingError } from '../../../domain/errors/invalid-embedding.error';

@Catch(InvalidEmbeddingError)
export class InvalidEmbeddingFilter extends DomainExceptionFilter {
  protected readonly status = HttpStatus.INTERNAL_SERVER_ERROR;
  protected readonly code = 'INVALID_EMBEDDING';
}
