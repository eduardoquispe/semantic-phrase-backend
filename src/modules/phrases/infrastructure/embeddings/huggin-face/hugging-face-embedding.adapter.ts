import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { OpenAIEmbeddings } from '@langchain/openai';
import {
  EmbeddingGeneratorPort,
  GeneratedEmbedding,
} from '../../../application/ports/outbound/embedding-generator.port';
import { EMBEDDING_DIMENSIONS } from '../../../domain/constants/embedding.constants';
import { Embedding } from '../../../domain/value-objects/embedding.value-object';
import { PhraseModel } from '../../../domain/value-objects/phrase-model.value-object';
import { ConfigurationPort } from '../../../../../shared/application/ports/outbound/configuration.port';
import { AiUnavailableError } from '../errors/ai-unavailable.error';

@Injectable()
export class HuggingFaceEmbeddingAdapter
  implements EmbeddingGeneratorPort, OnModuleInit
{
  private readonly logger = new Logger(HuggingFaceEmbeddingAdapter.name);
  private readonly embeddings: OpenAIEmbeddings;

  constructor(private readonly config: ConfigurationPort) {
    this.embeddings = new OpenAIEmbeddings({
      model: config.get<string>('AI_MODEL'),
      apiKey: '',
      maxRetries: 0,
      timeout: Number(config.get<string | number>('AI_INFERENCE_TIMEOUT_MS')),
      configuration: {
        baseURL: `${config.get<string>('AI_EMBEDDINGS_URL')?.replace(/\/+$/, '')}/v1`,
      },
    });
  }

  async onModuleInit(): Promise<void> {
    const dimensions = Number(
      this.config.getOrThrow<string | number>('AI_EMBEDDING_DIMENSIONS'),
    );
    if (dimensions !== EMBEDDING_DIMENSIONS) {
      throw new Error(
        `AI_EMBEDDING_DIMENSIONS must be ${EMBEDDING_DIMENSIONS}`,
      );
    }
    try {
      await this.generate('Comprobación de inicio.');
    } catch {
      throw new AiUnavailableError();
    }
  }

  async generate(text: string): Promise<GeneratedEmbedding> {
    try {
      const modelName = this.config.getOrThrow<string>('AI_MODEL');
      const embeddingVersion = this.config.getOrThrow<string>(
        'AI_EMBEDDING_VERSION',
      );

      this.logger.log(
        `Generating embedding: model=${modelName} chars=${text.length}`,
      );
      const values = await this.embeddings.embedQuery(text);

      this.logger.log(`Embedding generated: dimensions=${values.length}`);

      return {
        embedding: new Embedding(values),
        model: new PhraseModel(modelName, embeddingVersion),
      };
    } catch (error) {
      this.logger.error(
        `Embedding generation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new AiUnavailableError();
    }
  }
}
