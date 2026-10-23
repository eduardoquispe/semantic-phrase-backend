import { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import { PhraseValidationRejectedError } from '../../../domain/errors/phrase-validation-rejected.error';
import { buildProblemDetail } from '../../../../../shared/infrastructure/http/problem-detail/build-problem-detail';

export abstract class PhraseValidationRejectedFilter implements ExceptionFilter<PhraseValidationRejectedError> {
  protected abstract readonly status: number;

  catch(exception: PhraseValidationRejectedError, host: ArgumentsHost): void {
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(this.status)
      .type('application/problem+json')
      .json(
        buildProblemDetail({
          status: this.status,
          detail: exception.message,
          code: exception.code,
        }),
      );
  }
}
