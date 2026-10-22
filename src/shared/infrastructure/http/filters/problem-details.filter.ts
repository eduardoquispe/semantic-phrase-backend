import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { DatabaseUnavailableError } from '../../database/errors/database-unavailable.error';
import type { ProblemDetail } from '../problem-detail/problem-detail';
import { isValidationExceptionPayload } from '../validation/validation-exception.factory';
import { buildProblemDetail } from '../problem-detail/build-problem-detail';

@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const problem = this.toProblemDetail(exception);
    const { httpAdapter } = this.httpAdapterHost;
    const response = host.switchToHttp().getResponse<unknown>();

    httpAdapter.setHeader(
      response,
      'Content-Type',
      'application/problem+json; charset=utf-8',
    );
    httpAdapter.reply(response, problem, problem.status);
  }

  private toProblemDetail(exception: unknown): ProblemDetail {
    if (exception instanceof DatabaseUnavailableError) {
      return buildProblemDetail({
        status: HttpStatus.SERVICE_UNAVAILABLE,
        detail: 'La base de datos no está disponible.',
        code: 'DATABASE_UNAVAILABLE',
      });
    }
    if (exception instanceof HttpException) {
      return this.handleHttp(exception);
    }
    return this.handleUnknown();
  }

  private handleHttp(exception: HttpException): ProblemDetail {
    const status = exception.getStatus();
    const payload = exception.getResponse();

    if (status === 500) {
      return this.handleUnknown();
    }

    if (status === 400) {
      return buildProblemDetail({
        status,
        detail: 'Los parámetros de la solicitud no son válidos.',
        code: 'VALIDATION_ERROR',
        errors: isValidationExceptionPayload(payload)
          ? payload.errors
          : undefined,
      });
    }

    return buildProblemDetail({
      status,
      detail: 'No se pudo completar la solicitud.',
      code: 'HTTP_ERROR',
    });
  }

  private handleUnknown(): ProblemDetail {
    return buildProblemDetail({
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      detail: 'Ocurrió un error interno.',
      code: 'INTERNAL_ERROR',
    });
  }
}
