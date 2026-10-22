import {
  ArgumentsHost,
  BadRequestException,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { DatabaseError } from '../../database/errors/database.error';
import { ProblemDetailsFilter } from './problem-details.filter';
import { IncompatiblePhraseCollectionError } from '../../../../modules/phrases/application/errors/incompatible-phrase-collection.error';

describe('ProblemDetailsFilter unexpected failures', () => {
  afterEach(() => jest.restoreAllMocks());

  function run(exception: unknown) {
    const log = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    const response = {};
    const httpAdapter = { setHeader: jest.fn(), reply: jest.fn() };
    const filter = new ProblemDetailsFilter({
      httpAdapter,
    } as unknown as HttpAdapterHost);
    filter.catch(exception, {
      switchToHttp: () => ({ getResponse: () => response }),
    } as unknown as ArgumentsHost);
    return { log, httpAdapter, response };
  }

  const genericProblem = {
    title: 'Internal Server Error',
    status: 500,
    detail: 'Ocurrió un error interno.',
    code: 'INTERNAL_ERROR',
  };

  it.each([
    new Error('Custom'),
    new IncompatiblePhraseCollectionError(),
    new InternalServerErrorException('Custom'),
  ])('logs message and stack, replies generic 500: %p', (error) => {
    const { log, httpAdapter, response } = run(error);
    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith(error.message, error.stack);
    expect(httpAdapter.reply).toHaveBeenCalledWith(
      response,
      genericProblem,
      500,
    );
  });

  it('does not log non-Error throwables, still replies generic 500', () => {
    const { log, httpAdapter, response } = run('boom');
    expect(log).not.toHaveBeenCalled();
    expect(httpAdapter.reply).toHaveBeenCalledWith(
      response,
      genericProblem,
      500,
    );
  });

  it('does not log 4xx http exceptions', () => {
    const { log, httpAdapter } = run(new BadRequestException());
    expect(log).not.toHaveBeenCalled();
    expect(httpAdapter.reply).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ status: 400 }),
      400,
    );
  });
});

describe('ProblemDetailsFilter database failures', () => {
  afterEach(() => jest.restoreAllMocks());

  it.each([
    new Error('SQL credentials private data'),
    { code: '23505', detail: 'private constraint' },
    'private failure',
  ])(
    'logs the original cause and stack once and returns a safe problem: %p',
    (cause) => {
      const log = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => undefined);
      const response = {};
      const httpAdapter = { setHeader: jest.fn(), reply: jest.fn() };
      const filter = new ProblemDetailsFilter({
        httpAdapter,
      } as unknown as HttpAdapterHost);
      const error = new DatabaseError(cause);
      filter.catch(error, {
        switchToHttp: () => ({ getResponse: () => response }),
      } as unknown as ArgumentsHost);
      expect(error.cause).toBe(cause);
      expect(log).toHaveBeenCalledTimes(1);
      expect(log).toHaveBeenCalledWith(cause, error.stack);
      expect(httpAdapter.setHeader).toHaveBeenCalledWith(
        response,
        'Content-Type',
        'application/problem+json; charset=utf-8',
      );
      expect(httpAdapter.reply).toHaveBeenCalledTimes(1);
      expect(httpAdapter.reply).toHaveBeenCalledWith(
        response,
        {
          title: 'Internal Server Error',
          status: 500,
          detail: 'Ocurrió un error de base de datos.',
          code: 'DATABASE_ERROR',
        },
        500,
      );
    },
  );
});
