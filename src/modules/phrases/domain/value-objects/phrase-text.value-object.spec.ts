import { DomainError } from '../errors/domain.error';
import { InvalidPhraseTextError } from '../errors/invalid-phrase-text.error';
import { PhraseText } from './phrase-text.value-object';

describe('PhraseText', () => {
  it.each(['', '   ', '\u00a0', null, undefined, 42])(
    'rejects empty or non-string text: %p',
    (value) => {
      expect(() => new PhraseText(value as string)).toThrow(
        InvalidPhraseTextError,
      );
    },
  );

  it('counts Unicode code points and preserves the original text', () => {
    const value = '😀'.repeat(500);
    expect(new PhraseText(value).value).toBe(value);
    expect(() => new PhraseText('😀'.repeat(501))).toThrow(
      InvalidPhraseTextError,
    );
    expect(new PhraseText('a').value).toBe('a');
    expect(() => new PhraseText('a'.repeat(501))).toThrow(
      InvalidPhraseTextError,
    );
    expect(() => new PhraseText(` ${'a'.repeat(499)} `)).toThrow(
      InvalidPhraseTextError,
    );
  });

  const controls = [
    ...Array.from({ length: 32 }, (_, index) => index),
    ...Array.from({ length: 33 }, (_, index) => index + 127),
  ];
  it.each(controls)('rejects control code point %i', (codePoint) => {
    expect(
      () => new PhraseText(`Frase${String.fromCodePoint(codePoint)}original`),
    ).toThrow(InvalidPhraseTextError);
  });

  it('normalizes Unicode whitespace and case, preserving accents and punctuation', () => {
    const value = '  ¡ÁRBOL!\u00a0\u2003EN   Cusco.  ';
    const text = new PhraseText(value);
    expect(text.value).toBe(value);
    expect(text.normalized).toBe('¡árbol! en cusco.');
    expect(new PhraseText(text.normalized).normalized).toBe(text.normalized);
  });

  it('protects its value against mutation', () => {
    const text = new PhraseText('Original');
    expect(() => Object.assign(text, { value: 'Modified' })).toThrow(TypeError);
    expect(text.value).toBe('Original');
  });

  it('reports a domain error without exposing rejected text', () => {
    const secret = 'private\ntext';
    try {
      new PhraseText(secret);
      throw new Error('Expected invalid text to be rejected');
    } catch (error) {
      expect(error).toBeInstanceOf(DomainError);
      expect(error).toMatchObject({ name: 'InvalidPhraseTextError' });
      expect((error as Error).message).not.toContain(secret);
    }
  });
});
