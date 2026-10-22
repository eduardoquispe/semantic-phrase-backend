export class DatabaseUnavailableError extends Error {
  constructor(cause?: unknown) {
    super('Database unavailable', { cause });
    this.name = 'DatabaseUnavailableError';
  }
}
