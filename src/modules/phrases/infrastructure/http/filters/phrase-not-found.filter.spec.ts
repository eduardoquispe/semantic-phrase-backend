import { ArgumentsHost } from '@nestjs/common';
import { PhraseNotFoundFilter } from './phrase-not-found.filter';
import { PhraseNotFoundError } from '../../../application/errors/phrase-not-found.error';

describe('PhraseNotFoundFilter', () => {
  it('returns 404 PHRASE_NOT_FOUND as problem+json', () => {
    const response = {
      status: jest.fn().mockReturnThis(),
      type: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    new PhraseNotFoundFilter().catch(new PhraseNotFoundError(), {
      switchToHttp: () => ({ getResponse: () => response }),
    } as unknown as ArgumentsHost);
    expect(response.status).toHaveBeenCalledWith(404);
    expect(response.type).toHaveBeenCalledWith('application/problem+json');
    expect(response.json).toHaveBeenCalledWith({
      title: 'Not Found',
      status: 404,
      detail: 'La frase no existe.',
      code: 'PHRASE_NOT_FOUND',
    });
  });
});
