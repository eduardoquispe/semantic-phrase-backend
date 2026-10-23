import { PhraseValidationRejectedError } from './phrase-validation-rejected.error';

export class IncompatibleValidationModelError extends PhraseValidationRejectedError {
  readonly code = 'INCOMPATIBLE_MODEL';

  constructor() {
    super('La validación no es compatible con el modelo actual.');
  }
}
