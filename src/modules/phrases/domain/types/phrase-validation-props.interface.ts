import type { PhraseId } from '../value-objects/phrase-id.value-object';
import type { PhraseText } from '../value-objects/phrase-text.value-object';
import type { NormalizedPhraseText } from '../value-objects/normalized-phrase-text.value-object';
import type { Embedding } from '../value-objects/embedding.value-object';
import type { PhraseModel } from '../value-objects/phrase-model.value-object';
import type { SimilarityScore } from '../value-objects/similarity-score.value-object';

export interface PhraseValidationProps {
  id: PhraseId;
  text: PhraseText;
  normalizedText: NormalizedPhraseText;
  embedding: Embedding;
  model: PhraseModel;
  matchedPhraseId: PhraseId | null;
  similarityScore: SimilarityScore | null;
  requiresConfirmation: boolean;
  consumedAt: Date | null;
  createdAt: Date;
  expiresAt: Date;
}
