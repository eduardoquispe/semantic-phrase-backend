import type { PhraseId } from '../value-objects/phrase-id.value-object';
import type { PhraseText } from '../value-objects/phrase-text.value-object';
import type { Embedding } from '../value-objects/embedding.value-object';
import type { PhraseModel } from '../value-objects/phrase-model.value-object';
import type { PhraseValidationMatch } from '../value-objects/phrase-validation-match.value-object';

export interface PhraseValidationProps {
  id: PhraseId;
  text: PhraseText;
  embedding: Embedding;
  model: PhraseModel;
  match: PhraseValidationMatch | null;
  threshold: number;
  createdAt: Date;
  expiresAt: Date;
}
