import { Module } from '@nestjs/common';
import { PhrasesModule } from './modules/phrases/phrases.module';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  controllers: [AppController],
  providers: [AppService],
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    PhrasesModule,
  ],
})
export class AppModule {}
