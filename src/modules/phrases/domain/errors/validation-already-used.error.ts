import { PhraseValidationRejectedError } from './phrase-validation-rejected.error';

export class PhraseValidationAlreadyUsedError extends PhraseValidationRejectedError {
  readonly code = 'VALIDATION_ALREADY_USED';

  constructor() {
    super('La validación ya fue utilizada.');
  }
}
