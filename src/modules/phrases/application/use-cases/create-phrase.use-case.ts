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
import { PhraseModel } from '../../domain/value-objects/phrase-model.value-object';
import { PhraseRegistrationError } from '../errors/phrase-registration.error';

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
    const text = PhraseText.forValidation(input.text).value;
    const phraseValidation = await this.phraseValidationsRepository.findById(
      input.validationId,
    );

    if (!phraseValidation)
      throw new PhraseRegistrationError('INVALID_VALIDATION_ID');
    if (phraseValidation.isConsumed())
      throw new PhraseRegistrationError('VALIDATION_ALREADY_USED');
    if (phraseValidation.isExpired(new Date()))
      throw new PhraseRegistrationError('VALIDATION_EXPIRED');
    if (!phraseValidation.matches(text))
      throw new PhraseRegistrationError('PHRASE_MISMATCH');
    if (!phraseValidation.isCompatibleWith(this.expectedModel))
      throw new PhraseRegistrationError('INCOMPATIBLE_MODEL');
    if (phraseValidation.needsConfirmation(input.confirmed === true))
      throw new PhraseRegistrationError('CONFIRMATION_REQUIRED');

    const phrase = new Phrase({
      id: new PhraseId(randomUUID()),
      text: phraseValidation.text,
      normalizedText: phraseValidation.normalizedText,
      embedding: phraseValidation.embedding,
      modelId: phraseValidation.model.id,
      modelVersion: phraseValidation.model.version,
      createdAt: new Date(),
    });

    await this.registration.register(phrase, phraseValidation.id, new Date());
    return phrase;
  }
}
