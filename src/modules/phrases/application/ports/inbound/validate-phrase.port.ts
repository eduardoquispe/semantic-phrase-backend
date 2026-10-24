import type { ValidationMatch } from '../../../domain/types/validation-match.type';

export interface ValidatePhraseInput {
  text: string;
}
export interface ValidatePhraseResult {
  validationId: string;
  expiresAt: Date;
  requiresConfirmation: boolean;
  match: ValidationMatch | null;
}
export abstract class ValidatePhrasePort {
  abstract execute(input: ValidatePhraseInput): Promise<ValidatePhraseResult>;
}
