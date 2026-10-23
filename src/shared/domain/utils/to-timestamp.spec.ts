import { InvalidDateError } from '../errors/invalid-date.error';
import { toTimestamp } from './to-timestamp';

describe('toTimestamp', () => {
  it('returns the epoch milliseconds of a valid date', () => {
    expect(toTimestamp(new Date('2026-10-22T12:00:00Z'), 'createdAt')).toBe(
      Date.parse('2026-10-22T12:00:00Z'),
    );
    expect(toTimestamp(new Date(0), 'createdAt')).toBe(0);
  });

  it.each([new Date(NaN), '2026-10-22', null, undefined, 0])(
    'rejects %p naming the field',
    (value) => {
      expect(() => toTimestamp(value as Date, 'createdAt')).toThrow(
        new InvalidDateError('createdAt must be a valid Date.'),
      );
    },
  );
});
