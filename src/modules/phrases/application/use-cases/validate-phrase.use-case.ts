import { ConfigurationPort } from '../../../../shared/application/ports/outbound/configuration.port';
import { Injectable } from '@nestjs/common';
import {
  DEFAULT_SIMILARITY_THRESHOLD,
  DEFAULT_VALIDATION_TTL_MINUTES,
} from '../constants/validate-phrase.constants';
import { randomUUID } from 'node:crypto';
import {
  ValidatePhrasePort,
  ValidatePhraseInput,
  ValidatePhraseResult,
} from '../ports/inbound/validate-phrase.port';
import { EmbeddingGeneratorPort } from '../ports/outbound/embedding-generator.port';
import { PhraseRepositoryPort } from '../ports/outbound/phrase-repository.port';
import { PhraseValidationRepositoryPort } from '../ports/outbound/phrase-validation-repository.port';
import { PhraseText } from '../../domain/value-objects/phrase-text.value-object';
import { PhraseId } from '../../domain/value-objects/phrase-id.value-object';
import { PhraseValidation } from '../../domain/entities/phrase-validation.entity';

@Injectable()
export class ValidatePhraseUseCase implements ValidatePhrasePort {
  private readonly settings: { threshold: number; ttlMinutes: number };

  constructor(
    private readonly generatorEmbedding: EmbeddingGeneratorPort,
    private readonly phrasesRepository: PhraseRepositoryPort,
    private readonly validations: PhraseValidationRepositoryPort,
    private readonly config: ConfigurationPort,
  ) {
    this.settings = {
      threshold: Number(
        config.get<string | number>('AI_SIMILARITY_THRESHOLD') ??
          DEFAULT_SIMILARITY_THRESHOLD,
      ),
      ttlMinutes: Number(
        config.get<string | number>('PHRASE_VALIDATION_TTL_MINUTES') ??
          DEFAULT_VALIDATION_TTL_MINUTES,
      ),
    };
  }

  async execute(input: ValidatePhraseInput): Promise<ValidatePhraseResult> {
    const text = new PhraseText(input.text);

    const embeddingGenerated = await this.generatorEmbedding.generate(
      text.value,
    );
    const match = await this.phrasesRepository.findValidationMatch({
      embedding: embeddingGenerated.embedding,
      model: embeddingGenerated.model,
      normalizedText: text.normalized,
    });

    const validation = PhraseValidation.create({
      id: new PhraseId(randomUUID()),
      text,
      embedding: embeddingGenerated.embedding,
      model: embeddingGenerated.model,
      match,
      threshold: this.settings.threshold,
      ttlMinutes: this.settings.ttlMinutes,
      now: new Date(),
    });

    await this.validations.save(validation);

    return {
      validationId: validation.id,
      expiresAt: validation.expiresAt,
      requiresConfirmation: validation.requiresConfirmation,
      match,
    };
  }
}
