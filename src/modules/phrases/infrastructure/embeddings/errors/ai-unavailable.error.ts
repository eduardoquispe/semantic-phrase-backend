export class AiUnavailableError extends Error {
  constructor() {
    super('El servicio de IA no está disponible.');
    this.name = 'AiUnavailableError';
  }
}
