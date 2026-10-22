import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ConfigurationPort } from '../../application/ports/outbound/configuration.port';
import { NestConfigurationAdapter } from './nest-configuration.adapter';

@Global()
@Module({
  imports: [ConfigModule.forRoot()],
  providers: [
    { provide: ConfigurationPort, useClass: NestConfigurationAdapter },
  ],
  exports: [ConfigurationPort],
})
export class ConfigurationModule {}
