import { Injectable } from '@nestjs/common';
import { DeletePhrasePort } from '../ports/inbound/delete-phrase.port';
import { PhraseRepositoryPort } from '../ports/outbound/phrase-repository.port';
import { PhraseNotFoundError } from '../errors/phrase-not-found.error';

@Injectable()
export class DeletePhraseUseCase implements DeletePhrasePort {
  constructor(private readonly repository: PhraseRepositoryPort) {}

  async execute(id: string): Promise<void> {
    const deleted = await this.repository.softDelete(id);
    if (!deleted) throw new PhraseNotFoundError();
  }
}
