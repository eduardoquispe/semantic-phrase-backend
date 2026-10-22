import { InvalidPhraseError } from '../errors/invalid-phrase.error';

export class PhraseId {
  readonly value: string;

  constructor(value: string) {
    if (
      typeof value !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value,
      )
    ) {
      throw new InvalidPhraseError('Phrase id must be a UUID v4.');
    }

    this.value = value;
    Object.freeze(this);
  }
}
