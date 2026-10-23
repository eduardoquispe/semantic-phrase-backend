import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { buildProblemDetail } from '../../../../../shared/infrastructure/http/problem-detail/build-problem-detail';
import { isValidationExceptionPayload } from '../../../../../shared/infrastructure/http/validation/validation-exception.factory';

@Catch(BadRequestException)
export class InvalidRegistrationRequestFilter implements ExceptionFilter<BadRequestException> {
  catch(exception: BadRequestException, host: ArgumentsHost): void {
    const payload = exception.getResponse();
    const errors = isValidationExceptionPayload(payload)
      ? payload.errors
      : undefined;
    const problem = buildProblemDetail({
      status: HttpStatus.BAD_REQUEST,
      detail: 'Los datos enviados no son válidos.',
      code: errors?.some((error) => error.field === 'validationId')
        ? 'INVALID_VALIDATION_ID'
        : 'VALIDATION_ERROR',
      errors,
    });
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(problem.status)
      .type('application/problem+json')
      .json(problem);
  }
}
