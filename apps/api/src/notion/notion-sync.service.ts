import type { SyncResult, SyncStatus } from '@adhd-irection/shared-types';
import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { NotionClient } from './notion.client.js';

// 웹훅을 받을 공개 주소가 생기기 전까지는 주기적으로 가져온다.
// Notion은 페이지의 "마지막 편집 시각"만 알려주므로, 주기 사이의 편집은 한 건으로 합쳐진다.
// 요청 한 번이면 끝나서 GitHub보다 짧게 둔다.
const SYNC_INTERVAL_MS = 2 * 60 * 1000;

// 통합에 공유된 Notion 페이지의 편집을 notion_events에 쌓는다.
// 페이지가 편집됐다는 것이 "그때 정리하고 있었다"는 신호다.
@Injectable()
export class NotionSyncService implements OnModuleDestroy {
  private readonly logger = new Logger(NotionSyncService.name);
  private timer?: NodeJS.Timeout;
  private running?: Promise<SyncResult>;
  private lastSyncedAt: Date | null = null;
  private lastError: string | null = null;

  constructor(
    private readonly notion: NotionClient,
    private readonly dataSource: DataSource,
  ) {}

  /** 주기 동기화를 시작한다. 서버 기동 시(main.ts)에만 부른다 — 테스트에서는 돌지 않는다. */
  start(): void {
    if (!this.notion.enabled) {
      this.logger.warn('NOTION_TOKEN이 없어 Notion 동기화를 건너뜁니다');
      return;
    }
    const tick = () =>
      void this.sync().catch(() => {
        // 실패는 sync()가 기록한다. 다음 주기에 다시 시도한다.
      });
    tick();
    this.timer = setInterval(tick, SYNC_INTERVAL_MS);
  }

  onModuleDestroy(): void {
    clearInterval(this.timer);
  }

  status(): SyncStatus {
    return {
      enabled: this.notion.enabled,
      lastSyncedAt: this.lastSyncedAt?.toISOString() ?? null,
      lastError: this.lastError,
    };
  }

  /** 이미 돌고 있으면 그 결과를 함께 기다린다. */
  sync(): Promise<SyncResult> {
    this.running ??= this.run().finally(() => {
      this.running = undefined;
    });
    return this.running;
  }

  private async run(): Promise<SyncResult> {
    try {
      const pages = await this.notion.listRecentlyEditedPages();
      // 이미 저장된 (페이지, 편집 시각)은 건너뛴다 — 그 사이 편집이 없었다는 뜻이다.
      const inserted =
        pages.length === 0
          ? []
          : await this.dataSource.query<{ id: string }[]>(
              `INSERT INTO notion_events (page_id, page_title, edited_at)
               SELECT page_id, page_title, edited_at
               FROM unnest($1::text[], $2::text[], $3::timestamptz[])
                 AS page (page_id, page_title, edited_at)
               ON CONFLICT (page_id, edited_at) DO NOTHING
               RETURNING id`,
              [
                pages.map((page) => page.id),
                pages.map((page) => page.title),
                pages.map((page) => page.lastEditedAt),
              ],
            );

      this.lastSyncedAt = new Date();
      this.lastError = null;
      if (inserted.length > 0) {
        this.logger.log(`Notion 편집 ${inserted.length}건 저장`);
      }
      return { inserted: inserted.length };
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : String(error);
      this.logger.error(`Notion 동기화 실패: ${this.lastError}`);
      throw error;
    }
  }
}
