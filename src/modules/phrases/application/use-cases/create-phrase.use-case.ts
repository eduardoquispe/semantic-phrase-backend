import { ConfigurationPort } from '../../../../shared/application/ports/outbound/configuration.port';
import { Injectable } from '@nestjs/common';
import {
  CreatePhrasePort,
  CreatePhraseInput,
} from '../ports/inbound/create-phrase.port';
import { PhraseValidationRepositoryPort } from '../ports/outbound/phrase-validation-repository.port';
import { PhraseRegistrationPort } from '../ports/outbound/phrase-registration.port';
import { randomUUID } from 'node:crypto';
import { Phrase } from '../../domain/entities/phrase.entity';
import { PhraseId } from '../../domain/value-objects/phrase-id.value-object';
import { PhraseText } from '../../domain/value-objects/phrase-text.value-object';
import { NormalizedPhraseText } from '../../domain/value-objects/normalized-phrase-text.value-object';
import { PhraseModel } from '../../domain/value-objects/phrase-model.value-object';
import { PhraseValidationNotFoundError } from '../errors/phrase-validation-not-found.error';

@Injectable()
export class CreatePhraseUseCase implements CreatePhrasePort {
  private readonly expectedModel: PhraseModel;

  constructor(
    private readonly phraseValidationsRepository: PhraseValidationRepositoryPort,
    private readonly registration: PhraseRegistrationPort,
    private readonly config: ConfigurationPort,
  ) {
    this.expectedModel = new PhraseModel(
      config.getOrThrow<string>('AI_MODEL'),
      config.getOrThrow<string>('AI_EMBEDDING_VERSION'),
    );
  }
  async execute(input: CreatePhraseInput) {
    const text = new PhraseText(input.text).value;
    const phraseValidation = await this.phraseValidationsRepository.findById(
      input.validationId,
    );

    if (!phraseValidation) throw new PhraseValidationNotFoundError();

    const now = new Date();

    phraseValidation.verifyUsable({
      text,
      model: this.expectedModel,
      confirmed: !!input.confirmed,
      now,
    });

    const phrase = Phrase.create({
      id: new PhraseId(randomUUID()),
      text: phraseValidation.text,
      normalizedText: new NormalizedPhraseText(phraseValidation.normalizedText),
      embedding: phraseValidation.embedding,
      model: phraseValidation.model,
      now,
    });

    await this.registration.register(phrase, phraseValidation.id);
    return phrase;
  }
}
