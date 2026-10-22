import { IncompatiblePhraseCollectionError } from '../../../../application/errors/incompatible-phrase-collection.error';
import { ValidationMatch } from '../../../../domain/types/validation-match.type';
import { SimilarityScore } from '../../../../domain/value-objects/similarity-score.value-object';
import { ValidationSearchInput } from '../../../../application/ports/outbound/phrase-repository.port';
import { rethrowDatabaseOperationError } from '../database-operation-error';
import { Injectable } from '@nestjs/common';
import { desc, sql } from 'drizzle-orm';
import {
  PhrasePageRows,
  PhraseRepositoryPort,
} from '../../../../application/ports/outbound/phrase-repository.port';
import { DatabaseProvider } from '../../../../../../shared/infrastructure/database/database.provider';
import { DrizzlePhrasesModel } from './drizzle-phrases.model';
import { DrizzlePhraseMapper } from './drizzle-phrase.mapper';
import { ValidationMatchEnum } from '../../../../domain/enums/validation-match.enum';

@Injectable()
export class DrizzlePhraseRepository implements PhraseRepositoryPort {
  constructor(private readonly database: DatabaseProvider) {}

  async findValidationMatch(
    input: ValidationSearchInput,
  ): Promise<ValidationMatch | null> {
    try {
      const textualMatch = await this.findTextualMatch(input.normalizedText);
      if (textualMatch) return textualMatch;

      const vectorMatch = await this.findVectorMatch(input);
      if (vectorMatch) return vectorMatch;

      const { rows } = await this.database.client.execute(sql`
        SELECT id FROM phrases LIMIT 1
      `);
      if (rows.length) throw new IncompatiblePhraseCollectionError();
      return null;
    } catch (error) {
      if (error instanceof IncompatiblePhraseCollectionError) throw error;
      rethrowDatabaseOperationError(error);
    }
  }

  private async findTextualMatch(
    normalizedText: string,
  ): Promise<ValidationMatch | null> {
    const { rows } = await this.database.client.execute<{
      id: string;
      text: string;
    }>(sql`
      SELECT id, text FROM phrases
      WHERE normalized_text = ${normalizedText}
      ORDER BY created_at DESC, id DESC LIMIT 1
    `);

    const match = rows[0];
    if (!match) return null;

    return {
      type: ValidationMatchEnum.TextualExact,
      phrase: match,
      similarityScore: null,
    };
  }

  private async findVectorMatch(
    input: ValidationSearchInput,
  ): Promise<ValidationMatch | null> {
    const vector = JSON.stringify(input.embedding.values);
    const { rows } = await this.database.client.execute<{
      id: string;
      text: string;
      distance: number;
    }>(sql`
      SELECT id, text, embedding <=> ${vector}::vector AS distance
      FROM phrases
      WHERE model_id = ${input.model.id} AND model_version = ${input.model.version}
      ORDER BY distance ASC, id ASC LIMIT 1
    `);

    const match = rows[0];
    if (!match) return null;

    let score = 1 - match.distance;
    if (score > 1 && score <= 1 + 1e-6) score = 1;
    if (score < -1 && score >= -1 - 1e-6) score = -1;

    return {
      type: ValidationMatchEnum.Vector,
      phrase: { id: match.id, text: match.text },
      similarityScore: new SimilarityScore(score),
    };
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
