import { InvalidDateError } from '../../../../shared/domain/errors/invalid-date.error';
import { Embedding } from '../value-objects/embedding.value-object';
import { NormalizedPhraseText } from '../value-objects/normalized-phrase-text.value-object';
import { PhraseId } from '../value-objects/phrase-id.value-object';
import { PhraseModel } from '../value-objects/phrase-model.value-object';
import { PhraseText } from '../value-objects/phrase-text.value-object';
import type { PhraseProps } from '../types/phrase-props.interface';
import { Phrase } from './phrase.entity';

describe('Phrase', () => {
  const props = (): PhraseProps => ({
    id: new PhraseId('550e8400-e29b-41d4-a716-446655440000'),
    text: new PhraseText('  Una FRASE  '),
    normalizedText: new NormalizedPhraseText('una frase'),
    embedding: new Embedding(Array<number>(384).fill(0.25)),
    model: new PhraseModel('MiniLM', 'revision-1'),
    createdAt: new Date('2026-10-21T12:00:00.000Z'),
  });

  it('reconstitutes a complete registered phrase', () => {
    const input = props();
    const phrase = Phrase.reconstitute(input);
    expect(phrase.id).toBe(input.id.value);
    expect(phrase.text).toBe(input.text);
    expect(phrase.embedding).toBe(input.embedding);
    expect(phrase.model).toBe(input.model);
    expect(phrase.createdAt).toEqual(input.createdAt);
    expect(phrase.normalizedText).toBe('una frase');
    expect(phrase.text.value).toBe('  Una FRASE  ');
  });

  it('creates a phrase using the supplied time as creation date', () => {
    const { createdAt, ...rest } = props();
    const phrase = Phrase.create({ ...rest, now: createdAt });
    expect(phrase.createdAt).toEqual(createdAt);
    expect(phrase.id).toBe(rest.id.value);
  });

  it('preserves stored normalized text without recalculating it', () => {
    const phrase = Phrase.reconstitute({
      ...props(),
      normalizedText: new NormalizedPhraseText(
        'valor persistido con reglas anteriores',
      ),
    });
    expect(phrase.normalizedText).toBe(
      'valor persistido con reglas anteriores',
    );
    expect(phrase.text.value).toBe('  Una FRASE  ');
  });

  it.each([new Date(NaN), '2026-10-21', null, undefined])(
    'rejects invalid creation dates: %p',
    (createdAt) => {
      expect(() =>
        Phrase.reconstitute({ ...props(), createdAt: createdAt as Date }),
      ).toThrow(InvalidDateError);
    },
  );

  it('protects its date against external mutation', () => {
    const input = props();
    const phrase = Phrase.reconstitute(input);
    input.createdAt.setTime(0);
    phrase.createdAt.setTime(1);
    expect(phrase.createdAt.toISOString()).toBe('2026-10-21T12:00:00.000Z');
  });
});
