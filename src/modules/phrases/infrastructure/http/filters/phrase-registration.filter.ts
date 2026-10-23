import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  PhraseRegistrationError,
  PhraseRegistrationReason,
} from '../../../application/errors/phrase-registration.error';
import type { ProblemDetail } from '../../../../../shared/infrastructure/http/problem-detail/problem-detail';
import { buildProblemDetail } from '../../../../../shared/infrastructure/http/problem-detail/build-problem-detail';
import { isValidationExceptionPayload } from '../../../../../shared/infrastructure/http/validation/validation-exception.factory';
const failures: Record<
  PhraseRegistrationReason,
  { status: number; detail: string }
> = {
  INVALID_VALIDATION_ID: {
    status: 400,
    detail: 'La referencia de validación no es válida.',
  },
  PHRASE_MISMATCH: {
    status: 400,
    detail: 'El texto no corresponde a la validación.',
  },
  INCOMPATIBLE_MODEL: {
    status: 409,
    detail: 'La validación no es compatible con el modelo actual.',
  },
  VALIDATION_EXPIRED: {
    status: 409,
    detail: 'La validación expiró. Valida nuevamente la frase.',
  },
  VALIDATION_ALREADY_USED: {
    status: 409,
    detail: 'La validación ya fue utilizada.',
  },
  CONFIRMATION_REQUIRED: {
    status: 409,
    detail: 'Se requiere confirmación explícita.',
  },
};
@Catch(PhraseRegistrationError, BadRequestException)
export class PhraseRegistrationFilter implements ExceptionFilter {
  catch(
    exception: PhraseRegistrationError | BadRequestException,
    host: ArgumentsHost,
  ): void {
    let problem: ProblemDetail;
    if (exception instanceof PhraseRegistrationError) {
      problem = buildProblemDetail({
        ...failures[exception.reason],
        code: exception.reason,
      });
    } else {
      const payload = exception.getResponse();
      const errors = isValidationExceptionPayload(payload)
        ? payload.errors
        : undefined;
      problem = buildProblemDetail({
        status: 400,
        detail: 'Los datos enviados no son válidos.',
        code: errors?.some((error) => error.field === 'validationId')
          ? 'INVALID_VALIDATION_ID'
          : 'VALIDATION_ERROR',
        errors,
      });
    }
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(problem.status)
      .type('application/problem+json')
      .json(problem);
  }
}
