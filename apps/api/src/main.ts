import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { GithubSyncService } from './github/github-sync.service.js';
import { NotionSyncService } from './notion/notion-sync.service.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // 데스크톱(Tauri dev/빌드)과 웹(Next.js dev)에서의 호출을 허용한다.
  app.enableCors({
    origin: [
      'http://localhost:1420',
      'tauri://localhost',
      'http://localhost:3000',
    ],
  });
  await app.listen(process.env.PORT ?? 4000);
  app.get(GithubSyncService).start();
  app.get(NotionSyncService).start();
}
await bootstrap();
