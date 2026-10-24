import type { ValidationMatch } from '../src/modules/phrases/domain/types/validation-match.type';
import { PhraseRepositoryPort } from '../src/modules/phrases/application/ports/outbound/phrase-repository.port';
import { PhraseValidationRepositoryPort } from '../src/modules/phrases/application/ports/outbound/phrase-validation-repository.port';
import { Embedding } from '../src/modules/phrases/domain/value-objects/embedding.value-object';
import { PhraseModel } from '../src/modules/phrases/domain/value-objects/phrase-model.value-object';
import { SimilarityScore } from '../src/modules/phrases/domain/value-objects/similarity-score.value-object';
import { PhraseValidation } from '../src/modules/phrases/domain/entities/phrase-validation.entity';
import { teiConfig } from './fixtures/tei';
import { EmbeddingGeneratorPort } from '../src/modules/phrases/application/ports/outbound/embedding-generator.port';
import { ConfigurationPort } from '../src/shared/application/ports/outbound/configuration.port';
import { ConfigurationStub } from './fixtures/configuration';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/configure-app';

process.env.DATABASE_URL ??=
  'postgresql://semantic:semantic@localhost:5432/semantic_phrase';

describe.each([
  {
    label: 'default settings',
    settings: {},
    expected: { threshold: 0.8538613695045911, ttlMinutes: 15 },
  },
  {
    label: 'configured settings',
    settings: {
      AI_SIMILARITY_THRESHOLD: '0',
      PHRASE_VALIDATION_TTL_MINUTES: '2',
    },
    expected: { threshold: 0, ttlMinutes: 2 },
  },
])('AppModule (e2e), $label', ({ settings, expected }) => {
  let app: INestApplication<App>;
  const validations = { save: jest.fn<Promise<void>, [PhraseValidation]>() };

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ConfigurationPort)
      .useValue(
        new ConfigurationStub({
          ...teiConfig,
          ...settings,
          DATABASE_URL: process.env.DATABASE_URL,
        }),
      )
      .overrideProvider(EmbeddingGeneratorPort)
      .useValue({
        generate: () =>
          Promise.resolve({
            embedding: new Embedding(Array<number>(384).fill(0.25)),
            model: new PhraseModel(
              teiConfig.AI_MODEL,
              teiConfig.AI_EMBEDDING_VERSION,
            ),
          }),
      })
      .overrideProvider(PhraseRepositoryPort)
      .useValue({
        findValidationMatch: () =>
          Promise.resolve({
            type: 'vector',
            phrase: {
              id: '550e8400-e29b-41d4-a716-446655440000',
              text: 'Candidate',
            },
            similarityScore: new SimilarityScore(0.5),
          } as ValidationMatch),
      })
      .overrideProvider(PhraseValidationRepositoryPort)
      .useValue(validations)
      .compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('resolves global configuration in consumers and applies numeric validation settings', async () => {
    validations.save.mockClear();
    await request(app.getHttpServer())
      .post('/api/v1/phrase-validations')
      .send({ text: 'Hola' })
      .expect(201);
    const saved = validations.save.mock.calls[0][0];
    expect(saved.requiresConfirmation).toBe(0.5 >= expected.threshold);
    expect(saved.expiresAt.getTime() - saved.createdAt.getTime()).toBe(
      expected.ttlMinutes * 60 * 1000,
    );
  });

  it('does not expose the removed starter route', () => {
    return request(app.getHttpServer()).get('/').expect(404);
  });
});
