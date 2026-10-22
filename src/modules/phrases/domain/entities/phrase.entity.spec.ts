import { InvalidPhraseError } from '../errors/invalid-phrase.error';
import { Embedding } from '../value-objects/embedding.value-object';
import { PhraseId } from '../value-objects/phrase-id.value-object';
import { PhraseText } from '../value-objects/phrase-text.value-object';
import { Phrase, PhraseProps } from './phrase.entity';

describe('Phrase', () => {
  const props = (): PhraseProps => ({
    id: new PhraseId('550e8400-e29b-41d4-a716-446655440000'),
    text: new PhraseText('  Una FRASE  '),
    normalizedText: 'una frase',
    embedding: new Embedding(Array<number>(384).fill(0.25)),
    modelId: 'MiniLM',
    modelVersion: 'revision-1',
    createdAt: new Date('2026-10-21T12:00:00.000Z'),
  });

  it('represents a complete registered phrase with explicit normalized text', () => {
    const input = props();
    const phrase = new Phrase(input);
    expect(phrase.id).toBe(input.id.value);
    expect(phrase.text).toBe(input.text);
    expect(phrase.embedding).toBe(input.embedding);
    expect(phrase.modelId).toBe(input.modelId);
    expect(phrase.modelVersion).toBe(input.modelVersion);
    expect(phrase.createdAt).toEqual(input.createdAt);
    expect(phrase.normalizedText).toBe('una frase');
    expect(phrase.text.value).toBe('  Una FRASE  ');
  });

  it('accepts an identity value object and exposes its string value', () => {
    const id = new PhraseId('550e8400-e29b-41d4-a716-446655440000');
    const phrase = new Phrase({ ...props(), id });
    expect(phrase.id).toBe(id.value);
    expect(() => Object.assign(phrase, { id: 'changed' })).toThrow(TypeError);
  });

  it('preserves stored normalized text without recalculating it', () => {
    const phrase = new Phrase({
      ...props(),
      normalizedText: 'valor persistido con reglas anteriores',
    });
    expect(phrase.normalizedText).toBe(
      'valor persistido con reglas anteriores',
    );
    expect(phrase.text.value).toBe('  Una FRASE  ');
    expect(() => Object.assign(phrase, { normalizedText: 'changed' })).toThrow(
      TypeError,
    );
  });

  it.each(['normalizedText', 'modelId', 'modelVersion'] as const)(
    'rejects missing or blank %s',
    (field) => {
      for (const value of ['', '  ', null, undefined, 42]) {
        expect(() => new Phrase({ ...props(), [field]: value })).toThrow(
          InvalidPhraseError,
        );
      }
    },
  );

  it.each([new Date(NaN), '2026-10-21', null, undefined])(
    'rejects invalid creation dates: %p',
    (createdAt) => {
      expect(
        () => new Phrase({ ...props(), createdAt: createdAt as Date }),
      ).toThrow(InvalidPhraseError);
    },
  );

  it('protects its state and date against external mutation', () => {
    const input = props();
    const phrase = new Phrase(input);
    input.createdAt.setTime(0);
    phrase.createdAt.setTime(1);
    expect(phrase.createdAt.toISOString()).toBe('2026-10-21T12:00:00.000Z');
    expect(() => Object.assign(phrase, { modelId: 'changed' })).toThrow(
      TypeError,
    );
  });
});
