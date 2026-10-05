import type {
  Capture,
  CreateCapture,
  ListCapturesQuery,
} from '@adhd-irection/shared-types';
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { TEMP_USER_ID } from '../common/temp-user.js';
import { CaptureEntity } from './capture.entity.js';

const PG_FOREIGN_KEY_VIOLATION = '23503';

function toCapture(entity: CaptureEntity): Capture {
  return {
    id: entity.id,
    userId: entity.userId,
    repoId: entity.repoId,
    type: entity.type,
    content: entity.content,
    source: entity.source,
    capturedAt: entity.capturedAt.toISOString(),
    triggerType: entity.triggerType,
    activeApp: entity.activeApp,
    windowTitle: entity.windowTitle,
  };
}

@Injectable()
export class CapturesService {
  constructor(
    @InjectRepository(CaptureEntity)
    private readonly captures: Repository<CaptureEntity>,
  ) {}

  async list({ limit, before, after }: ListCapturesQuery): Promise<Capture[]> {
    const query = this.captures
      .createQueryBuilder('capture')
      .where('capture.userId = :userId', { userId: TEMP_USER_ID })
      .orderBy('capture.capturedAt', 'DESC')
      .take(limit);
    if (before) {
      query.andWhere('capture.capturedAt < :before', {
        before: new Date(before),
      });
    }
    if (after) {
      query.andWhere('capture.capturedAt >= :after', {
        after: new Date(after),
      });
    }
    return (await query.getMany()).map(toCapture);
  }

  async create(input: CreateCapture): Promise<Capture> {
    try {
      const saved = await this.captures.save({
        ...input,
        userId: TEMP_USER_ID,
        capturedAt: new Date(input.capturedAt),
      });
      return toCapture(saved);
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        error.driverError.code === PG_FOREIGN_KEY_VIOLATION
      ) {
        throw new BadRequestException('존재하지 않는 repoId입니다');
      }
      throw error;
    }
  }
}
