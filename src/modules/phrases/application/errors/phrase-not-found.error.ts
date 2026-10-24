export class PhraseNotFoundError extends Error {
  constructor() {
    super('La frase no existe.');
    this.name = 'PhraseNotFoundError';
  }
}
