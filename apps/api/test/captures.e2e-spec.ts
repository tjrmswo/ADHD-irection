import { CaptureSchema } from '@adhd-irection/shared-types';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { DataSource } from 'typeorm';
import { AppModule } from './../src/app.module.js';

// 로컬 Postgres(pnpm db:up + pnpm db:migrate)가 떠 있어야 한다.
describe('POST /captures (e2e)', () => {
  let app: INestApplication<App>;
  const createdIds: string[] = [];

  const validBody = {
    repoId: null,
    type: 'tag',
    content: 'blocked',
    source: 'desktop',
    capturedAt: '2026-10-02T06:00:00.000Z',
  };

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    if (createdIds.length > 0) {
      await app
        .get(DataSource)
        .query('DELETE FROM captures WHERE id = ANY($1)', [createdIds]);
    }
    await app.close();
  });

  it('임시 유저로 캡처를 저장하고 저장된 캡처를 돌려준다', async () => {
    const res = await request(app.getHttpServer())
      .post('/captures')
      .send(validBody)
      .expect(201);
    createdIds.push(res.body.id);

    const capture = CaptureSchema.parse(res.body);
    expect(capture).toMatchObject(validBody);
    expect(capture.userId).toBe('00000000-0000-4000-8000-000000000001');

    const rows = await app
      .get(DataSource)
      .query('SELECT content, source FROM captures WHERE id = $1', [
        capture.id,
      ]);
    expect(rows).toEqual([{ content: 'blocked', source: 'desktop' }]);
  });

  it('스키마에 맞지 않는 본문은 400으로 거부한다', async () => {
    const res = await request(app.getHttpServer())
      .post('/captures')
      .send({ ...validBody, source: 'mobile', capturedAt: 'yesterday' })
      .expect(400);
    expect(res.body.issues.map((i: { path: string }) => i.path)).toEqual(
      expect.arrayContaining(['source', 'capturedAt']),
    );
  });

  it('tag 캡처의 content가 프리셋 태그가 아니면 400으로 거부한다', async () => {
    const res = await request(app.getHttpServer())
      .post('/captures')
      .send({ ...validBody, content: '아무 글자' })
      .expect(400);
    expect(res.body.issues[0].path).toBe('content');
  });

  it('존재하지 않는 repoId는 400으로 거부한다', async () => {
    await request(app.getHttpServer())
      .post('/captures')
      .send({ ...validBody, repoId: '11111111-1111-4111-8111-111111111111' })
      .expect(400);
  });
});
