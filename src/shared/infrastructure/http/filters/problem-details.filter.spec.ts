import { ArgumentsHost, Logger } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { DatabaseError } from '../../database/errors/database.error';
import { ProblemDetailsFilter } from './problem-details.filter';

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
