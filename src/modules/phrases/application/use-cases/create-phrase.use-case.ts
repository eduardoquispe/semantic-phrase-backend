import { ConfigurationPort } from '../../../../shared/application/ports/outbound/configuration.port';
import { Injectable } from '@nestjs/common';
import {
  CreatePhrasePort,
  CreatePhraseInput,
} from '../ports/inbound/create-phrase.port';
import { PhraseValidationRepositoryPort } from '../ports/outbound/phrase-validation-repository.port';
import { PhraseRepositoryPort } from '../ports/outbound/phrase-repository.port';
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
    private readonly validations: PhraseValidationRepositoryPort,
    private readonly phrases: PhraseRepositoryPort,
    private readonly config: ConfigurationPort,
  ) {
    this.expectedModel = new PhraseModel(
      config.getOrThrow<string>('AI_MODEL'),
      config.getOrThrow<string>('AI_EMBEDDING_VERSION'),
    );
  }
  async execute(input: CreatePhraseInput) {
    const text = PhraseText.forValidation(input.text).value;
    const validation = await this.validations.findById(input.validationId);

    if (!validation) throw new PhraseRegistrationError('INVALID_VALIDATION_ID');
    if (validation.consumedAt !== null)
      throw new PhraseRegistrationError('VALIDATION_ALREADY_USED');
    if (validation.isExpired(new Date()))
      throw new PhraseRegistrationError('VALIDATION_EXPIRED');
    if (validation.text.value !== text)
      throw new PhraseRegistrationError('PHRASE_MISMATCH');
    if (
      validation.model.id !== this.expectedModel.id ||
      validation.model.version !== this.expectedModel.version
    )
      throw new Error('Incompatible validation model');
    if (validation.requiresConfirmation && input.confirmed !== true)
      throw new PhraseRegistrationError('CONFIRMATION_REQUIRED');

    const phrase = new Phrase({
      id: new PhraseId(randomUUID()),
      text: validation.text,
      normalizedText: validation.normalizedText,
      embedding: validation.embedding,
      modelId: validation.model.id,
      modelVersion: validation.model.version,
      createdAt: new Date(),
    });

    await this.phrases.save(phrase);
    await this.validations.update(validation.id, {
      consumedAt: new Date(),
    });
    return phrase;
  }
}
