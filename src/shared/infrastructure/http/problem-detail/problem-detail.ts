export interface ProblemFieldError {
  field: string;
  messages: string[];
}

export interface ProblemDetail {
  title: string;
  status: number;
  detail: string;
  code: string;
  errors?: ProblemFieldError[];
}
