import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CaptureEntity } from './capture.entity.js';
import { CapturesController } from './captures.controller.js';
import { CapturesService } from './captures.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([CaptureEntity])],
  controllers: [CapturesController],
  providers: [CapturesService],
})
export class CapturesModule {}
