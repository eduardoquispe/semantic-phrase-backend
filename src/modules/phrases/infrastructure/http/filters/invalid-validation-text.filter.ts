import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';
import { InvalidPhraseTextError } from '../../../domain/errors/invalid-phrase-text.error';
import {
  MAX_PHRASE_TEXT_LENGTH,
  MIN_PHRASE_TEXT_LETTERS,
} from '../../../domain/constants/phrase-text.constants';
import { buildProblemDetail } from '../../../../../shared/infrastructure/http/problem-detail/build-problem-detail';
@Catch(InvalidPhraseTextError)
export class InvalidValidationTextFilter implements ExceptionFilter<InvalidPhraseTextError> {
  catch(_exception: InvalidPhraseTextError, host: ArgumentsHost): void {
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(400)
      .type('application/problem+json')
      .json(
        buildProblemDetail({
          status: 400,
          detail: 'Los datos enviados no son válidos.',
          code: 'VALIDATION_ERROR',
          errors: [
            {
              field: 'text',
              messages: [
                `El texto debe contener de 1 a ${MAX_PHRASE_TEXT_LENGTH} puntos de código Unicode, con al menos ${MIN_PHRASE_TEXT_LETTERS} letras, sin emojis, controles ni texto vacío.`,
              ],
            },
          ],
        }),
      );
  }
}
