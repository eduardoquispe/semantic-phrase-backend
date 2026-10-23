import { DomainError } from '../../../../shared/domain/errors/domain.error';

export abstract class PhraseValidationRejectedError extends DomainError {
  abstract readonly code: string;
}
