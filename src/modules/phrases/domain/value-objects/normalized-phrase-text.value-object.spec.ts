import { InvalidPhraseError } from '../errors/invalid-phrase.error';
import { NormalizedPhraseText } from './normalized-phrase-text.value-object';

describe('NormalizedPhraseText', () => {
  it('stores the value as-is and is immutable', () => {
    const text = new NormalizedPhraseText('hola mundo');
    expect(text.value).toBe('hola mundo');
    expect(Object.isFrozen(text)).toBe(true);
  });

  it.each(['', '  ', null, undefined, 42])('rejects %p', (value) => {
    expect(() => new NormalizedPhraseText(value as string)).toThrow(
      InvalidPhraseError,
    );
  });
});
