export class PhraseValidationNotFoundError extends Error {
  constructor() {
    super('La referencia de validación no es válida.');
    this.name = 'PhraseValidationNotFoundError';
  }
}
