import {
  INestApplication,
  ValidationPipe,
  RequestMethod,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { ProblemDetailsFilter } from './shared/infrastructure/http/filters/problem-details.filter';
import { validationExceptionFactory } from './shared/infrastructure/http/validation/validation-exception.factory';

export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('api', {
    exclude: [{ path: '/', method: RequestMethod.GET }],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      validationError: { target: false, value: false },
      exceptionFactory: validationExceptionFactory,
    }),
  );
  app.useGlobalFilters(new ProblemDetailsFilter(app.get(HttpAdapterHost)));
}
