import { CreatePhrasePort } from './application/ports/inbound/create-phrase.port';
import { CreatePhraseUseCase } from './application/use-cases/create-phrase.use-case';
import { ValidatePhrasePort } from './application/ports/inbound/validate-phrase.port';
import { EmbeddingGeneratorPort } from './application/ports/outbound/embedding-generator.port';
import { PhraseValidationRepositoryPort } from './application/ports/outbound/phrase-validation-repository.port';
import { ValidatePhraseUseCase } from './application/use-cases/validate-phrase.use-case';
import { HuggingFaceEmbeddingAdapter } from './infrastructure/embeddings/huggin-face/hugging-face-embedding.adapter';
import { PhraseValidationsController } from './infrastructure/http/controllers/phrase-validations.controller';
import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../shared/infrastructure/database/database.module';
import { DeletePhrasePort } from './application/ports/inbound/delete-phrase.port';
import { DeletePhraseUseCase } from './application/use-cases/delete-phrase.use-case';
import { ListPhrasesPort } from './application/ports/inbound/list-phrases.port';
import { PhraseRepositoryPort } from './application/ports/outbound/phrase-repository.port';
import { ListPhrasesUseCase } from './application/use-cases/list-phrases.use-case';
import { DrizzlePhraseRepository } from './infrastructure/persistence/drizzle/phrase/drizzle-phrase.repository';
import { PhrasesController } from './infrastructure/http/controllers/phrases.controller';
import { DrizzlePhraseValidationRepository } from './infrastructure/persistence/drizzle/phrase-validation/drizzle-phrase-validation.repository';

@Module({
  imports: [DatabaseModule],
  controllers: [PhrasesController, PhraseValidationsController],
  providers: [
    CreatePhraseUseCase,
    { provide: CreatePhrasePort, useExisting: CreatePhraseUseCase },
    ValidatePhraseUseCase,
    { provide: ValidatePhrasePort, useExisting: ValidatePhraseUseCase },
    { provide: EmbeddingGeneratorPort, useClass: HuggingFaceEmbeddingAdapter },
    {
      provide: PhraseValidationRepositoryPort,
      useClass: DrizzlePhraseValidationRepository,
    },
    ListPhrasesUseCase,
    { provide: ListPhrasesPort, useExisting: ListPhrasesUseCase },
    DeletePhraseUseCase,
    { provide: DeletePhrasePort, useExisting: DeletePhraseUseCase },
    { provide: PhraseRepositoryPort, useClass: DrizzlePhraseRepository },
  ],
})
export class PhrasesModule {}
