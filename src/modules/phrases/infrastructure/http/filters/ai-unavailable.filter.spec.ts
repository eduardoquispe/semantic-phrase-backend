import { ArgumentsHost } from '@nestjs/common';
import { AiUnavailableFilter } from './ai-unavailable.filter';
import { AiUnavailableError } from '../../embeddings/errors/ai-unavailable.error';
describe('AiUnavailableFilter', () => {
  it('returns safe 503 without provider details', () => {
    const response = {
      status: jest.fn().mockReturnThis(),
      type: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const error = new AiUnavailableError();
    error.message = 'private provider failure';
    new AiUnavailableFilter().catch(error, {
      switchToHttp: () => ({ getResponse: () => response }),
    } as unknown as ArgumentsHost);
    expect(response.status).toHaveBeenCalledWith(503);
    expect(response.type).toHaveBeenCalledWith('application/problem+json');
    expect(response.json).toHaveBeenCalledWith({
      title: 'Service Unavailable',
      status: 503,
      detail: 'El servicio de IA no está disponible.',
      code: 'AI_UNAVAILABLE',
    });
  });
});
