import {
  CreateCaptureSchema,
  type Capture,
  type CreateCapture,
} from '@adhd-irection/shared-types';
import { Body, Controller, Post } from '@nestjs/common';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { CapturesService } from './captures.service.js';

@Controller('captures')
export class CapturesController {
  constructor(private readonly capturesService: CapturesService) {}

  @Post()
  create(
    @Body(new ZodValidationPipe(CreateCaptureSchema)) body: CreateCapture,
  ): Promise<Capture> {
    return this.capturesService.create(body);
  }
}
