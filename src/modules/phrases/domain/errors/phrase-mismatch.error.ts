import { PhraseValidationRejectedError } from './phrase-validation-rejected.error';

export class PhraseMismatchError extends PhraseValidationRejectedError {
  readonly code = 'PHRASE_MISMATCH';

  constructor() {
    super('El texto no corresponde a la validación.');
  }
}
