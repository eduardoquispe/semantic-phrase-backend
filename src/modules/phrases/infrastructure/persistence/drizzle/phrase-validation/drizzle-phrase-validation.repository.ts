import { eq } from 'drizzle-orm';
import { Injectable } from '@nestjs/common';
import { PhraseValidationRepositoryPort } from '../../../../application/ports/outbound/phrase-validation-repository.port';
import { PhraseValidation } from '../../../../domain/entities/phrase-validation.entity';
import { DatabaseProvider } from '../../../../../../shared/infrastructure/database/database.provider';
import { DrizzlePhraseValidationsModel } from './drizzle-phrase-validations.model';
import { DrizzlePhraseValidationMapper } from './drizzle-phrase-validation.mapper';
import { DatabaseError } from '../../../../../../shared/infrastructure/database/errors/database.error';
@Injectable()
export class DrizzlePhraseValidationRepository implements PhraseValidationRepositoryPort {
  constructor(private readonly database: DatabaseProvider) {}

  async findById(id: string): Promise<PhraseValidation | null> {
    let rows: (typeof DrizzlePhraseValidationsModel.$inferSelect)[];
    try {
      rows = await this.database.client
        .select()
        .from(DrizzlePhraseValidationsModel)
        .where(eq(DrizzlePhraseValidationsModel.id, id))
        .limit(1);
    } catch (error) {
      throw new DatabaseError(error);
    }
    const [row] = rows;
    return row ? DrizzlePhraseValidationMapper.toDomain(row) : null;
  }

  async save(validation: PhraseValidation): Promise<void> {
    const data = DrizzlePhraseValidationMapper.toPersistence(validation);
    try {
      await this.database.client
        .insert(DrizzlePhraseValidationsModel)
        .values(data);
    } catch (error) {
      throw new DatabaseError(error);
    }
  }
}
