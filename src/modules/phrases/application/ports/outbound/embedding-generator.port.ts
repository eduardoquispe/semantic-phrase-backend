import type { Embedding } from '../../../domain/value-objects/embedding.value-object';
import type { PhraseModel } from '../../../domain/value-objects/phrase-model.value-object';
export interface GeneratedEmbedding {
  embedding: Embedding;
  model: PhraseModel;
}
export abstract class EmbeddingGeneratorPort {
  abstract generate(text: string): Promise<GeneratedEmbedding>;
}
