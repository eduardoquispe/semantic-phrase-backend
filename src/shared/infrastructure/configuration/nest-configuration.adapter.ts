import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ConfigurationPort } from '../../application/ports/outbound/configuration.port';

@Injectable()
export class NestConfigurationAdapter extends ConfigurationPort {
  constructor(private readonly config: ConfigService) {
    super();
  }

  get<T>(key: string): T | undefined {
    return this.config.get<T>(key);
  }

  getOrThrow<T>(key: string): T {
    return this.config.getOrThrow<T>(key);
  }
}
