import { Phrase } from '../../../domain/entities/phrase.entity';

export interface PhrasePageRows {
  data: Phrase[];
  total: number;
}

export abstract class PhraseRepositoryPort {
  abstract list(page: number, limit: number): Promise<PhrasePageRows>;
}
