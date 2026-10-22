export class DatabaseError extends Error {
  constructor(cause: unknown) {
    super('Database operation failed', { cause });
    this.name = 'DatabaseError';
  }
}
