import { PhraseId } from '../src/modules/phrases/domain/value-objects/phrase-id.value-object';
import { PhraseText } from '../src/modules/phrases/domain/value-objects/phrase-text.value-object';
import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { ConfigurationPort } from '../src/shared/application/ports/outbound/configuration.port';
import { ConfigurationStub } from './fixtures/configuration';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { teiConfig } from './fixtures/tei';
import { EmbeddingGeneratorPort } from '../src/modules/phrases/application/ports/outbound/embedding-generator.port';
import { PhraseRepositoryPort } from '../src/modules/phrases/application/ports/outbound/phrase-repository.port';
import { PhraseValidationRepositoryPort } from '../src/modules/phrases/application/ports/outbound/phrase-validation-repository.port';
import { PhraseValidation } from '../src/modules/phrases/domain/entities/phrase-validation.entity';
import { Phrase } from '../src/modules/phrases/domain/entities/phrase.entity';
import type { PhraseValidationProps } from '../src/modules/phrases/domain/types/phrase-validation-props.interface';
import { Embedding } from '../src/modules/phrases/domain/value-objects/embedding.value-object';
import { NormalizedPhraseText } from '../src/modules/phrases/domain/value-objects/normalized-phrase-text.value-object';
import { PhraseModel } from '../src/modules/phrases/domain/value-objects/phrase-model.value-object';
import { SimilarityScore } from '../src/modules/phrases/domain/value-objects/similarity-score.value-object';
import { DatabaseError } from '../src/shared/infrastructure/database/errors/database.error';

interface ValidationBody {
  data: { validationId: string };
}
interface CreatedBody {
  data: { id: string; text: string; createdAt: string };
}
interface ProblemBody {
  status: number;
  code: string;
  errors?: { field: string; messages: string[] }[];
}

function rebuild(
  previous: PhraseValidation,
  changes: Partial<PhraseValidationProps>,
): PhraseValidation {
  return PhraseValidation.reconstitute({
    id: new PhraseId(previous.id),
    text: previous.text,
    embedding: previous.embedding,
    model: previous.model,
    match: previous.match,
    normalizedText: new NormalizedPhraseText(previous.normalizedText),
    requiresConfirmation: previous.requiresConfirmation,
    consumedAt: previous.consumedAt,
    createdAt: previous.createdAt,
    expiresAt: previous.expiresAt,
    ...changes,
  });
}

