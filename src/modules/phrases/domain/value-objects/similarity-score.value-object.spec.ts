import { SimilarityScore } from './similarity-score.value-object';
describe('SimilarityScore', () => {
  it.each([-1, -0.5, 0, 0.8538613695045911, 1])('preserves %s', (value) => {
    expect(new SimilarityScore(value).value).toBe(value);
  });
  it.each([-1.00001, 1.00001, NaN, Infinity, -Infinity])(
    'rejects %s',
    (value) => {
      expect(() => new SimilarityScore(value)).toThrow();
    },
  );
});
