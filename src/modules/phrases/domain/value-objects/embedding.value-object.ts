import { InvalidEmbeddingError } from '../errors/invalid-embedding.error';

export class Embedding {
  static readonly DIMENSIONS = 384;
  readonly values: readonly number[];

  constructor(values: number[]) {
    if (!Array.isArray(values) || values.length !== Embedding.DIMENSIONS) {
      throw new InvalidEmbeddingError(
        'Embedding must contain exactly 384 components.',
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
