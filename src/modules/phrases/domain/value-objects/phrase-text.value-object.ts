import {
  MAX_PHRASE_TEXT_LENGTH,
  MIN_PHRASE_TEXT_LETTERS,
} from '../constants/phrase-text.constants';
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
    const codePoints = [...value];
    if (codePoints.length > MAX_PHRASE_TEXT_LENGTH) {
      throw new InvalidPhraseTextError(
        `Phrase text must not exceed ${MAX_PHRASE_TEXT_LENGTH} Unicode code points.`,
      );
    }
    if (/\p{Cc}/u.test(value)) {
      throw new InvalidPhraseTextError(
        'Phrase text must not contain control characters.',
      );
    }
    if (
      /\p{Extended_Pictographic}|\p{Regional_Indicator}|\u200D|\uFE0F/u.test(
        value,
      )
    ) {
      throw new InvalidPhraseTextError('Phrase text must not contain emojis.');
    }
    if (
      codePoints.filter((char) => /\p{L}/u.test(char)).length <
      MIN_PHRASE_TEXT_LETTERS
    ) {
      throw new InvalidPhraseTextError(
        `Phrase text must contain at least ${MIN_PHRASE_TEXT_LETTERS} letters.`,
      );
    }
    this.value = value;
    Object.freeze(this);
  }
}
