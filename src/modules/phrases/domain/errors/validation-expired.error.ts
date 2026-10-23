import { PhraseValidationRejectedError } from './phrase-validation-rejected.error';

export class PhraseValidationExpiredError extends PhraseValidationRejectedError {
  readonly code = 'VALIDATION_EXPIRED';

  constructor() {
    super('La validación expiró. Valida nuevamente la frase.');
  }
}
