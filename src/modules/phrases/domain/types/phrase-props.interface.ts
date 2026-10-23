import { Embedding } from '../value-objects/embedding.value-object';
import { PhraseId } from '../value-objects/phrase-id.value-object';
import { PhraseText } from '../value-objects/phrase-text.value-object';

export interface PhraseProps {
  id: PhraseId;
  text: PhraseText;
  normalizedText: string;
  embedding: Embedding;
  modelId: string;
  modelVersion: string;
  createdAt: Date;
}
