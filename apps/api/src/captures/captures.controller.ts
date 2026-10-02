import {
  CreateCaptureSchema,
  ListCapturesQuerySchema,
  type Capture,
  type CreateCapture,
  type ListCapturesQuery,
} from '@adhd-irection/shared-types';
import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { CapturesService } from './captures.service.js';

@Controller('captures')
export class CapturesController {
  constructor(private readonly capturesService: CapturesService) {}

  @Get()
  list(
    @Query(new ZodValidationPipe(ListCapturesQuerySchema))
    query: ListCapturesQuery,
  ): Promise<Capture[]> {
    return this.capturesService.list(query);
  }

  @Post()
  create(
    @Body(new ZodValidationPipe(CreateCaptureSchema)) body: CreateCapture,
  ): Promise<Capture> {
    return this.capturesService.create(body);
  }
}
