import type { PhraseId } from '../value-objects/phrase-id.value-object';
import type { PhraseText } from '../value-objects/phrase-text.value-object';
import type { Embedding } from '../value-objects/embedding.value-object';
import type { PhraseModel } from '../value-objects/phrase-model.value-object';
import type { ValidationMatch } from './validation-match.type';

export interface CreatePhraseValidationProps {
  id: PhraseId;
  text: PhraseText;
  embedding: Embedding;
  model: PhraseModel;
  match: ValidationMatch | null;
  threshold: number;
  ttlMinutes: number;
  now: Date;
}
