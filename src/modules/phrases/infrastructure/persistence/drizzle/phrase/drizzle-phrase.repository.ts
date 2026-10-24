import { IncompatiblePhraseCollectionError } from '../../../../application/errors/incompatible-phrase-collection.error';
import { ValidationMatch } from '../../../../domain/types/validation-match.type';
import { SimilarityScore } from '../../../../domain/value-objects/similarity-score.value-object';
import { ValidationSearchInput } from '../../../../application/ports/outbound/phrase-repository.port';
import { DatabaseError } from '../../../../../../shared/infrastructure/database/errors/database.error';
import { Injectable, Logger } from '@nestjs/common';
import { and, asc, cosineDistance, desc, eq, sql } from 'drizzle-orm';
import {
  PhrasePageRows,
  PhraseRepositoryPort,
} from '../../../../application/ports/outbound/phrase-repository.port';
import { DatabaseProvider } from '../../../../../../shared/infrastructure/database/database.provider';
import { DrizzlePhrasesModel } from './drizzle-phrases.model';
import { DrizzlePhraseMapper } from './drizzle-phrase.mapper';
import { PhraseStatusEnum } from '../../../../domain/enums/phrase-status.enum';
import { ValidationMatchEnum } from '../../../../domain/enums/validation-match.enum';

@Injectable()
export class DrizzlePhraseRepository implements PhraseRepositoryPort {
  private readonly logger = new Logger(DrizzlePhraseRepository.name);

  constructor(private readonly database: DatabaseProvider) {}

  async findValidationMatch(
    input: ValidationSearchInput,
  ): Promise<ValidationMatch | null> {
    this.logger.log(`Searching textual match: "${input.normalizedText}"`);
    const textualMatch = await this.findTextualMatch(input.normalizedText);
    if (textualMatch) {
      this.logger.log(
        `Textual match found: id=${textualMatch.phrase.id} text="${textualMatch.phrase.text}"`,
      );
      return textualMatch;
    }
    this.logger.log('No textual match, falling back to vector search');

    const vectorMatch = await this.findVectorMatch(input);
    if (vectorMatch) return vectorMatch;

    let anyActive: { id: string } | undefined;
    try {
      [anyActive] = await this.database.client
        .select({ id: DrizzlePhrasesModel.id })
        .from(DrizzlePhrasesModel)
        .where(eq(DrizzlePhrasesModel.status, PhraseStatusEnum.ACTIVE))
        .limit(1);
    } catch (error) {
      throw new DatabaseError(error);
    }
    if (anyActive) {
      this.logger.warn(
        'Active phrases exist but none share the current model/version',
      );
      throw new IncompatiblePhraseCollectionError();
    }
    this.logger.log('No active phrases stored, no match');
    return null;
  }

  private async findTextualMatch(
    normalizedText: string,
  ): Promise<ValidationMatch | null> {
    let match: { id: string; text: string } | undefined;
    try {
      [match] = await this.database.client
        .select({ id: DrizzlePhrasesModel.id, text: DrizzlePhrasesModel.text })
        .from(DrizzlePhrasesModel)
        .where(
          and(
            eq(DrizzlePhrasesModel.normalizedText, normalizedText),
            eq(DrizzlePhrasesModel.status, PhraseStatusEnum.ACTIVE),
          ),
        )
        .orderBy(
          desc(DrizzlePhrasesModel.createdAt),
          desc(DrizzlePhrasesModel.id),
        )
        .limit(1);
    } catch (error) {
      throw new DatabaseError(error);
    }
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
    const distance = cosineDistance(
      DrizzlePhrasesModel.embedding,
      JSON.stringify(input.embedding.values),
    );
    let match: { id: string; text: string; distance: number } | undefined;
    this.logger.log(
      `Vector search (cosine): model=${input.model.id}@${input.model.version} dimensions=${input.embedding.values.length}`,
    );

    try {
      [match] = await this.database.client
        .select({
          id: DrizzlePhrasesModel.id,
          text: DrizzlePhrasesModel.text,
          distance: sql<number>`${distance}`.as('distance'),
        })
        .from(DrizzlePhrasesModel)
        .where(
          and(
            eq(DrizzlePhrasesModel.modelId, input.model.id),
            eq(DrizzlePhrasesModel.modelVersion, input.model.version),
            eq(DrizzlePhrasesModel.status, PhraseStatusEnum.ACTIVE),
          ),
        )
        .orderBy(asc(distance), asc(DrizzlePhrasesModel.id))
        .limit(1);
    } catch (error) {
      throw new DatabaseError(error);
    }

    if (!match) {
      this.logger.log(
        `Vector search found no candidates for model ${input.model.id}@${input.model.version}`,
      );
      return null;
    }

    let score = 1 - Number(match.distance);
    if (score > 1 && score <= 1 + 1e-6) score = 1;
    if (score < -1 && score >= -1 - 1e-6) score = -1;
    this.logger.log(
      `Nearest neighbor: id=${match.id} text="${match.text}" distance=${Number(match.distance).toFixed(6)} score=${score.toFixed(6)}`,
    );

    return {
      type: ValidationMatchEnum.Vector,
      phrase: { id: match.id, text: match.text },
      similarityScore: new SimilarityScore(score),
    };
  }

  async list(page: number, limit: number): Promise<PhrasePageRows> {
    let count: { total: string };
    let rows: (typeof DrizzlePhrasesModel.$inferSelect)[];
    const offset = (page - 1) * limit;
    const active = eq(DrizzlePhrasesModel.status, PhraseStatusEnum.ACTIVE);
    try {
      [count] = await this.database.client
        .select({ total: sql<string>`count(*)` })
        .from(DrizzlePhrasesModel)
        .where(active);
      rows = await this.database.client
        .select()
        .from(DrizzlePhrasesModel)
        .where(active)
        .orderBy(
          desc(DrizzlePhrasesModel.createdAt),
          desc(DrizzlePhrasesModel.id),
        )
        .limit(limit)
        .offset(offset);
    } catch (error) {
      throw new DatabaseError(error);
    }

    return {
      data: DrizzlePhraseMapper.toDomainMany(rows),
      total: Number(count.total),
    };
  }

  async softDelete(id: string): Promise<boolean> {
    try {
      const rows = await this.database.client
        .update(DrizzlePhrasesModel)
        .set({
          status: PhraseStatusEnum.DELETED,
          deletedAt: sql`now()`,
        })
        .where(
          and(
            eq(DrizzlePhrasesModel.id, id),
            eq(DrizzlePhrasesModel.status, PhraseStatusEnum.ACTIVE),
          ),
        )
        .returning({ id: DrizzlePhrasesModel.id });
      return rows.length > 0;
    } catch (error) {
      throw new DatabaseError(error);
    }
  }
}
