import { VALIDATION_SETTINGS } from '../src/modules/phrases/application/ports/inbound/validate-phrase.port';
import { teiConfig } from './fixtures/tei';
import { EmbeddingGeneratorPort } from '../src/modules/phrases/application/ports/outbound/embedding-generator.port';
import { ConfigService } from '@nestjs/config';
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

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ConfigService)
      .useValue(
        new ConfigService({
          ...teiConfig,
          ...settings,
          DATABASE_URL: process.env.DATABASE_URL,
        }),
      )
      .overrideProvider(EmbeddingGeneratorPort)
      .useValue({ generate: jest.fn() })
      .compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('starts without a signing secret and resolves numeric validation settings', () => {
    expect(app.get<unknown>(VALIDATION_SETTINGS)).toEqual(expected);
  });

  it('does not expose the removed starter route', () => {
    return request(app.getHttpServer()).get('/').expect(404);
  });
});
