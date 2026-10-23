import { PhraseValidationRejectedError } from './phrase-validation-rejected.error';

export class PhraseConfirmationRequiredError extends PhraseValidationRejectedError {
  readonly code = 'CONFIRMATION_REQUIRED';

  constructor() {
    super('Se requiere confirmación explícita.');
  }
}
