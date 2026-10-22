import { BadRequestException } from '@nestjs/common';
import type { ValidationError } from 'class-validator';

import type { ProblemFieldError } from '../problem-detail/problem-detail';

export interface ValidationExceptionPayload {
  errors: ProblemFieldError[];
}

export function isValidationExceptionPayload(
  payload: unknown,
): payload is ValidationExceptionPayload {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'errors' in payload &&
    Array.isArray(payload.errors) &&
    payload.errors.every(
      (item: unknown) =>
        typeof item === 'object' &&
        item !== null &&
        'field' in item &&
        typeof item.field === 'string' &&
        'messages' in item &&
        Array.isArray(item.messages) &&
        item.messages.every((message: unknown) => typeof message === 'string'),
    )
  );
}

function fieldErrors(
  errors: ValidationError[],
  parent = '',
): ProblemFieldError[] {
  return errors.flatMap((error) => {
    const field = parent ? `${parent}.${error.property}` : error.property;
    const messages = Object.values(error.constraints ?? {});
    const own = messages.length ? [{ field, messages }] : [];
    return [...own, ...fieldErrors(error.children ?? [], field)];
  });
}

export function validationExceptionFactory(errors: ValidationError[]) {
  return new BadRequestException({ errors: fieldErrors(errors) });
}
