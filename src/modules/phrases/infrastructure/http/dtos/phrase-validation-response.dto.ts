export interface PhraseValidationMatch {
  type: 'textual_exact' | 'vector';
  phrase: {
    id: string;
    text: string;
  };
  similarityScore: number | null;
}

export interface PhraseValidationData {
  validationId: string;
  expiresAt: string;
  requiresConfirmation: boolean;
  match: PhraseValidationMatch | null;
}

export class PhraseValidationResponseDto {
  constructor(public readonly data: PhraseValidationData) {}
}
