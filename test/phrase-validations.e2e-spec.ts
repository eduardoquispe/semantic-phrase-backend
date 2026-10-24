import { teiConfig, teiResponse } from './fixtures/tei';
import { HuggingFaceEmbeddingAdapter } from '../src/modules/phrases/infrastructure/embeddings/huggin-face/hugging-face-embedding.adapter';
import { IncompatiblePhraseCollectionError } from '../src/modules/phrases/application/errors/incompatible-phrase-collection.error';
import { AiUnavailableError } from '../src/modules/phrases/infrastructure/embeddings/errors/ai-unavailable.error';
import { DatabaseError } from '../src/shared/infrastructure/database/errors/database.error';
import { INestApplication } from '@nestjs/common';
import { ConfigurationPort } from '../src/shared/application/ports/outbound/configuration.port';
import { ConfigurationStub } from './fixtures/configuration';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { configureApp } from '../src/configure-app';
import { PhraseValidationsController } from '../src/modules/phrases/infrastructure/http/controllers/phrase-validations.controller';
import { ValidatePhraseUseCase } from '../src/modules/phrases/application/use-cases/validate-phrase.use-case';
import { ValidatePhrasePort } from '../src/modules/phrases/application/ports/inbound/validate-phrase.port';
import { EmbeddingGeneratorPort } from '../src/modules/phrases/application/ports/outbound/embedding-generator.port';
import { PhraseRepositoryPort } from '../src/modules/phrases/application/ports/outbound/phrase-repository.port';
import { PhraseValidationRepositoryPort } from '../src/modules/phrases/application/ports/outbound/phrase-validation-repository.port';
import { PhraseValidation } from '../src/modules/phrases/domain/entities/phrase-validation.entity';
import { Embedding } from '../src/modules/phrases/domain/value-objects/embedding.value-object';
import { PhraseModel } from '../src/modules/phrases/domain/value-objects/phrase-model.value-object';
import { SimilarityScore } from '../src/modules/phrases/domain/value-objects/similarity-score.value-object';

