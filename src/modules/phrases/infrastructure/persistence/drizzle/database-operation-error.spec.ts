import { rethrowDatabaseOperationError } from './database-operation-error';
import { DatabaseUnavailableError } from '../../../../../shared/infrastructure/database/errors/database-unavailable.error';
describe('database operation errors', () => {
  it.each([
    'ECONNREFUSED',
    'ECONNRESET',
    'ETIMEDOUT',
    'ENOTFOUND',
    'EPIPE',
    '08006',
    '57P01',
    '57P02',
    '57P03',
  ])('classifies %s through causes', (code) => {
    expect(() => rethrowDatabaseOperationError({ cause: { code } })).toThrow(
      DatabaseUnavailableError,
    );
  });
  it.each([
    { code: '23505' },
    { code: '42601' },
    new Error('ECONNREFUSED connection timeout'),
    { code: '42P01' },
  ])('preserves unknown failures', (error) => {
    try {
      rethrowDatabaseOperationError(error);
    } catch (actual) {
      expect(actual).toBe(error);
    }
  });
  it('bounds cyclic causes', () => {
    const error = { cause: null as unknown };
    error.cause = error;
    try {
      rethrowDatabaseOperationError(error);
    } catch (actual) {
      expect(actual).toBe(error);
    }
  });
});
