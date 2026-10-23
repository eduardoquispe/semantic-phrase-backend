import { InvalidPhraseTextError } from '../errors/invalid-phrase-text.error';

export class PhraseText {
  readonly value: string;

  static forValidation(value: string): PhraseText {
    const text = new PhraseText(value);
    if (value.length > 280) {
      throw new InvalidPhraseTextError('Máximo 280 puntos de código Unicode.');
    }
    return text;
  }

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
