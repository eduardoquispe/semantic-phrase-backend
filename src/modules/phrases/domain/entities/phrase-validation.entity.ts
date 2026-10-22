import type { PhraseText } from '../value-objects/phrase-text.value-object';
import type { Embedding } from '../value-objects/embedding.value-object';
import type { PhraseModel } from '../value-objects/phrase-model.value-object';
import type { PhraseValidationProps } from '../types/phrase-validation-props.interface';
import type { PhraseValidationMatch } from '../value-objects/phrase-validation-match.value-object';

export class PhraseValidation {
  readonly id: string;
  readonly text: PhraseText;
  readonly embedding: Embedding;
  readonly model: PhraseModel;
  readonly normalizedText: string;
  readonly requiresConfirmation: boolean;
  readonly consumedAt = null;
  private readonly created: number;
  private readonly expires: number;
  readonly match: PhraseValidationMatch | null;

  constructor(props: PhraseValidationProps) {
    this.id = props.id.value;
    this.text = props.text;
    this.normalizedText = this.text.normalized;
    this.embedding = props.embedding;
    this.model = props.model;
    this.created = props.createdAt.getTime();
    this.expires = props.expiresAt.getTime();
    this.match = props.match;
    this.requiresConfirmation =
      this.match?.requiresConfirmation(props.threshold) ?? false;

    Object.freeze(this);
  }

  get createdAt(): Date {
    return new Date(this.created);
  }

  get expiresAt(): Date {
    return new Date(this.expires);
  }

  isExpired(now: Date): boolean {
    return now.getTime() >= this.expires;
  }
}
