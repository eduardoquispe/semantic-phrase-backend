import { IsValidPhraseText } from './is-valid-phrase-text.validator';
describe('IsValidPhraseText', () => {
  const validator = new IsValidPhraseText();
  it.each(['😀'.repeat(280), '!!!', ' Hola '])(
    'accepts admissible original',
    (value) => expect(validator.validate(value)).toBe(true),
  );
  it.each([null, undefined, 42, '', ' ', 'a\nb', '😀'.repeat(281)])(
    'rejects invalid input',
    (value) => expect(validator.validate(value)).toBe(false),
  );
});
