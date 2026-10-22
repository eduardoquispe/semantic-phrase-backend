import { InvalidPhraseTextError } from '../errors/invalid-phrase-text.error';

export class PhraseText {
  readonly value: string;

  get normalized(): string {
    return this.value.trim().toLowerCase().replace(/\s+/g, ' ');
  }

  constructor(value: string) {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new InvalidPhraseTextError(
        'Phrase text must be a non-empty string.',
      );
    }
    if ([...value].length > 500) {
      throw new InvalidPhraseTextError(
        'Phrase text must not exceed 500 Unicode code points.',
      );
    }
    if (/\p{Cc}/u.test(value)) {
      throw new InvalidPhraseTextError(
        'Phrase text must not contain control characters.',
      );
    }
    this.value = value;
    Object.freeze(this);
  }
}
