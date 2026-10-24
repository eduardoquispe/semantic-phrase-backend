import { IsValidPhraseText } from './is-valid-phrase-text.validator';
describe('IsValidPhraseText', () => {
  const validator = new IsValidPhraseText();
  it.each([
    'a'.repeat(280),
    ' Hola ',
    'abc',
    '¿Cuándo es mi cita?',
    '¡Árbol 123!',
    'a-b, c.',
  ])('accepts admissible original', (value) =>
    expect(validator.validate(value)).toBe(true),
  );
  it.each([
    null,
    undefined,
    42,
    '',
    ' ',
    'a\nb',
    'a'.repeat(281),
    '!!!',
    '123',
    'ab',
    'a b 1',
    'Hola 😀',
    '👨‍👩‍👧 hola',
  ])('rejects invalid input', (value) =>
    expect(validator.validate(value)).toBe(false),
  );
});
