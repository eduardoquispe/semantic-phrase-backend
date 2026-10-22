import type { PhraseValidationMatch } from '../../../domain/value-objects/phrase-validation-match.value-object';

export interface ValidatePhraseInput {
  text: string;
}
export interface ValidatePhraseResult {
  validationId: string;
  expiresAt: Date;
  requiresConfirmation: boolean;
  match: PhraseValidationMatch | null;
}
export abstract class ValidatePhrasePort {
  abstract execute(input: ValidatePhraseInput): Promise<ValidatePhraseResult>;
}

export const VALIDATION_SETTINGS = Symbol('VALIDATION_SETTINGS');
export interface ValidationSettings {
  threshold: number;
  ttlMinutes: number;
}
