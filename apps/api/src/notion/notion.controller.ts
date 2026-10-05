import type {
  NotionPageDetail,
  SyncResult,
  SyncStatus,
} from '@adhd-irection/shared-types';
import {
  Controller,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { NotionClient } from './notion.client.js';
import { NotionSyncService } from './notion-sync.service.js';

@Controller('notion')
export class NotionController {
  constructor(
    private readonly notionSync: NotionSyncService,
    private readonly notion: NotionClient,
    private readonly dataSource: DataSource,
  ) {}

  // 페이지의 현재 내용. 동기화로 편집이 저장된 페이지만 조회할 수 있다.
  @Get('pages/:pageId')
  async page(@Param('pageId') pageId: string): Promise<NotionPageDetail> {
    const [stored] = await this.dataSource.query<unknown[]>(
      `SELECT 1 FROM notion_events WHERE page_id = $1 LIMIT 1`,
      [pageId],
    );
    if (!stored) throw new NotFoundException('저장된 페이지가 아닙니다');
    const content = await this.notion.getPageContent(pageId);
    return {
      pageId,
      ...content,
      lastEditedAt: new Date(content.lastEditedAt).toISOString(),
    };
  }

  // 마지막 동기화 상태
  @Get('sync')
  status(): SyncStatus {
    return this.notionSync.status();
  }

  // 주기를 기다리지 않고 지금 바로 동기화한다.
  @Post('sync')
  @HttpCode(200)
  sync(): Promise<SyncResult> {
    return this.notionSync.sync();
  }
}
