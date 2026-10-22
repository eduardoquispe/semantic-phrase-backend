import { Injectable } from '@nestjs/common';
import { desc, sql } from 'drizzle-orm';
import {
  PhrasePageRows,
  PhraseRepositoryPort,
} from '../../../application/ports/outbound/phrase-repository.port';
import { DatabaseProvider } from '../../../../../shared/infrastructure/database/database.provider';
import { DrizzlePhrasesModel } from './drizzle-phrases.model';
import { DrizzlePhraseMapper } from './drizzle-phrase.mapper';

@Injectable()
export class DrizzlePhraseRepository extends PhraseRepositoryPort {
  constructor(private readonly database: DatabaseProvider) {
    super();
  }

  async list(page: number, limit: number): Promise<PhrasePageRows> {
    const [count] = await this.database.client
      .select({ total: sql<string>`count(*)` })
      .from(DrizzlePhrasesModel);

    const offset = (page - 1) * limit;

    const rows = await this.database.client
      .select()
      .from(DrizzlePhrasesModel)
      .orderBy(
        desc(DrizzlePhrasesModel.createdAt),
        desc(DrizzlePhrasesModel.id),
      )
      .limit(limit)
      .offset(Number(offset));

    return {
      data: DrizzlePhraseMapper.toDomainMany(rows),
      total: Number(count.total),
    };
  }
}
