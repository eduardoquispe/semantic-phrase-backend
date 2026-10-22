import type { PhraseValidation } from '../../../domain/entities/phrase-validation.entity';

export abstract class PhraseValidationRepositoryPort {
  abstract save(validation: PhraseValidation): Promise<void>;
  abstract update(
    id: string,
    validation: Partial<PhraseValidation>,
  ): Promise<void>;
  abstract findById(id: string): Promise<PhraseValidation | null>;
}
