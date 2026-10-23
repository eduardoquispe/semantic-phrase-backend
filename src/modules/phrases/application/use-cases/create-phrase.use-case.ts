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
import { NormalizedPhraseText } from '../../domain/value-objects/normalized-phrase-text.value-object';
import { PhraseModel } from '../../domain/value-objects/phrase-model.value-object';
import { PhraseValidationNotFoundError } from '../errors/phrase-validation-not-found.error';

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

    if (!validation) throw new PhraseValidationNotFoundError();

    const now = new Date();

    validation.verifyUsable({
      text,
      model: this.expectedModel,
      confirmed: !!input.confirmed,
      now,
    });

    const phrase = Phrase.create({
      id: new PhraseId(randomUUID()),
      text: validation.text,
      normalizedText: new NormalizedPhraseText(validation.normalizedText),
      embedding: validation.embedding,
      model: validation.model,
      now,
    });

    await this.phrases.save(phrase);
    await this.validations.update(validation.id, {
      consumedAt: now,
    });
    return phrase;
  }
}
