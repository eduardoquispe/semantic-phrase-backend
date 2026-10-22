import { ValidationMatchEnum } from '../enums/validation-match.enum';
import { type ValidationMatch } from '../types/validation-match.type';
import type { SimilarityScore } from './similarity-score.value-object';

export class PhraseValidationMatch {
  readonly type: ValidationMatchEnum;
  readonly phrase: Readonly<{ id: string; text: string }>;
  readonly similarityScore: SimilarityScore | null;

  constructor(match: ValidationMatch) {
    this.type = match.type;
    this.phrase = Object.freeze({ ...match.phrase });
    this.similarityScore = match.similarityScore;
    Object.freeze(this);
  }

  requiresConfirmation(threshold: number): boolean {
    return (
      this.type === ValidationMatchEnum.TextualExact ||
      (this.similarityScore !== null && this.similarityScore.value >= threshold)
    );
  }
}
