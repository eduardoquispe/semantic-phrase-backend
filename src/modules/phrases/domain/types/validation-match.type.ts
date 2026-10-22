import { ValidationMatchEnum } from '../enums/validation-match.enum';
import type { SimilarityScore } from '../value-objects/similarity-score.value-object';

export type ValidationMatch = {
  phrase: Readonly<{ id: string; text: string }>;
} & (
  | { type: ValidationMatchEnum.TextualExact; similarityScore: null }
  | { type: ValidationMatchEnum.Vector; similarityScore: SimilarityScore }
);
