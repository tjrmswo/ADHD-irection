import type {
  Capture,
  CreateCapture,
  ListCapturesQuery,
} from '@adhd-irection/shared-types';
import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, QueryFailedError, Repository } from 'typeorm';
import { CaptureEntity } from './capture.entity.js';

// 카카오 로그인 도입 전까지 모든 캡처는 SeedTempUser 마이그레이션이 넣은 임시 유저에 귀속된다.
const TEMP_USER_ID = '00000000-0000-4000-8000-000000000001';

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

  async list({ limit, before }: ListCapturesQuery): Promise<Capture[]> {
    const rows = await this.captures.find({
      where: {
        userId: TEMP_USER_ID,
        ...(before && { capturedAt: LessThan(new Date(before)) }),
      },
      order: { capturedAt: 'DESC' },
      take: limit,
    });
    return rows.map(toCapture);
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
