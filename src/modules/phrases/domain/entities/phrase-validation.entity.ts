import type { PhraseText } from '../value-objects/phrase-text.value-object';
import type { Embedding } from '../value-objects/embedding.value-object';
import type { PhraseModel } from '../value-objects/phrase-model.value-object';
import type { PhraseValidationProps } from '../types/phrase-validation-props.interface';
import type { CreatePhraseValidationProps } from '../types/create-phrase-validation-input.interface';
import type { SimilarityScore } from '../value-objects/similarity-score.value-object';
import { NormalizedPhraseText } from '../value-objects/normalized-phrase-text.value-object';
import { PhraseId } from '../value-objects/phrase-id.value-object';
import { ValidationMatchEnum } from '../enums/validation-match.enum';
import { toTimestamp } from '../../../../shared/domain/utils/to-timestamp';
import {
  MS_PER_MINUTE,
  MS_PER_SECOND,
} from '../constants/phrase-validation.constants';
import { InvalidPhraseValidationError } from '../errors/invalid-phrase-validation.error';
import { PhraseConfirmationRequiredError } from '../errors/confirmation-required.error';
import { IncompatibleValidationModelError } from '../errors/incompatible-validation-model.error';
import { PhraseMismatchError } from '../errors/phrase-mismatch.error';
import { PhraseValidationAlreadyUsedError } from '../errors/validation-already-used.error';
import { PhraseValidationExpiredError } from '../errors/validation-expired.error';

export class PhraseValidation {
  private readonly _id: PhraseId;
  private _text: PhraseText;
  private _embedding: Embedding;
  private _model: PhraseModel;
  private _normalizedText: NormalizedPhraseText;
  private _requiresConfirmation: boolean;
  private _matchedPhraseId: PhraseId | null;
  private _similarityScore: SimilarityScore | null;
  private _createdAt: number;
  private _expiresAt: number;
  private _consumedAt: number | null;

  private constructor(props: PhraseValidationProps) {
    this._id = props.id;
    this._text = props.text;
    this._embedding = props.embedding;
    this._model = props.model;
    this._normalizedText = props.normalizedText;
    this._requiresConfirmation = props.requiresConfirmation;
    this._matchedPhraseId = props.matchedPhraseId;
    this._similarityScore = props.similarityScore;
    this._createdAt = toTimestamp(props.createdAt, 'createdAt');
    this._expiresAt = toTimestamp(props.expiresAt, 'expiresAt');
    this._consumedAt =
      props.consumedAt === null
        ? null
        : toTimestamp(props.consumedAt, 'consumedAt');
  }

  static create(props: CreatePhraseValidationProps): PhraseValidation {
    if (!Number.isFinite(props.ttlMinutes) || props.ttlMinutes <= 0) {
      throw new InvalidPhraseValidationError(
        'ttlMinutes must be a positive number.',
      );
    }

    const createdAt = new Date(
      Math.floor(props.now.getTime() / MS_PER_SECOND) * MS_PER_SECOND,
    );
    const expiresAt = new Date(
      createdAt.getTime() + props.ttlMinutes * MS_PER_MINUTE,
    );

    const { match } = props;

    return new PhraseValidation({
      id: props.id,
      text: props.text,
      normalizedText: new NormalizedPhraseText(props.text.normalized),
      embedding: props.embedding,
      model: props.model,
      matchedPhraseId: match ? new PhraseId(match.phrase.id) : null,
      similarityScore: match?.similarityScore ?? null,
      requiresConfirmation:
        match !== null &&
        (match.type === ValidationMatchEnum.TextualExact ||
          match.similarityScore.value >= props.threshold),
      consumedAt: null,
      createdAt,
      expiresAt,
    });
  }

  static reconstitute(props: PhraseValidationProps): PhraseValidation {
    return new PhraseValidation(props);
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

  get matchedPhraseId(): string | null {
    return this._matchedPhraseId?.value ?? null;
  }

  get similarityScore(): SimilarityScore | null {
    return this._similarityScore;
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

  isConsumed(): boolean {
    return this._consumedAt !== null;
  }

  matches(text: string): boolean {
    return this._text.value === text;
  }

  isCompatibleWith(model: PhraseModel): boolean {
    return this._model.id === model.id && this._model.version === model.version;
  }

  verifyUsable(input: {
    text: string;
    model: PhraseModel;
    confirmed: boolean;
    now: Date;
  }): void {
    if (this.isConsumed()) throw new PhraseValidationAlreadyUsedError();
    if (this.isExpired(input.now)) throw new PhraseValidationExpiredError();
    if (!this.matches(input.text)) throw new PhraseMismatchError();
    if (!this.isCompatibleWith(input.model))
      throw new IncompatibleValidationModelError();
    if (this._requiresConfirmation && !input.confirmed)
      throw new PhraseConfirmationRequiredError();
  }
}
