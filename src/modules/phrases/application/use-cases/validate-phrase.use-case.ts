import { ConfigurationPort } from '../../../../shared/application/ports/outbound/configuration.port';
import { PhraseValidationMatch } from '../../domain/value-objects/phrase-validation-match.value-object';
import { Injectable } from '@nestjs/common';
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
          0.8538613695045911,
      ),
      ttlMinutes: Number(
        config.get<string | number>('PHRASE_VALIDATION_TTL_MINUTES') ?? 15,
      ),
    };
  }

  async execute(input: ValidatePhraseInput): Promise<ValidatePhraseResult> {
    const text = PhraseText.forValidation(input.text);

    const embeddingGenerated = await this.generatorEmbedding.generate(
      text.value,
    );
    const result = await this.phrasesRepository.findValidationMatch({
      embedding: embeddingGenerated.embedding,
      model: embeddingGenerated.model,
      normalizedText: text.normalized,
    });

    const match = result ? new PhraseValidationMatch(result) : null;
    const now = Math.floor(Date.now() / 1000) * 1000;

    const validation = new PhraseValidation({
      id: new PhraseId(randomUUID()),
      text,
      embedding: embeddingGenerated.embedding,
      model: embeddingGenerated.model,
      match,
      normalizedText: text.normalized,
      requiresConfirmation:
        match?.requiresConfirmation(this.settings.threshold) ?? false,
      consumedAt: null,
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