interface ValidationBody {
  data: {
    validationId: string;
    expiresAt: string;
    requiresConfirmation: boolean;
    match: null | {
      type: string;
      phrase: { id: string; text: string };
      similarityScore: number | null;
    };
  };
}
describe('POST /api/v1/phrase-validations', () => {
  let app: INestApplication<App>;
  let saved: PhraseValidation[] = [];
  const generator = { generate: jest.fn() };
  const repository = {
    list: jest.fn(),
    findValidationMatch: jest.fn(),
    save: jest.fn(),
    softDelete: jest.fn(),
  };
  const validations = { save: jest.fn() };
  const phrase = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    text: 'Me gusta viajar a Cusco',
  };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [PhraseValidationsController],
      providers: [
        ValidatePhraseUseCase,
        { provide: ValidatePhrasePort, useExisting: ValidatePhraseUseCase },
        { provide: ConfigurationPort, useValue: new ConfigurationStub() },
        { provide: EmbeddingGeneratorPort, useValue: generator },
        { provide: PhraseRepositoryPort, useValue: repository },
        { provide: PhraseValidationRepositoryPort, useValue: validations },
      ],
    }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.resetAllMocks();
    saved = [];
    generator.generate.mockResolvedValue({
      embedding: new Embedding([1, ...Array<number>(383).fill(0)]),
      model: new PhraseModel(
        teiConfig.AI_MODEL,
        teiConfig.AI_EMBEDDING_VERSION,
      ),
    });
    repository.findValidationMatch.mockResolvedValue(null);
    validations.save.mockImplementation((v: PhraseValidation) => {
      saved.push(v);
      return Promise.resolve();
    });
  });
  const post = (body: unknown = { text: ' Hola ' }, query = '') =>
    request(app.getHttpServer())
      .post('/api/v1/phrase-validations' + query)
      .send(body as object);
  it.each(['textual_exact', 'vector'])(
    'returns exact public %s shape with a persisted receipt',
    async (type) => {
      const score = type === 'vector' ? 0.4 : null;
      repository.findValidationMatch.mockResolvedValue({
        type,
        phrase,
        similarityScore: score === null ? null : new SimilarityScore(score),
      });
      const response = await post().expect(201);
      const body = response.body as ValidationBody;
      expect(body).toEqual({
        data: {
          validationId: saved[0].id,
          expiresAt: saved[0].expiresAt.toISOString(),
          requiresConfirmation: type === 'textual_exact',
          match: { type, phrase, similarityScore: score },
        },
      });
      expect(saved).toHaveLength(1);
      expect(saved[0].text.value).toBe(' Hola ');
      expect(saved[0].consumedAt).toBeNull();
      expect(repository.list).not.toHaveBeenCalled();
    },
  );
  it('returns empty corpus success with exactly one temporary validation', async () => {
    const response = await post().expect(201);
    const body = response.body as ValidationBody;
    expect(body).toEqual({
      data: {
        validationId: saved[0].id,
        expiresAt: saved[0].expiresAt.toISOString(),
        requiresConfirmation: false,
        match: null,
      },
    });
    expect(typeof body.data.validationId).toBe('string');
    expect(body.data.validationId.length).toBeGreaterThan(0);
    expect(saved).toHaveLength(1);
    expect(repository.list).not.toHaveBeenCalled();
    expect(generator.generate).toHaveBeenCalledTimes(1);
    expect(validations.save).toHaveBeenCalledTimes(1);
  });
  it('treats a collection with only deleted phrases as empty (no 500)', async () => {
    // el repositorio filtra status = 1: sin activas devuelve null, no incompatible
    repository.findValidationMatch.mockResolvedValueOnce(null);
    const response = await post().expect(201);
    expect((response.body as ValidationBody).data.match).toBeNull();
    expect(saved).toHaveLength(1);
  });
  it.each([
    {},
    { text: null },
    { text: 42 },
    { text: [] },
    { text: {} },
    { text: '' },
    { text: '  ' },
    { text: '😀'.repeat(281) },
    { text: ` ${'a'.repeat(279)} ` },
    { text: 'a\tb' },
    { text: 'a\nb' },
    { text: 'a\rb' },
    { text: 'a\u0085b' },
    { text: 'Hola', extra: 1 },
  ])('rejects invalid input before inference', async (input) => {
    const response = await post(input).expect(400);
    expect(response.headers['content-type']).toMatch(
      /application\/problem\+json/,
    );
    expect(response.body).toMatchObject({
      status: 400,
      code: 'VALIDATION_ERROR',
    });
    const problem = response.body as {
      errors: { field: string; messages: string[] }[];
    };
    expect(problem.errors.length).toBeGreaterThan(0);
    for (const error of problem.errors) {
      expect(typeof error.field).toBe('string');
      expect(error.messages.length).toBeGreaterThan(0);
      expect(
        error.messages.every((message) => typeof message === 'string'),
      ).toBe(true);
    }
    expect(generator.generate).not.toHaveBeenCalled();
    expect(saved).toHaveLength(0);
  });
  it('rejects unknown query before inference', async () => {
    await post({ text: 'Hola' }, '?extra=1').expect(400);
    expect(generator.generate).not.toHaveBeenCalled();
  });
  it.each(['!!!', '😀'.repeat(280), ` ${'a'.repeat(278)} `])(
    'accepts punctuation, astral and boundary originals',
    async (text) => {
      await post({ text }).expect(201);
      expect(generator.generate).toHaveBeenCalledWith(text);
      expect(saved[0].text.value).toBe(text);
    },
  );
  it.each([
    ['generate', new AiUnavailableError(), 503, 'AI_UNAVAILABLE'],
    [
      'find',
      new DatabaseError(new Error('secret SQL credentials')),
      500,
      'DATABASE_ERROR',
    ],
    [
      'save',
      new DatabaseError(new Error('secret SQL credentials')),
      500,
      'DATABASE_ERROR',
    ],
    ['find', new Error('secret SQL credentials'), 500, 'INTERNAL_ERROR'],
    ['save', new Error('secret SQL credentials'), 500, 'INTERNAL_ERROR'],
  ])('returns safe failure for %s', async (stage, error, status, code) => {
    ({
      generate: generator.generate,
      find: repository.findValidationMatch,
      save: validations.save,
    })[stage]!.mockRejectedValueOnce(error);
    const response = await post().expect(status);
    expect(response.headers['content-type']).toMatch(
      /application\/problem\+json/,
    );
    expect(response.body).toMatchObject({ status, code });
    expect(JSON.stringify(response.body)).not.toMatch(
      /secret|credentials|SQL|stack|validationId/,
    );
    expect(saved).toHaveLength(0);
  });
  it('returns 500 for incompatible corpus after inference with no temporary write', async () => {
    repository.findValidationMatch.mockRejectedValue(
      new IncompatiblePhraseCollectionError(),
    );
    const response = await post().expect(500);
    expect(response.body).toMatchObject({
      code: 'INTERNAL_ERROR',
    });
    expect(generator.generate).toHaveBeenCalledTimes(1);
    expect(saved).toHaveLength(0);
    expect(validations.save).not.toHaveBeenCalled();
  });
  it('applies no global throttle', async () => {
    for (let i = 0; i < 61; i++) await post().expect(201);
    expect(saved).toHaveLength(61);
  });
  it.each(['textual_exact', 'vector', 'empty'])(
    'returns saved %s UUID and exact expiry without a JWT secret',
    async (type) => {
      repository.findValidationMatch.mockResolvedValue(
        type === 'empty'
          ? null
          : {
              type,
              phrase,
              similarityScore:
                type === 'vector' ? new SimilarityScore(0.9) : null,
            },
      );
      const response = await post().expect(201);
      const body = response.body as ValidationBody;
      const v = saved[0];
      expect(body.data.validationId).toBe(v.id);
      expect(body.data.validationId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
      expect(v.expiresAt.getTime() - v.createdAt.getTime()).toBe(
        15 * 60 * 1000,
      );
      expect(v.createdAt.getTime() % 1000).toBe(0);
      expect(new Date(body.data.expiresAt).getTime()).toBe(
        v.expiresAt.getTime(),
      );
      expect(v.isExpired(new Date(v.expiresAt.getTime() - 1))).toBe(false);
      expect(v.isExpired(v.expiresAt)).toBe(true);
      expect(v.consumedAt).toBeNull();
      const next = await post().expect(201);
      expect((next.body as ValidationBody).data.validationId).toBe(saved[1].id);
      expect(saved[1].id).not.toBe(v.id);
      expect(saved[0].expiresAt).toEqual(v.expiresAt);
      expect(saved[0].consumedAt).toBeNull();
    },
  );
});

