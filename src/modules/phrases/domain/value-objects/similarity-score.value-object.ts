import { InvalidPhraseValidationError } from '../errors/invalid-phrase-validation.error';
export class SimilarityScore {
  constructor(readonly value: number) {
    if (!Number.isFinite(value) || value < -1 || value > 1) {
      throw new InvalidPhraseValidationError(
        'Similarity must be finite and between -1 and 1.',
      );
    }
    Object.freeze(this);
  }
}
