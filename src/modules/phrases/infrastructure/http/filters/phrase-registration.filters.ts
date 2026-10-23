import { InvalidRegistrationRequestFilter } from './invalid-registration-request.filter';
import { PhraseValidationBadRequestFilter } from './phrase-validation-bad-request.filter';
import { PhraseValidationConflictFilter } from './phrase-validation-conflict.filter';
import { PhraseValidationNotFoundFilter } from './phrase-validation-not-found.filter';

export const PHRASE_REGISTRATION_FILTERS = [
  InvalidRegistrationRequestFilter,
  PhraseValidationNotFoundFilter,
  PhraseValidationBadRequestFilter,
  PhraseValidationConflictFilter,
];
