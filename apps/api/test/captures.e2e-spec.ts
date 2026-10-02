import { CaptureListSchema, CaptureSchema } from '@adhd-irection/shared-types';
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

describe('GET /captures (e2e)', () => {
  let app: INestApplication<App>;
  // 실제 캡처와 섞이지 않도록 먼 과거 시각으로 넣고 before 커서로 그 구간만 조회한다.
  const seeded = [
    { content: 'blocked', capturedAt: '2001-01-01T00:00:00.000Z' },
    { content: 'break', capturedAt: '2001-01-01T02:00:00.000Z' },
    { content: 'switched', capturedAt: '2001-01-01T01:00:00.000Z' },
  ];
  const seededIds: string[] = [];

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();

    for (const { content, capturedAt } of seeded) {
      const res = await request(app.getHttpServer())
        .post('/captures')
        .send({
          repoId: null,
          type: 'tag',
          content,
          source: 'desktop',
          capturedAt,
        })
        .expect(201);
      seededIds.push(res.body.id);
    }
  });

  afterAll(async () => {
    await app
      .get(DataSource)
      .query('DELETE FROM captures WHERE id = ANY($1)', [seededIds]);
    await app.close();
  });

  it('캡처를 최신순으로 돌려준다', async () => {
    const res = await request(app.getHttpServer())
      .get('/captures')
      .query({ before: '2001-01-02T00:00:00.000Z' })
      .expect(200);

    const captures = CaptureListSchema.parse(res.body);
    expect(captures.map((capture) => capture.content)).toEqual([
      'break',
      'switched',
      'blocked',
    ]);
  });

  it('limit만큼만 돌려준다', async () => {
    const res = await request(app.getHttpServer())
      .get('/captures')
      .query({ before: '2001-01-02T00:00:00.000Z', limit: 2 })
      .expect(200);
    expect(res.body.map((c: { content: string }) => c.content)).toEqual([
      'break',
      'switched',
    ]);
  });

  it('before 시각과 같거나 이후인 캡처는 제외한다', async () => {
    const res = await request(app.getHttpServer())
      .get('/captures')
      .query({ before: '2001-01-01T02:00:00.000Z' })
      .expect(200);
    expect(res.body.map((c: { content: string }) => c.content)).toEqual([
      'switched',
      'blocked',
    ]);
  });

  it('쿼리 없이 호출하면 기본 개수 이하로 돌려준다', async () => {
    const res = await request(app.getHttpServer()).get('/captures').expect(200);
    expect(CaptureListSchema.parse(res.body).length).toBeLessThanOrEqual(50);
  });

  it('잘못된 쿼리는 400으로 거부한다', async () => {
    const res = await request(app.getHttpServer())
      .get('/captures')
      .query({ limit: 0, before: 'yesterday' })
      .expect(400);
    expect(res.body.issues.map((i: { path: string }) => i.path)).toEqual(
      expect.arrayContaining(['limit', 'before']),
    );
  });
});
