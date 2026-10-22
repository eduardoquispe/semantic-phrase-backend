import type { Embedding } from '../value-objects/embedding.value-object';
import type { PhraseId } from '../value-objects/phrase-id.value-object';
import type { PhraseText } from '../value-objects/phrase-text.value-object';
import { NormalizedPhraseText } from '../value-objects/normalized-phrase-text.value-object';
import { PhraseModel } from '../value-objects/phrase-model.value-object';
import { PhraseCreatedAt } from '../value-objects/phrase-created-at.value-object';

export interface PhraseProps {
  readonly id: PhraseId;
  readonly text: PhraseText;
  readonly normalizedText: string;
  readonly embedding: Embedding;
  readonly modelId: string;
  readonly modelVersion: string;
  readonly createdAt: Date;
}

export class Phrase {
  private readonly _id: PhraseId;
  private readonly _text: PhraseText;
  private readonly _embedding: Embedding;
  private readonly _normalizedText: NormalizedPhraseText;
  private readonly _model: PhraseModel;
  private readonly _createdAt: PhraseCreatedAt;

  constructor(props: PhraseProps) {
    this._id = props.id;
    this._text = props.text;
    this._normalizedText = new NormalizedPhraseText(props.normalizedText);
    this._embedding = props.embedding;
    this._model = new PhraseModel(props.modelId, props.modelVersion);
    this._createdAt = new PhraseCreatedAt(props.createdAt);
    Object.freeze(this);
  }

  get id(): string {
    return this._id.value;
  }

  get createdAt(): Date {
    return this._createdAt.value;
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

  get modelId(): string {
    return this._model.id;
  }

  get modelVersion(): string {
    return this._model.version;
  }
}
