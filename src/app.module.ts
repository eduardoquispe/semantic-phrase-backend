import { Module } from '@nestjs/common';
import { PhrasesModule } from './modules/phrases/phrases.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PhrasesModule,
  ],
})
export class AppModule {}
