import { EMBEDDING_DIMENSIONS } from '../constants/embedding.constants';
import { InvalidEmbeddingError } from '../errors/invalid-embedding.error';

export class Embedding {
  readonly values: readonly number[];

  constructor(values: number[]) {
    if (!Array.isArray(values) || values.length !== EMBEDDING_DIMENSIONS) {
      throw new InvalidEmbeddingError(
        `Embedding must contain exactly ${EMBEDDING_DIMENSIONS} components.`,
      );
    }
    const copy = Array.from<number>(values);
    if (!copy.every((value) => Number.isFinite(value))) {
      throw new InvalidEmbeddingError(
        'Embedding components must be finite numbers.',
      );
    }
    this.values = Object.freeze(copy);
    Object.freeze(this);
  }
}
