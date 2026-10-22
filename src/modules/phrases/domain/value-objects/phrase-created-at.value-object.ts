import { InvalidPhraseError } from '../errors/invalid-phrase.error';

export class PhraseCreatedAt {
  private readonly timestamp: number;

  constructor(value: Date) {
    if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
      throw new InvalidPhraseError('Creation date must be a valid Date.');
    }

    this.timestamp = value.getTime();
    Object.freeze(this);
  }

  get value(): Date {
    return new Date(this.timestamp);
  }
}
