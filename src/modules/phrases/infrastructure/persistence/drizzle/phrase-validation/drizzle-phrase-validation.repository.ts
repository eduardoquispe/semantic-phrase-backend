import { Injectable } from '@nestjs/common';
import { PhraseValidationRepositoryPort } from '../../../../application/ports/outbound/phrase-validation-repository.port';
import { PhraseValidation } from '../../../../domain/entities/phrase-validation.entity';
import { DatabaseProvider } from '../../../../../../shared/infrastructure/database/database.provider';
import { DrizzlePhraseValidationsModel } from './drizzle-phrase-validations.model';
import { DrizzlePhraseValidationMapper } from './drizzle-phrase-validation.mapper';
import { rethrowDatabaseOperationError } from '../database-operation-error';
@Injectable()
export class DrizzlePhraseValidationRepository extends PhraseValidationRepositoryPort {
  constructor(private readonly database: DatabaseProvider) {
    super();
  }
  async save(validation: PhraseValidation): Promise<void> {
    try {
      await this.database.client
        .insert(DrizzlePhraseValidationsModel)
        .values(DrizzlePhraseValidationMapper.toPersistence(validation));
    } catch (error) {
      rethrowDatabaseOperationError(error);
    }
  }
}
