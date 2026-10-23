import type { PhraseText } from '../value-objects/phrase-text.value-object';
import type { Embedding } from '../value-objects/embedding.value-object';
import type { PhraseModel } from '../value-objects/phrase-model.value-object';
import type { PhraseValidationProps } from '../types/phrase-validation-props.interface';
import type { PhraseValidationMatch } from '../value-objects/phrase-validation-match.value-object';
import type { PhraseId } from '../value-objects/phrase-id.value-object';
import { NormalizedPhraseText } from '../value-objects/normalized-phrase-text.value-object';
import { InvalidPhraseValidationError } from '../errors/invalid-phrase-validation.error';

export class PhraseValidation {
  private readonly _id: PhraseId;
  private readonly _text: PhraseText;
  private readonly _embedding: Embedding;
  private readonly _model: PhraseModel;
  private readonly _normalizedText: NormalizedPhraseText;
  private readonly _requiresConfirmation: boolean;
  private readonly _match: PhraseValidationMatch | null;
  private readonly _createdAt: number;
  private readonly _expiresAt: number;
  private readonly _consumedAt: number | null;

  constructor(props: PhraseValidationProps) {
    this._id = props.id;
    this._text = props.text;
    this._embedding = props.embedding;
    this._model = props.model;
    this._normalizedText = new NormalizedPhraseText(props.normalizedText);
    this._requiresConfirmation = props.requiresConfirmation;
    this._match = props.match;
    this._createdAt = PhraseValidation.toTimestamp(
      props.createdAt,
      'createdAt',
    );
    this._expiresAt = PhraseValidation.toTimestamp(
      props.expiresAt,
      'expiresAt',
    );
    this._consumedAt =
      props.consumedAt === null
        ? null
        : PhraseValidation.toTimestamp(props.consumedAt, 'consumedAt');

    Object.freeze(this);
  }

  private static toTimestamp(value: Date, field: string): number {
    if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
      throw new InvalidPhraseValidationError(`${field} must be a valid Date.`);
    }
    return value.getTime();
  }

  get id(): string {
    return this._id.value;
  }

  get text(): PhraseText {
    return this._text;
  }

  get embedding(): Embedding {
    return this._embedding;
  }

  get model(): PhraseModel {
    return this._model;
  }

  get normalizedText(): string {
    return this._normalizedText.value;
  }

  get requiresConfirmation(): boolean {
    return this._requiresConfirmation;
  }

  get match(): PhraseValidationMatch | null {
    return this._match;
  }

  get consumedAt(): Date | null {
    return this._consumedAt === null ? null : new Date(this._consumedAt);
  }

  get createdAt(): Date {
    return new Date(this._createdAt);
  }

  get expiresAt(): Date {
    return new Date(this._expiresAt);
  }

  isExpired(now: Date): boolean {
    return now.getTime() >= this._expiresAt;
  }
}
