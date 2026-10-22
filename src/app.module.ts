import { Module } from '@nestjs/common';
import { PhrasesModule } from './modules/phrases/phrases.module';
import { ConfigurationModule } from './shared/infrastructure/configuration/configuration.module';

@Module({
  imports: [ConfigurationModule, PhrasesModule],
})
export class AppModule {}
