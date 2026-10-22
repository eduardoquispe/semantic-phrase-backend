import { ArgumentsHost, Catch } from '@nestjs/common';
import { AiUnavailableError } from '../../embeddings/errors/ai-unavailable.error';
import { DomainExceptionFilter } from '../../../../../shared/infrastructure/http/filters/domain-exception.filter';
@Catch(AiUnavailableError)
export class AiUnavailableFilter extends DomainExceptionFilter {
  protected readonly status = 503;
  protected readonly code = 'AI_UNAVAILABLE';
  catch(_exception: AiUnavailableError, host: ArgumentsHost): void {
    super.catch(new AiUnavailableError(), host);
  }
}
