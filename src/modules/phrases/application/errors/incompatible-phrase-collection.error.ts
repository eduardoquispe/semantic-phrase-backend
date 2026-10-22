export class IncompatiblePhraseCollectionError extends Error {
  constructor() {
    super('Phrase collection has no compatible representation');
    this.name = 'IncompatiblePhraseCollectionError';
  }
}
