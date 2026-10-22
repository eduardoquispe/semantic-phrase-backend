import { STATUS_CODES } from 'node:http';
import type { ProblemDetail, ProblemFieldError } from './problem-detail';

export interface BuildProblemDetailInput {
  status: number;
  detail: string;
  code: string;
  title?: string;
  errors?: ProblemFieldError[];
}

export function buildProblemDetail({
  status,
  detail,
  code,
  title,
  errors,
}: BuildProblemDetailInput): ProblemDetail {
  return {
    title: title ?? STATUS_CODES[status] ?? 'Error',
    status,
    detail,
    code,
    ...(errors?.length ? { errors } : {}),
  };
}
