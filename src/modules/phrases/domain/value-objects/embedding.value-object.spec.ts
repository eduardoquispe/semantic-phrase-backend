import { DomainError } from '../../../../shared/domain/errors/domain.error';
import { InvalidEmbeddingError } from '../errors/invalid-embedding.error';
import { Embedding } from './embedding.value-object';

describe('Embedding', () => {
  const vector = () => Array<number>(384).fill(0.25);

  it.each([0, 383, 385])('rejects a vector of length %i', (length) => {
    expect(() => new Embedding(Array<number>(length).fill(1))).toThrow(
      InvalidEmbeddingError,
    );
  });

  it.each([NaN, Infinity, -Infinity, '0.25', null, undefined])(
    'rejects a non-finite or non-numeric component: %p',
    (component) => {
      const values = vector();
      values[0] = component as number;
      expect(() => new Embedding(values)).toThrow(InvalidEmbeddingError);
    },
  );

  it('rejects sparse arrays and non-array values', () => {
    expect(() => new Embedding(new Array<number>(384))).toThrow(
      InvalidEmbeddingError,
    );
    expect(() => new Embedding(null as unknown as number[])).toThrow(
      InvalidEmbeddingError,
    );
  });

  it('preserves components without normalizing or enforcing an L2 norm', () => {
    const values = vector();
    values[0] = -2;
    expect(new Embedding(values).values).toEqual(values);
  });

  it('protects the vector from input and output mutation', () => {
    const values = vector();
    const embedding = new Embedding(values);
    values[0] = 8;
    expect(embedding.values[0]).toBe(0.25);
    expect(() => Object.assign(embedding.values, { 0: 9 })).toThrow(TypeError);
    expect(() => Object.assign(embedding, { values: [] })).toThrow(TypeError);
    expect(embedding.values[0]).toBe(0.25);
  });

  it('reports a domain error without exposing the vector', () => {
    const values = vector();
    values[0] = NaN;
    try {
      new Embedding(values);
      throw new Error('Expected invalid embedding to be rejected');
    } catch (error) {
      expect(error).toBeInstanceOf(DomainError);
      expect(error).toMatchObject({ name: 'InvalidEmbeddingError' });
      expect((error as Error).message).not.toContain('0.25');
    }
  });
});
