import { DomainError } from './domain.error';

export class InvalidEmbeddingError extends DomainError {
  constructor(message: string) {
    super(message);
  }
}
