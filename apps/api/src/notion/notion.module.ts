import { Module } from '@nestjs/common';
import { NotionClient } from './notion.client.js';
import { NotionController } from './notion.controller.js';
import { NotionSyncService } from './notion-sync.service.js';

@Module({
  controllers: [NotionController],
  providers: [NotionClient, NotionSyncService],
  exports: [NotionSyncService],
})
export class NotionModule {}
