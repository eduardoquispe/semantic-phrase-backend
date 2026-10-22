import { InvalidPhraseError } from '../errors/invalid-phrase.error';
import { PhraseId } from './phrase-id.value-object';

describe('PhraseId', () => {
  it.each([
    '550e8400-e29b-41d4-a716-446655440000',
    '550E8400-E29B-41D4-A716-446655440000',
  ])('preserves a valid UUID v4: %s', (value) => {
    expect(new PhraseId(value).value).toBe(value);
  });

  it.each([
    '',
    'invalid',
    '550e8400-e29b-11d4-a716-446655440000',
    '550e8400-e29b-41d4-7716-446655440000',
    ' 550e8400-e29b-41d4-a716-446655440000 ',
    null,
    undefined,
    42,
  ])('rejects invalid UUID v4 identity: %p', (value) => {
    expect(() => new PhraseId(value as string)).toThrow(InvalidPhraseError);
  });

  it('protects its value against mutation', () => {
    const value = '550e8400-e29b-41d4-a716-446655440000';
    const id = new PhraseId(value);
    expect(() => Object.assign(id, { value: 'changed' })).toThrow(TypeError);
    expect(id.value).toBe(value);
  });
});
