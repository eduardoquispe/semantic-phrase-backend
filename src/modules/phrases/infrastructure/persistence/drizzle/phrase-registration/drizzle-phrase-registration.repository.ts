import { Injectable } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { PhraseValidationAlreadyUsedError } from '../../../../domain/errors/validation-already-used.error';
import { PhraseRegistrationPort } from '../../../../application/ports/outbound/phrase-registration.port';
import { Phrase } from '../../../../domain/entities/phrase.entity';
import { DatabaseProvider } from '../../../../../../shared/infrastructure/database/database.provider';
import { DatabaseError } from '../../../../../../shared/infrastructure/database/errors/database.error';
import { DrizzlePhraseMapper } from '../phrase/drizzle-phrase.mapper';
import { DrizzlePhrasesModel } from '../phrase/drizzle-phrases.model';
import { DrizzlePhraseValidationsModel } from '../phrase-validation/drizzle-phrase-validations.model';

@Injectable()
export class DrizzlePhraseRegistrationRepository implements PhraseRegistrationPort {
  constructor(private readonly database: DatabaseProvider) {}

  async register(phrase: Phrase, validationId: string): Promise<void> {
    const data = DrizzlePhraseMapper.toPersistence(phrase);
    const { createdAt } = data;
    try {
      await this.database.client.transaction(async (tx) => {
        const consumed = await tx
          .update(DrizzlePhraseValidationsModel)
          .set({ consumedAt: createdAt })
          .where(
            and(
              eq(DrizzlePhraseValidationsModel.id, validationId),
              isNull(DrizzlePhraseValidationsModel.consumedAt),
            ),
          )
          .returning({ id: DrizzlePhraseValidationsModel.id });
        if (!consumed.length) throw new PhraseValidationAlreadyUsedError();
        await tx.insert(DrizzlePhrasesModel).values(data);
      });
    } catch (error) {
      if (error instanceof PhraseValidationAlreadyUsedError) throw error;
      throw new DatabaseError(error);
    }
  }
}
