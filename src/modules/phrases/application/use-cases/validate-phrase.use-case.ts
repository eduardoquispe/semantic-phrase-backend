import { PhraseValidationMatch } from '../../domain/value-objects/phrase-validation-match.value-object';
import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  ValidatePhrasePort,
  ValidatePhraseInput,
  ValidatePhraseResult,
  VALIDATION_SETTINGS,
} from '../ports/inbound/validate-phrase.port';
import type { ValidationSettings } from '../ports/inbound/validate-phrase.port';
import { EmbeddingGeneratorPort } from '../ports/outbound/embedding-generator.port';
import { PhraseRepositoryPort } from '../ports/outbound/phrase-repository.port';
import { PhraseValidationRepositoryPort } from '../ports/outbound/phrase-validation-repository.port';
import { PhraseText } from '../../domain/value-objects/phrase-text.value-object';
import { PhraseId } from '../../domain/value-objects/phrase-id.value-object';
import { PhraseValidation } from '../../domain/entities/phrase-validation.entity';

@Injectable()
export class ValidatePhraseUseCase implements ValidatePhrasePort {
  constructor(
    private readonly generatorEmbedding: EmbeddingGeneratorPort,
    private readonly phrasesRepository: PhraseRepositoryPort,
    private readonly validations: PhraseValidationRepositoryPort,
    @Inject(VALIDATION_SETTINGS) private readonly settings: ValidationSettings,
  ) {}

  async execute(input: ValidatePhraseInput): Promise<ValidatePhraseResult> {
    const text = PhraseText.forValidation(input.text);

    const embedding = await this.generatorEmbedding.generate(text.value);
    const result = await this.phrasesRepository.findValidationMatch({
      ...embedding,
      normalizedText: text.normalized,
    });

    const now = Math.floor(Date.now() / 1000) * 1000;

    const validation = new PhraseValidation({
      id: new PhraseId(randomUUID()),
      text,
      ...embedding,
      match: result ? new PhraseValidationMatch(result) : null,
      threshold: this.settings.threshold,
      createdAt: new Date(now),
      expiresAt: new Date(now + this.settings.ttlMinutes * 60 * 1000),
    });

    await this.validations.save(validation);

    return {
      validationId: validation.id,
      expiresAt: validation.expiresAt,
      requiresConfirmation: validation.requiresConfirmation,
      match: validation.match,
    };
  }
}
