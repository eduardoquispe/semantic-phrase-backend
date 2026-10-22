import type { PhraseValidation } from '../../../domain/entities/phrase-validation.entity';
export abstract class PhraseValidationRepositoryPort {
  abstract save(validation: PhraseValidation): Promise<void>;
}
