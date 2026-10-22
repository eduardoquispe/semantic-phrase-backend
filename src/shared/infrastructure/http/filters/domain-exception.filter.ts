import { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import { Response } from 'express';
import { buildProblemDetail } from '../problem-detail/build-problem-detail';

export abstract class DomainExceptionFilter implements ExceptionFilter<Error> {
  protected abstract readonly status: number;
  protected abstract readonly code: string;

  catch(exception: Error, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    response
      .status(this.status)
      .type('application/problem+json')
      .json(
        buildProblemDetail({
          status: this.status,
          detail: exception.message,
          code: this.code,
        }),
      );
  }
}
