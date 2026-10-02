import type {
  CaptureSource,
  CaptureType,
  SessionTriggerType,
} from '@adhd-irection/shared-types';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

// captures 테이블과 1:1로 대응한다. 테이블 구조 자체는 migrations/의 SQL이 기준이다.
@Entity('captures')
export class CaptureEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'repo_id', type: 'uuid', nullable: true })
  repoId: string | null;

  @Column({ type: 'text' })
  type: CaptureType;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'text' })
  source: CaptureSource;

  @Column({ name: 'captured_at', type: 'timestamptz' })
  capturedAt: Date;

  @Column({ name: 'trigger_type', type: 'text', nullable: true })
  triggerType: SessionTriggerType | null;

  @Column({ name: 'active_app', type: 'text', nullable: true })
  activeApp: string | null;

  @Column({ name: 'window_title', type: 'text', nullable: true })
  windowTitle: string | null;
}
