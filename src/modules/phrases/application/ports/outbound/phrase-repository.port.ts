import type { ValidationMatch } from '../../../domain/types/validation-match.type';
import type { GeneratedEmbedding } from './embedding-generator.port';
import { Phrase } from '../../../domain/entities/phrase.entity';

export interface PhrasePageRows {
  data: Phrase[];
  total: number;
}

export interface ValidationSearchInput extends GeneratedEmbedding {
  normalizedText: string;
}
export abstract class PhraseRepositoryPort {
  abstract findValidationMatch(
    input: ValidationSearchInput,
  ): Promise<ValidationMatch | null>;
  abstract list(page: number, limit: number): Promise<PhrasePageRows>;
  abstract softDelete(id: string): Promise<boolean>;
}
