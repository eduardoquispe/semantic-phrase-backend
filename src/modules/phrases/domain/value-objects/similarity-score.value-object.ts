import {
  MAX_SIMILARITY_SCORE,
  MIN_SIMILARITY_SCORE,
} from '../constants/similarity-score.constants';
import { InvalidPhraseValidationError } from '../errors/invalid-phrase-validation.error';
export class SimilarityScore {
  constructor(readonly value: number) {
    if (
      !Number.isFinite(value) ||
      value < MIN_SIMILARITY_SCORE ||
      value > MAX_SIMILARITY_SCORE
    ) {
      throw new InvalidPhraseValidationError(
        `Similarity must be finite and between ${MIN_SIMILARITY_SCORE} and ${MAX_SIMILARITY_SCORE}.`,
      );
    }
    Object.freeze(this);
  }
}
