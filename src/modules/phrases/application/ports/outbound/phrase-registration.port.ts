import type { Phrase } from '../../../domain/entities/phrase.entity';

export abstract class PhraseRegistrationPort {
  abstract register(
    phrase: Phrase,
    validationId: string,
    consumedAt: Date,
  ): Promise<void>;
}
