import { existsSync } from 'node:fs';
import { extname } from 'node:path';
import { DataSource, type DataSourceOptions } from 'typeorm';

// 로컬에서는 apps/api/.env를 읽는다. 이미 설정된 환경변수(배포 환경)가 우선한다.
if (existsSync('.env')) process.loadEnvFile('.env');

// TypeORM CLI(migration:run 등)와 Nest 앱이 함께 쓰는 연결 설정.
// 스키마 변경은 migrations/의 raw SQL로만 한다 — synchronize는 켜지 않는다.
export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  url: process.env.DATABASE_URL,
  synchronize: false,
  // CLI는 src의 .ts를, 빌드된 앱은 dist의 .js를 읽는다 (dist의 .d.ts 제외).
  migrations: [
    `${import.meta.dirname}/migrations/*${extname(import.meta.filename)}`,
  ],
};

export default new DataSource(dataSourceOptions);
