export type PhraseRegistrationReason =
  | 'INVALID_VALIDATION_ID'
  | 'PHRASE_MISMATCH'
  | 'VALIDATION_EXPIRED'
  | 'VALIDATION_ALREADY_USED'
  | 'CONFIRMATION_REQUIRED';
export class PhraseRegistrationError extends Error {
  constructor(readonly reason: PhraseRegistrationReason) {
    super(reason);
  }
}
