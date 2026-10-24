import { DomainError } from '../../../../shared/domain/errors/domain.error';
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
    const value = 'á'.repeat(280);
    expect(new PhraseText(value).value).toBe(value);
    expect(() => new PhraseText('á'.repeat(281))).toThrow(
      InvalidPhraseTextError,
    );
    expect(new PhraseText(' abc ').value).toBe(' abc ');
    expect(() => new PhraseText(` ${'a'.repeat(280)} `)).toThrow(
      InvalidPhraseTextError,
    );
  });

  it.each(['abc', '¿Cuándo es mi cita?', '¡ÁRBOL! 123', 'a-b, c.', 'ñ ñ ñ'])(
    'accepts punctuation and at least 3 letters: %p',
    (value) => {
      expect(new PhraseText(value).value).toBe(value);
    },
  );

  it.each(['!!!', '123', 'ab', 'a b 1', '... a ...'])(
    'rejects fewer than 3 letters: %p',
    (value) => {
      expect(() => new PhraseText(value)).toThrow(InvalidPhraseTextError);
    },
  );

  it.each(['Hola 😀', '😀😀😀 hola', 'hola ❤️', 'hola 👨‍👩‍👧', 'hola 🇵🇪'])(
    'rejects emojis: %p',
    (value) => {
      expect(() => new PhraseText(value)).toThrow(InvalidPhraseTextError);
    },
  );

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