describe('Validation with OpenAIEmbeddings and simulated TEI', () => {
  let app: INestApplication<App>;
  let transport: jest.SpyInstance;
  const config = new ConfigurationStub(teiConfig);
  const repository = {
    list: jest.fn(),
    findValidationMatch: jest.fn(),
    save: jest.fn(),
    softDelete: jest.fn(),
  };
  const validations = { save: jest.fn() };

  beforeAll(async () => {
    transport = jest.spyOn(globalThis, 'fetch').mockImplementation(() =>
      Promise.resolve(
        new Response(JSON.stringify(teiResponse()), {
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );
    const module = await Test.createTestingModule({
      controllers: [PhraseValidationsController],
      providers: [
        ValidatePhraseUseCase,
        { provide: ValidatePhrasePort, useExisting: ValidatePhraseUseCase },
        { provide: ConfigurationPort, useValue: config },
        {
          provide: EmbeddingGeneratorPort,
          useClass: HuggingFaceEmbeddingAdapter,
        },
        { provide: PhraseRepositoryPort, useValue: repository },
        { provide: PhraseValidationRepositoryPort, useValue: validations },
      ],
    }).compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
  });
  afterAll(async () => {
    await app.close();
    transport.mockRestore();
  });
  beforeEach(() => {
    jest.clearAllMocks();
    repository.findValidationMatch.mockResolvedValue(null);
  });

  it('calls the configured TEI endpoint through the SDK and persists its decoded vector', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/phrase-validations')
      .send({ text: ' Hola ' })
      .expect(201);
    const [url, options] = transport.mock.calls[0] as [string, RequestInit];
    expect(String(url)).toBe('http://tei/base/v1/embeddings');
    expect(JSON.parse(options.body as string)).toEqual({
      model: teiConfig.AI_MODEL,
      input: ' Hola ',
      encoding_format: 'base64',
    });
    const calls = validations.save.mock.calls as [PhraseValidation][];
    const saved = calls[0][0];
    expect(saved.embedding.values).toHaveLength(384);
    expect(saved.embedding.values[0]).toBe(1);
    expect(saved.model.version).toBe(teiConfig.AI_EMBEDDING_VERSION);
  });

  it.each(['network', 'timeout', '429', '500', 'json', 'shape', 'vector'])(
    'returns safe 503 and stops effects after %s',
    async (failure) => {
      if (failure === 'timeout')
        transport.mockImplementationOnce(
          (_url, options: RequestInit) =>
            new Promise((_resolve, reject) => {
              options.signal!.addEventListener(
                'abort',
                () => reject(new Error('SDK timeout')),
                { once: true },
              );
            }),
        );
      else if (failure === 'network')
        transport.mockRejectedValueOnce(new Error('private service address'));
      else if (['429', '500'].includes(failure))
        transport.mockResolvedValueOnce(
          new Response(null, { status: Number(failure) }),
        );
      else
        transport.mockResolvedValueOnce(
          new Response(
            failure === 'json'
              ? 'bad JSON'
              : JSON.stringify(failure === 'shape' ? {} : teiResponse([])),
            { headers: { 'Content-Type': 'application/json' } },
          ),
        );
      const response = await request(app.getHttpServer())
        .post('/api/v1/phrase-validations')
        .send({ text: 'Hola' })
        .expect(503);
      expect(response.headers['content-type']).toMatch(
        /application\/problem\+json/,
      );
      expect(response.body).toMatchObject({
        status: 503,
        code: 'AI_UNAVAILABLE',
      });
      expect(JSON.stringify(response.body)).not.toMatch(
        /private|stack|validationId/,
      );
      expect(transport).toHaveBeenCalledTimes(1);
      expect(repository.findValidationMatch).not.toHaveBeenCalled();
      expect(validations.save).not.toHaveBeenCalled();
    },
  );
});
