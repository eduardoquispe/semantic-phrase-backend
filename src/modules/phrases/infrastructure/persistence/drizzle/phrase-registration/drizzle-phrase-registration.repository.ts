import { Injectable } from '@nestjs/common';
import { and, eq, isNull } from 'drizzle-orm';
import { PhraseRegistrationError } from '../../../../application/errors/phrase-registration.error';
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

  async register(
    phrase: Phrase,
    validationId: string,
    consumedAt: Date,
  ): Promise<void> {
    const data = DrizzlePhraseMapper.toPersistence(phrase);
    try {
      await this.database.client.transaction(async (tx) => {
        const consumed = await tx
          .update(DrizzlePhraseValidationsModel)
          .set({ consumedAt })
          .where(
            and(
              eq(DrizzlePhraseValidationsModel.id, validationId),
              isNull(DrizzlePhraseValidationsModel.consumedAt),
            ),
          )
          .returning({ id: DrizzlePhraseValidationsModel.id });
        if (!consumed.length)
          throw new PhraseRegistrationError('VALIDATION_ALREADY_USED');
        await tx.insert(DrizzlePhrasesModel).values(data);
      });
    } catch (error) {
      if (error instanceof PhraseRegistrationError) throw error;
      throw new DatabaseError(error);
    }
  }
}
