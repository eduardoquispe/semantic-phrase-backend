import type { Phrase } from '../../../domain/entities/phrase.entity';
export interface CreatePhraseInput {
  text: string;
  validationId: string;
  confirmed?: boolean;
}
export abstract class CreatePhrasePort {
  abstract execute(input: CreatePhraseInput): Promise<Phrase>;
}
