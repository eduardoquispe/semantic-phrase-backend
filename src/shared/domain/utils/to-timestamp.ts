import { InvalidDateError } from '../errors/invalid-date.error';

export function toTimestamp(value: Date, field: string): number {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw new InvalidDateError(`${field} must be a valid Date.`);
  }
  return value.getTime();
}
