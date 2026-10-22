import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../shared/infrastructure/database/database.module';
import { ListPhrasesPort } from './application/ports/inbound/list-phrases.port';
import { PhraseRepositoryPort } from './application/ports/outbound/phrase-repository.port';
import { ListPhrasesUseCase } from './application/use-cases/list-phrases.use-case';
import { DrizzlePhraseRepository } from './infrastructure/persistence/drizzle/drizzle-phrase.repository';
import { PhrasesController } from './infrastructure/http/controllers/phrases.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [PhrasesController],
  providers: [
    ListPhrasesUseCase,
    { provide: ListPhrasesPort, useExisting: ListPhrasesUseCase },
    { provide: PhraseRepositoryPort, useClass: DrizzlePhraseRepository },
  ],
})
export class PhrasesModule {}
