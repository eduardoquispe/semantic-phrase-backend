import { DomainError } from '../../../../shared/domain/errors/domain.error';

export class InvalidEmbeddingError extends DomainError {
  constructor(message: string) {
    super(message);
  }
}
