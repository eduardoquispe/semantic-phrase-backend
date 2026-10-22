import { InvalidPhraseError } from '../errors/invalid-phrase.error';

export class PhraseModel {
  readonly id: string;
  readonly version: string;

  constructor(id: string, version: string) {
    if (typeof id !== 'string' || id.trim().length === 0) {
      throw new InvalidPhraseError('Model id must be a non-empty string.');
    }
    if (typeof version !== 'string' || version.trim().length === 0) {
      throw new InvalidPhraseError('Model version must be a non-empty string.');
    }

    this.id = id;
    this.version = version;
    Object.freeze(this);
  }
}
