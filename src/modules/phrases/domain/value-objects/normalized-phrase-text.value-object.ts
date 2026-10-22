import { InvalidPhraseError } from '../errors/invalid-phrase.error';

export class NormalizedPhraseText {
  readonly value: string;

  constructor(value: string) {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new InvalidPhraseError(
        'Normalized text must be a non-empty string.',
      );
    }

    this.value = value;
    Object.freeze(this);
  }
}
