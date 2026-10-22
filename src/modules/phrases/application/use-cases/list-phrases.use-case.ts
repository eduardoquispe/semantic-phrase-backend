import { Injectable } from '@nestjs/common';
import {
  ListPhrasesInput,
  ListPhrasesPort,
  ListPhrasesResult,
} from '../ports/inbound/list-phrases.port';
import { PhraseRepositoryPort } from '../ports/outbound/phrase-repository.port';

@Injectable()
export class ListPhrasesUseCase implements ListPhrasesPort {
  constructor(private readonly repository: PhraseRepositoryPort) {}

  async execute({ page, limit }: ListPhrasesInput): Promise<ListPhrasesResult> {
    const { data, total } = await this.repository.list(page, limit);

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }
}
