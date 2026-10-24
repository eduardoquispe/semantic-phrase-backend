import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { OpenAIEmbeddings } from '@langchain/openai';
import {
  EmbeddingGeneratorPort,
  GeneratedEmbedding,
} from '../../../application/ports/outbound/embedding-generator.port';
import { Embedding } from '../../../domain/value-objects/embedding.value-object';
import { PhraseModel } from '../../../domain/value-objects/phrase-model.value-object';
import { ConfigurationPort } from '../../../../../shared/application/ports/outbound/configuration.port';
import { AiUnavailableError } from '../errors/ai-unavailable.error';

@Injectable()
export class HuggingFaceEmbeddingAdapter
  extends EmbeddingGeneratorPort
  implements OnModuleInit
{
  private readonly logger = new Logger(HuggingFaceEmbeddingAdapter.name);
  private readonly embeddings: OpenAIEmbeddings;

  constructor(private readonly config: ConfigurationPort) {
    super();
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
    if (dimensions !== Embedding.DIMENSIONS) {
      throw new Error(
        `AI_EMBEDDING_DIMENSIONS must be ${Embedding.DIMENSIONS}`,
      );
    }
    try {
      await this.generate('Comprobación de inicio.');
    } catch {
      throw new AiUnavailableError();
    }
  }

  async generate(text: string): Promise<GeneratedEmbedding> {
    const startedAt = Date.now();
    try {
      const modelName = this.config.getOrThrow<string>('AI_MODEL');
      this.logger.log(
        `Generating embedding: model=${modelName} chars=${text.length}`,
      );
      const values = await this.embeddings.embedQuery(text);
      const preview = values
        .slice(0, 5)
        .map((value) => Number(value).toFixed(4))
        .join(', ');
      this.logger.log(
        `Embedding generated: dimensions=${values.length} preview=[${preview}, ...] took=${Date.now() - startedAt}ms`,
      );

      return {
        embedding: new Embedding(values),
        model: new PhraseModel(
          this.config.getOrThrow<string>('AI_MODEL'),
          this.config.getOrThrow<string>('AI_EMBEDDING_VERSION'),
        ),
      };
    } catch (error) {
      this.logger.error(
        `Embedding generation failed after ${Date.now() - startedAt}ms: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new AiUnavailableError();
    }
  }
}
