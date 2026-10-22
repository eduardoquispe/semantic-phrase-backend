import { teiConfig } from './fixtures/tei';
import { EmbeddingGeneratorPort } from '../src/modules/phrases/application/ports/outbound/embedding-generator.port';
import { ConfigurationPort } from '../src/shared/application/ports/outbound/configuration.port';
import { ConfigurationStub } from './fixtures/configuration';
import {
  INestApplication,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { DatabaseError } from '../src/shared/infrastructure/database/errors/database.error';
import { PhraseRepositoryPort } from '../src/modules/phrases/application/ports/outbound/phrase-repository.port';
import { ListPhrasesResponseDto } from '../src/modules/phrases/infrastructure/http/dtos/list-phrases-response.dto';
import { Phrase } from '../src/modules/phrases/domain/entities/phrase.entity';
import { PhraseId } from '../src/modules/phrases/domain/value-objects/phrase-id.value-object';
import { PhraseText } from '../src/modules/phrases/domain/value-objects/phrase-text.value-object';
import { Embedding } from '../src/modules/phrases/domain/value-objects/embedding.value-object';
import { InvalidPhraseError } from '../src/modules/phrases/domain/errors/invalid-phrase.error';
import { InvalidPhraseTextError } from '../src/modules/phrases/domain/errors/invalid-phrase-text.error';
import { App } from 'supertest/types';
import { InvalidEmbeddingError } from '../src/modules/phrases/domain/errors/invalid-embedding.error';

interface ProblemBody {
  title: string;
  status: number;
  detail: string;
  code: string;
  errors?: { field: string; messages: string[] }[];
}

process.env.DATABASE_URL ??=
  'postgresql://semantic:semantic@localhost:5432/semantic_phrase';

describe('GET /api/v1/phrases', () => {
  let app: INestApplication<App>;
  const repository = {
    list: jest.fn(),
    findValidationMatch: jest.fn(),
    save: jest.fn(),
  };
  let rows: Phrase[] = [];

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PhraseRepositoryPort)
      .useValue(repository)
      .overrideProvider(ConfigurationPort)
      .useValue(
        new ConfigurationStub({
          ...teiConfig,
          DATABASE_URL: process.env.DATABASE_URL,
        }),
      )
      .overrideProvider(EmbeddingGeneratorPort)
      .useValue({ generate: jest.fn() })
      .compile();
    app = module.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => jest.restoreAllMocks());

  beforeEach(() => {
    rows = [];
    repository.list.mockReset();
    repository.list.mockImplementation((page: number, limit: number) =>
      Promise.resolve({
        data: rows.slice((page - 1) * limit, page * limit),
        total: rows.length,
      }),
    );
  });

  function seed(count: number) {
    rows = Array.from(
      { length: count },
      (_, i) =>
        new Phrase({
          id: new PhraseId(
            `${String(count - i).padStart(8, '0')}-0000-4000-8000-000000000000`,
          ),
          text: new PhraseText(`Phrase ${i}`),
          normalizedText: `phrase ${i}`,
          embedding: new Embedding(Array<number>(384).fill(0.25)),
          modelId: 'MiniLM',
          modelVersion: 'revision-1',
          createdAt: new Date(Date.UTC(2026, 9, 21, 0, 0, count - i)),
        }),
    );
  }

  it('lists historical texts of 281–500 code points', async () => {
    seed(1);
    const original = rows[0];
    for (const size of [281, 500]) {
      rows = [
        new Phrase({
          id: new PhraseId(original.id),
          text: new PhraseText('😀'.repeat(size)),
          normalizedText: '😀'.repeat(size),
          embedding: original.embedding,
          modelId: original.modelId,
          modelVersion: original.modelVersion,
          createdAt: original.createdAt,
        }),
      ];
      const response = await request(app.getHttpServer())
        .get('/api/v1/phrases')
        .expect(200);
      expect((response.body as ListPhrasesResponseDto).data[0].text).toBe(
        '😀'.repeat(size),
      );
    }
  });

  it('does not expose the removed starter route', async () => {
    await request(app.getHttpServer()).get('/').expect(404);
  });

  it.each([0, 1, 20, 21])(
    'returns a public first page for %i rows',
    async (count) => {
      seed(count);
      const response = await request(app.getHttpServer())
        .get('/api/v1/phrases')
        .expect(200);
      const body = response.body as ListPhrasesResponseDto;
      expect(body.meta).toEqual({
        page: 1,
        limit: 20,
        total: count,
        totalPages: Math.ceil(count / 20),
      });
      expect(body.data).toEqual(
        rows.slice(0, 20).map((row) => ({
          id: row.id,
          text: row.text.value,
          createdAt: row.createdAt.toISOString(),
        })),
      );
      for (const item of body.data)
        expect(Object.keys(item).sort()).toEqual(['createdAt', 'id', 'text']);
    },
  );

  it('paginates 45 rows and preserves totals past the last page', async () => {
    seed(45);
    for (const [page, size] of [
      [1, 20],
      [2, 20],
      [3, 5],
      [4, 0],
    ]) {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/phrases?page=${page}`)
        .expect(200);
      const body = response.body as ListPhrasesResponseDto;
      expect(body.data).toEqual(
        rows.slice((page - 1) * 20, page * 20).map((row) => ({
          id: row.id,
          text: row.text.value,
          createdAt: row.createdAt.toISOString(),
        })),
      );
      expect(body.data).toHaveLength(size);
      expect(body.meta).toEqual({
        page,
        limit: 20,
        total: 45,
        totalPages: 3,
      });
    }
    const custom = await request(app.getHttpServer())
      .get('/api/v1/phrases?page=2&limit=10')
      .expect(200);
    const customBody = custom.body as ListPhrasesResponseDto;
    expect(customBody.data).toEqual(
      rows.slice(10, 20).map((row) => ({
        id: row.id,
        text: row.text.value,
        createdAt: row.createdAt.toISOString(),
      })),
    );
    expect(customBody.meta).toEqual({
      page: 2,
      limit: 10,
      total: 45,
      totalPages: 5,
    });
  });

  it('preserves descending ID order when creation dates tie', async () => {
    seed(2);
    rows[1] = new Phrase({
      id: new PhraseId(rows[1].id),
      text: rows[1].text,
      normalizedText: rows[1].normalizedText,
      embedding: rows[1].embedding,
      modelId: rows[1].modelId,
      modelVersion: rows[1].modelVersion,
      createdAt: rows[0].createdAt,
    });
    const response = await request(app.getHttpServer())
      .get('/api/v1/phrases')
      .expect(200);
    const body = response.body as ListPhrasesResponseDto;
    expect(body.data.map((row) => row.id)).toEqual(rows.map((row) => row.id));
    expect(body.data[0].id > body.data[1].id).toBe(true);
  });

  it.each([
    'page=0',
    'limit=101',
    'page=1.5',
    'page=',
    'page=-1',
    'page=1e-2',
    'page=Infinity',
    'unexpected=1',
    'page=1&page=2',
    'limit=1&limit=2',
  ])('rejects %s', async (query) => {
    const response = await request(app.getHttpServer())
      .get(`/api/v1/phrases?${query}`)
      .expect(400);
    const body = response.body as ProblemBody;
    expect(response.headers['content-type']).toMatch(
      /application\/problem\+json/,
    );
    expect(body.title).toBe('Bad Request');
    expect(body.status).toBe(400);
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(typeof body.detail).toBe('string');
    expect(body.errors?.length).toBeGreaterThan(0);
    expect(typeof body.errors?.[0].field).toBe('string');
    expect(body.errors?.[0].messages).toEqual(
      expect.arrayContaining([expect.any(String)]),
    );
    const field = query.startsWith('unexpected')
      ? 'unexpected'
      : query.split('=')[0];
    expect(body.errors?.some((error) => error.field === field)).toBe(true);
  });

  it.each([
    [
      new DatabaseError(new Error('secret SQL credentials')),
      500,
      'DATABASE_ERROR',
    ],
    [new Error('secret SQL credentials'), 500, 'INTERNAL_ERROR'],
  ])(
    'returns a safe problem for a controlled failure',
    async (error, status, code) => {
      const log = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => undefined);
      repository.list.mockRejectedValue(error);
      const response = await request(app.getHttpServer())
        .get('/api/v1/phrases')
        .expect(status);
      const body = response.body as ProblemBody;
      expect(response.headers['content-type']).toMatch(
        /application\/problem\+json/,
      );
      expect(body.status).toBe(status);
      expect(body.code).toBe(code);
      if (error instanceof DatabaseError) {
        expect(body.detail).toBe('Ocurrió un error de base de datos.');
        expect(log).toHaveBeenCalledTimes(1);
        expect(log).toHaveBeenCalledWith(error.cause, error.stack);
      }
      expect(typeof body.title).toBe('string');
      expect(typeof body.detail).toBe('string');
      expect(JSON.stringify(body)).not.toMatch(/secret|SQL|credentials|stack/i);
    },
  );

  it.each([
    [
      new InvalidEmbeddingError(
        'Embedding must contain exactly 384 components.',
      ),
      'INVALID_EMBEDDING',
    ],
    [
      new InvalidPhraseError('Model id must be a non-empty string.'),
      'INVALID_PHRASE',
    ],
    [
      new InvalidPhraseTextError('Phrase text must be a non-empty string.'),
      'INVALID_PHRASE_TEXT',
    ],
  ])(
    'translates a domain error using the controller filter: %s',
    async (error, code) => {
      repository.list.mockRejectedValue(error);
      const response = await request(app.getHttpServer())
        .get('/api/v1/phrases')
        .expect(500);
      expect(response.headers['content-type']).toMatch(
        /application\/problem\+json/,
      );
      expect(response.body).toEqual({
        title: 'Internal Server Error',
        status: 500,
        detail: error.message,
        code,
      });
    },
  );

  it('preserves 404 for unknown routes', async () => {
    const response = await request(app.getHttpServer())
      .get('/missing')
      .expect(404);
    expect(response.body).toMatchObject({ status: 404, code: 'HTTP_ERROR' });
  });

  it('does not identify every 503 as a database failure', async () => {
    repository.list.mockRejectedValue(
      new ServiceUnavailableException('secret provider details'),
    );
    const response = await request(app.getHttpServer())
      .get('/api/v1/phrases')
      .expect(503);
    expect(response.body).toMatchObject({ status: 503, code: 'HTTP_ERROR' });
    expect(JSON.stringify(response.body)).not.toContain('secret');
  });

  it('accepts more than 60 consecutive requests from the same IP', async () => {
    for (let i = 0; i < 61; i++) {
      await request(app.getHttpServer()).get('/api/v1/phrases').expect(200);
    }
    expect(repository.list).toHaveBeenCalledTimes(61);
  });
});
