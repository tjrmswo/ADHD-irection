import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { dataSourceOptions } from './database/data-source.js';
import { HealthController } from './health.controller.js';

@Module({
  imports: [TypeOrmModule.forRoot(dataSourceOptions)],
  controllers: [AppController, HealthController],
  providers: [AppService],
})
export class AppModule {}
