import { Injectable, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { ConfigurationPort } from '../../application/ports/outbound/configuration.port';
import { ConfigurationModule } from './configuration.module';
import { NestConfigurationAdapter } from './nest-configuration.adapter';

@Injectable()
class ConfigurationConsumer {
  constructor(readonly config: ConfigurationPort) {}
}

@Module({
  providers: [ConfigurationConsumer],
  exports: [ConfigurationConsumer],
})
class ConsumerModule {}

describe('ConfigurationModule', () => {
  it('provides the adapter globally to a module without configuration imports', async () => {
    const module = await Test.createTestingModule({
      imports: [ConfigurationModule, ConsumerModule],
    })
      .overrideProvider(ConfigService)
      .useValue(new ConfigService({ GLOBAL_TEST_VALUE: 'available' }))
      .compile();
    try {
      const consumer = module.get(ConfigurationConsumer);
      expect(consumer.config).toBeInstanceOf(NestConfigurationAdapter);
      expect(consumer.config).toBe(module.get(ConfigurationPort));
      expect(consumer.config.getOrThrow<string>('GLOBAL_TEST_VALUE')).toBe(
        'available',
      );
    } finally {
      await module.close();
    }
  });
});
