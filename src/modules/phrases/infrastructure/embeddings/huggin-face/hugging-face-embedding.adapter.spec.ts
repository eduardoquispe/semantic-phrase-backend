import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { OpenAIEmbeddings } from '@langchain/openai';
import { HuggingFaceEmbeddingAdapter } from './hugging-face-embedding.adapter';
import { AiUnavailableError } from '../errors/ai-unavailable.error';
import { teiConfig, teiVector } from '../../../../../../test/fixtures/tei';

jest.mock('@langchain/openai', () => ({ OpenAIEmbeddings: jest.fn() }));

describe('HuggingFaceEmbeddingAdapter', () => {
  const embedQuery = jest.fn();
  const config = new ConfigService(teiConfig);
  let adapter: HuggingFaceEmbeddingAdapter;

  beforeEach(() => {
    jest.clearAllMocks();
    jest
      .mocked(OpenAIEmbeddings)
      .mockImplementation(
        () => ({ embedQuery }) as unknown as OpenAIEmbeddings,
      );
    embedQuery.mockResolvedValue(teiVector);
    adapter = new HuggingFaceEmbeddingAdapter(config);
  });

  it('configures LangChain for TEI without retries and preserves the base path', () => {
    expect(OpenAIEmbeddings).toHaveBeenCalledWith({
      model: teiConfig.AI_MODEL,
      apiKey: '',
      maxRetries: 0,
      timeout: teiConfig.AI_INFERENCE_TIMEOUT_MS,
      configuration: { baseURL: 'http://tei/base/v1' },
    });
  });

  it('uses another destination when the configured URL changes', () => {
    new HuggingFaceEmbeddingAdapter(
      new ConfigService({
        ...teiConfig,
        AI_EMBEDDINGS_URL: 'https://other/custom/',
      }),
    );
    expect(OpenAIEmbeddings).toHaveBeenLastCalledWith(
      expect.objectContaining({
        configuration: { baseURL: 'https://other/custom/v1' },
      }),
    );
  });

  it('performs startup inference before Nest initialization succeeds', async () => {
    const module = await Test.createTestingModule({
      providers: [
        HuggingFaceEmbeddingAdapter,
        { provide: ConfigService, useValue: config },
      ],
    }).compile();
    await module.init();
    expect(embedQuery).toHaveBeenCalledWith('Comprobación de inicio.');
    await module.close();
  });

  it('rejects startup when inference fails', async () => {
    embedQuery.mockRejectedValueOnce(new Error('private service error'));
    await expect(adapter.onModuleInit()).rejects.toEqual(
      new AiUnavailableError(),
    );
  });

  it('returns domain values with the configured model and version', async () => {
    const result = await adapter.generate(' Hola ');
    expect(embedQuery).toHaveBeenCalledWith(' Hola ');
    expect(result.embedding.values).toEqual(teiVector);
    expect(result.model.id).toBe(teiConfig.AI_MODEL);
    expect(result.model.version).toBe(teiConfig.AI_EMBEDDING_VERSION);
  });

  it.each(
    [
      [],
      Array<number>(383).fill(1),
      Array<number>(385).fill(1),
      [NaN, ...Array<number>(383).fill(0)],
      ['1', ...Array<number>(383).fill(0)],
    ].map((vector) => [vector]),
  )(
    'translates invalid domain embeddings into a safe error %#',
    async (vector) => {
      embedQuery.mockResolvedValueOnce(vector);
      await expect(adapter.generate('Hola')).rejects.toEqual(
        new AiUnavailableError(),
      );
    },
  );

  it('translates SDK errors without retrying and allows a new manual attempt', async () => {
    embedQuery.mockRejectedValueOnce(new Error('private network error'));
    await expect(adapter.generate('Hola')).rejects.toEqual(
      new AiUnavailableError(),
    );
    expect(embedQuery).toHaveBeenCalledTimes(1);
    await expect(adapter.generate('Hola')).resolves.toHaveProperty('embedding');
    expect(embedQuery).toHaveBeenCalledTimes(2);
  });
});
