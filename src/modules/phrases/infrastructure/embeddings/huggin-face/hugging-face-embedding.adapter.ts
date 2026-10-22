import { Injectable, OnModuleInit } from '@nestjs/common';
import { OpenAIEmbeddings } from '@langchain/openai';
import {
  EmbeddingGeneratorPort,
  GeneratedEmbedding,
} from '../../../application/ports/outbound/embedding-generator.port';
import { Embedding } from '../../../domain/value-objects/embedding.value-object';
import { PhraseModel } from '../../../domain/value-objects/phrase-model.value-object';
import { ConfigService } from '@nestjs/config';
import { AiUnavailableError } from '../errors/ai-unavailable.error';

@Injectable()
export class HuggingFaceEmbeddingAdapter
  extends EmbeddingGeneratorPort
  implements OnModuleInit
{
  private readonly embeddings: OpenAIEmbeddings;

  constructor(private readonly config: ConfigService) {
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
    try {
      await this.generate('Comprobación de inicio.');
    } catch {
      throw new AiUnavailableError();
    }
  }

  async generate(text: string): Promise<GeneratedEmbedding> {
    try {
      const values = await this.embeddings.embedQuery(text);

      return {
        embedding: new Embedding(values),
        model: new PhraseModel(
          this.config.getOrThrow<string>('AI_MODEL'),
          this.config.getOrThrow<string>('AI_EMBEDDING_VERSION'),
        ),
      };
    } catch {
      throw new AiUnavailableError();
    }
  }
}
