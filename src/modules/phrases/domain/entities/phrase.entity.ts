import type { Embedding } from '../value-objects/embedding.value-object';
import type { PhraseId } from '../value-objects/phrase-id.value-object';
import type { PhraseText } from '../value-objects/phrase-text.value-object';
import type { NormalizedPhraseText } from '../value-objects/normalized-phrase-text.value-object';
import type { PhraseModel } from '../value-objects/phrase-model.value-object';
import type { PhraseProps } from '../types/phrase-props.interface';
import type { CreatePhraseProps } from '../types/create-phrase-input.interface';
import { toTimestamp } from '../../../../shared/domain/utils/to-timestamp';

export class Phrase {
  private readonly _id: PhraseId;
  private _text: PhraseText;
  private _embedding: Embedding;
  private _normalizedText: NormalizedPhraseText;
  private _model: PhraseModel;
  private _createdAt: number;

  private constructor(props: PhraseProps) {
    this._id = props.id;
    this._text = props.text;
    this._normalizedText = props.normalizedText;
    this._embedding = props.embedding;
    this._model = props.model;
    this._createdAt = toTimestamp(props.createdAt, 'createdAt');
  }

  static create(props: CreatePhraseProps): Phrase {
    return new Phrase({
      id: props.id,
      text: props.text,
      normalizedText: props.normalizedText,
      embedding: props.embedding,
      model: props.model,
      createdAt: props.now,
    });
  }

  static reconstitute(props: PhraseProps): Phrase {
    return new Phrase(props);
  }

  get id(): string {
    return this._id.value;
  }

  get createdAt(): Date {
    return new Date(this._createdAt);
  }

  get text(): PhraseText {
    return this._text;
  }

  get embedding(): Embedding {
    return this._embedding;
  }

  get normalizedText(): string {
    return this._normalizedText.value;
  }

  get model(): PhraseModel {
    return this._model;
  }
}
