import { DatabaseUnavailableError } from '../../../../../shared/infrastructure/database/errors/database-unavailable.error';
const connectionCodes = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ECONNABORTED',
  'ETIMEDOUT',
  'ENOTFOUND',
  'EAI_AGAIN',
  'EPIPE',
  'ENETUNREACH',
  'EHOSTUNREACH',
  '57P01',
  '57P02',
  '57P03',
]);
export function rethrowDatabaseOperationError(error: unknown): never {
  let current = error;
  const seen = new Set<unknown>();
  for (
    let depth = 0;
    depth < 8 && current && typeof current === 'object' && !seen.has(current);
    depth++
  ) {
    seen.add(current);
    const { code, cause } = current as { code?: unknown; cause?: unknown };
    if (
      typeof code === 'string' &&
      (connectionCodes.has(code) || /^08[0-9A-Z]{3}$/.test(code))
    )
      throw new DatabaseUnavailableError();
    current = cause;
  }
  throw error;
}