describe('phrase registration HTTP flow', () => {
  let app: INestApplication<App>;
  let stored: Map<string, PhraseValidation>;
  let phrases: Phrase[];
  const model = new PhraseModel(
    teiConfig.AI_MODEL,
    teiConfig.AI_EMBEDDING_VERSION,
  );
  const embedding = new Embedding([1, ...Array<number>(383).fill(0)]);
  const generator = { generate: jest.fn() };
  const repository = {
    list: jest.fn(),
    findValidationMatch: jest.fn(),
    save: jest.fn(),
    softDelete: jest.fn(),
  };
  const validations = {
    save: jest.fn(),
    update: jest.fn(),
    findById: jest.fn(),
  };
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(ConfigurationPort)
      .useValue(
        new ConfigurationStub({
          ...teiConfig,
          DATABASE_URL:
            'postgresql://semantic:semantic@localhost:5432/semantic_phrase',
        }),
      )
      .overrideProvider(EmbeddingGeneratorPort)
      .useValue(generator)
      .overrideProvider(PhraseRepositoryPort)
      .useValue(repository)
      .overrideProvider(PhraseValidationRepositoryPort)
      .useValue(validations)
      .compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(() => {
    jest.resetAllMocks();
    stored = new Map();
    phrases = [];
    generator.generate.mockResolvedValue({ model, embedding });
    repository.findValidationMatch.mockResolvedValue(null);
    repository.list.mockImplementation(() =>
      Promise.resolve({ data: phrases, total: phrases.length }),
    );
    validations.save.mockImplementation((v: PhraseValidation) => {
      stored.set(v.id, v);
      return Promise.resolve();
    });
    validations.update.mockImplementation(
      (id: string, changes: Partial<PhraseValidationProps>) => {
        stored.set(id, rebuild(stored.get(id)!, changes));
        return Promise.resolve();
      },
    );
    validations.findById.mockImplementation((id: string) =>
      Promise.resolve(stored.get(id) ?? null),
    );
    repository.save.mockImplementation((phrase: Phrase) => {
      phrases.push(phrase);
      return Promise.resolve();
    });
  });
  const post = (body: object, query = '') =>
    request(app.getHttpServer())
      .post('/api/v1/phrases' + query)
      .send(body);
  async function validate(text = ' Hola ') {
    const result = await request(app.getHttpServer())
      .post('/api/v1/phrase-validations')
      .send({ text })
      .expect(201);
    return (result.body as ValidationBody).data.validationId;
  }
  function expectProblem(
    response: request.Response,
    status: number,
    code: string,
  ) {
    expect(response.headers['content-type']).toMatch(
      /application\/problem\+json/,
    );
    expect(response.body).toMatchObject({ status, code });
    expect(JSON.stringify(response.body)).not.toMatch(
      /secret|stack|timestamp|traceId|"type"/,
    );
    const body = response.body as ProblemBody;
    for (const error of body.errors ?? []) {
      expect(typeof error.field).toBe('string');
      expect(error.messages.length).toBeGreaterThan(0);
    }
  }
  it.each([undefined, false, true])(
    'validates, registers and lists without alert (%s)',
    async (confirmed) => {
      const validationId = await validate();
      expect(phrases).toHaveLength(0);
      const response = await post({
        text: ' Hola ',
        validationId,
        ...(confirmed === undefined ? {} : { confirmed }),
      }).expect(201);
      const created = response.body as CreatedBody;
      expect(created).toEqual({
        data: {
          id: phrases[0].id,
          text: ' Hola ',
          createdAt: phrases[0].createdAt.toISOString(),
        },
      });
      expect(created.data.id).toMatch(
        /^[\da-f]{8}-[\da-f]{4}-4[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/,
      );
      const list = await request(app.getHttpServer())
        .get('/api/v1/phrases')
        .expect(200);
      expect(list.body).toMatchObject({ data: [created.data] });
      expect(generator.generate).toHaveBeenCalledTimes(1);
      expect(repository.findValidationMatch).toHaveBeenCalledTimes(1);
    },
  );
  it('registers a candidate below the threshold', async () => {
    repository.findValidationMatch.mockResolvedValue({
      type: 'vector',
      phrase: { id: randomUUID(), text: 'candidate' },
      similarityScore: new SimilarityScore(0.4),
    });
    const validationId = await validate();
    await post({ text: ' Hola ', validationId }).expect(201);
  });
  it.each(['textual_exact', 'vector'])(
    'requires confirmation for stored %s alert and allows retry',
    async (type) => {
      repository.findValidationMatch.mockResolvedValue({
        type,
        phrase: { id: randomUUID(), text: 'Hola' },
        similarityScore: type === 'vector' ? new SimilarityScore(0.9) : null,
      });
      const validationId = await validate();
      expect(phrases).toHaveLength(0);
      expect(stored.get(validationId)?.consumedAt).toBeNull();
      for (const confirmed of [undefined, false]) {
        const response = await post({
          text: ' Hola ',
          validationId,
          confirmed,
        }).expect(409);
        expectProblem(response, 409, 'CONFIRMATION_REQUIRED');
        expect(stored.get(validationId)?.consumedAt).toBeNull();
        expect(phrases).toHaveLength(0);
      }
      await post({ text: ' Hola ', validationId, confirmed: true }).expect(201);
    },
  );
  it.each([
    ['missing', undefined],
    ['malformed', 'bad'],
    ['non-v4', '550e8400-e29b-11d4-a716-446655440000'],
    ['unknown', '550e8400-e29b-41d4-a716-446655440000'],
  ])('rejects %s reference', async (_name, validationId) => {
    expectProblem(
      await post({ text: 'Hola', validationId, confirmed: true }).expect(400),
      400,
      'INVALID_VALIDATION_ID',
    );
    expect(phrases).toHaveLength(0);
  });
  it.each([
    [
      'text',
      { text: PhraseText.forValidation('hola') },
      400,
      'PHRASE_MISMATCH',
    ],
    ['expired', { expiresAt: new Date(0) }, 409, 'VALIDATION_EXPIRED'],
    ['consumed', { consumedAt: new Date(0) }, 409, 'VALIDATION_ALREADY_USED'],
    [
      'model',
      { model: new PhraseModel('other', model.version) },
      409,
      'INCOMPATIBLE_MODEL',
    ],
    [
      'version',
      { model: new PhraseModel(model.id, 'other') },
      409,
      'INCOMPATIBLE_MODEL',
    ],
  ] as const)(
    'rejects inapplicable %s without modifying state',
    async (_name, change, status, code) => {
      const validationId = await validate();
      const previous = stored.get(validationId)!;
      const state = rebuild(previous, change);
      stored.set(validationId, state);
      expectProblem(
        await post({ text: ' Hola ', validationId, confirmed: true }).expect(
          status,
        ),
        status,
        code,
      );
      expect(stored.get(validationId)).toEqual(state);
      expect(phrases).toHaveLength(0);
      expect(repository.save).not.toHaveBeenCalled();
    },
  );
  it.each([
    { confirmed: 'true' },
    { confirmed: 1 },
    { confirmed: null },
    { requiresConfirmation: false },
    { extra: 1 },
    { text: undefined },
    { text: null },
    { text: 42 },
    { text: '' },
    { text: '  ' },
    { text: '😀'.repeat(281) },
    { text: ` ${'a'.repeat(279)} ` },
    { text: 'a\tb' },
    { text: 'a\nb' },
    { text: 'a\rb' },
    { text: 'a\u0085b' },
  ])('rejects invalid body %j without consuming', async (change) => {
    const validationId = await validate();
    expectProblem(
      await post({ text: ' Hola ', validationId, ...change }).expect(400),
      400,
      'VALIDATION_ERROR',
    );
    expect(stored.get(validationId)?.consumedAt).toBeNull();
    expect(phrases).toHaveLength(0);
  });
  it('ignores undeclared query parameters', async () => {
    const validationId = await validate();
    await post({ text: ' Hola ', validationId }, '?extra=1').expect(201);
    expect(stored.get(validationId)?.consumedAt).not.toBeNull();
  });
  it.each(['!!!', '😀'.repeat(280), ` ${'a'.repeat(278)} `])(
    'preserves admissible originals',
    async (text) => {
      const validationId = await validate(text);
      const result = await post({ text, validationId }).expect(201);
      expect((result.body as CreatedBody).data.text).toBe(text);
    },
  );
  it.each([
    [
      'read',
      new DatabaseError(new Error('secret SQL credentials')),
      'DATABASE_ERROR',
    ],
    [
      'insert',
      new DatabaseError(new Error('secret SQL credentials')),
      'DATABASE_ERROR',
    ],
    ['insert', new Error('secret SQL credentials'), 'INTERNAL_ERROR'],
  ] as const)(
    'handles technical failure safely during %s',
    async (stage, error, code) => {
      const validationId = await validate();
      const operation =
        stage === 'read' ? validations.findById : repository.save;
      operation.mockRejectedValueOnce(error);
      expectProblem(
        await post({ text: ' Hola ', validationId }).expect(500),
        500,
        code,
      );
      expect(stored.get(validationId)?.consumedAt).toBeNull();
      expect(phrases).toHaveLength(0);
    },
  );
  it('keeps the inserted phrase when updating consumption fails', async () => {
    const validationId = await validate();
    validations.update.mockRejectedValueOnce(
      new DatabaseError(new Error('consumption failed')),
    );
    expectProblem(
      await post({ text: ' Hola ', validationId }).expect(500),
      500,
      'DATABASE_ERROR',
    );
    expect(phrases).toHaveLength(1);
    expect(stored.get(validationId)?.consumedAt).toBeNull();
    await post({ text: ' Hola ', validationId }).expect(201);
    expect(phrases).toHaveLength(2);
  });
  it('rejects resend after success and permits independent duplicate validations', async () => {
    const validationId = await validate();
    await post({ text: ' Hola ', validationId }).expect(201);
    const consumedAt = stored.get(validationId)?.consumedAt;
    expectProblem(
      await post({ text: ' Hola ', validationId }).expect(409),
      409,
      'VALIDATION_ALREADY_USED',
    );
    expect(stored.get(validationId)?.consumedAt).toEqual(consumedAt);
    const second = await validate();
    await post({
      text: ' Hola ',
      validationId: second,
      confirmed: true,
    }).expect(201);
    expect(phrases).toHaveLength(2);
  });
  it('accepts more than 60 registrations without volume throttling', async () => {
    for (let i = 0; i < 61; i++) {
      const validationId = await validate();
      await post({ text: ' Hola ', validationId }).expect(201);
    }
    expect(phrases).toHaveLength(61);
  });
});
