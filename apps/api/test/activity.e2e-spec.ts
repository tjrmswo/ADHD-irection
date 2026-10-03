import {
  ActivityDashboardSchema,
  ActivityRangeSchema,
  GithubSyncResultSchema,
} from '@adhd-irection/shared-types';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { DataSource } from 'typeorm';
import { AppModule } from './../src/app.module.js';
import { GithubClient } from './../src/github/github.client.js';

const TEMP_USER_ID = '00000000-0000-4000-8000-000000000001';

// 실제 GitHub을 부르지 않도록 바꿔 끼우는 가짜 클라이언트.
const fakeGithub = {
  enabled: true,
  viewer: async () => ({ id: 'viewer-id', login: 'e2e' }),
  listReposPushedSince: async () => [
    { fullName: 'e2e-test/synced', name: 'synced' },
    { fullName: 'e2e-test/no-commits', name: 'no-commits' },
  ],
  listCommits: async (repoFullName: string) =>
    repoFullName === 'e2e-test/synced'
      ? [
          {
            sha: 'aaa111',
            message: 'first',
            authoredAt: '2001-04-01T01:00:00Z',
          },
          {
            sha: 'bbb222',
            message: 'second',
            authoredAt: '2001-04-01T02:00:00Z',
          },
        ]
      : [],
};

// 로컬 Postgres(pnpm db:up + pnpm db:migrate)가 떠 있어야 한다.
describe('활동 대시보드와 GitHub 동기화 (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;

  beforeAll(async () => {
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(GithubClient)
      .useValue(fakeGithub)
      .compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    dataSource = app.get(DataSource);

    // 실제 기록과 섞이지 않도록 먼 과거(2001-03-10 KST 전후)에 흔적을 넣는다.
    const [{ id: repoId }] = await dataSource.query(
      `INSERT INTO repos (name, github_full_name)
       VALUES ('dashboard', 'e2e-test/dashboard') RETURNING id`,
    );
    await dataSource.query(
      `INSERT INTO github_events (repo_id, event_type, sha, message, committed_at)
       VALUES
         ($1, 'commit', 's1', '전날 밤 커밋',  '2001-03-09T14:50:00Z'),
         ($1, 'commit', 's2', '자정 직후 커밋', '2001-03-09T15:10:00Z'),
         ($1, 'commit', 's3', '아침 커밋 1',   '2001-03-10T00:10:00Z'),
         ($1, 'commit', 's4', '아침 커밋 2',   '2001-03-10T00:20:00Z')`,
      [repoId],
    );
    await dataSource.query(
      `INSERT INTO captures (user_id, type, content, source, captured_at, trigger_type)
       VALUES
         ($1, 'tag', 'blocked', 'desktop', '2001-03-10T00:25:00Z', 'idle_resume'),
         ($1, 'tag', 'break',   'desktop', '2001-03-10T03:05:00Z', 'manual')`,
      [TEMP_USER_ID],
    );
  });

  afterAll(async () => {
    // github_events는 repos 삭제 시 CASCADE로 함께 지워진다.
    await dataSource.query(
      `DELETE FROM repos WHERE github_full_name LIKE 'e2e-test/%'`,
    );
    await dataSource.query(
      `DELETE FROM captures WHERE captured_at >= '2001-03-01' AND captured_at < '2001-04-01'`,
    );
    await app.close();
  });

  it('기준일의 흔적을 한국 시간 30분 칸으로 묶는다', async () => {
    const res = await request(app.getHttpServer())
      .get('/activity/dashboard')
      .query({ date: '2001-03-10' })
      .expect(200);
    const dashboard = ActivityDashboardSchema.parse(res.body);

    expect(dashboard.date).toBe('2001-03-10');
    expect(dashboard.blocks).toEqual([
      // UTC로는 전날(03-09 15:10)이지만 한국 시간으로는 03-10 00:10
      { index: 0, sources: ['github'] },
      // 09:10, 09:20 커밋과 09:25 캡처가 같은 칸
      { index: 18, sources: ['capture', 'github'] },
      { index: 24, sources: ['capture'] },
    ]);
  });

  it('최근 28일을 날짜별로 집계한다', async () => {
    const res = await request(app.getHttpServer())
      .get('/activity/dashboard')
      .query({ date: '2001-03-10' })
      .expect(200);
    const { days } = ActivityDashboardSchema.parse(res.body);

    expect(days).toHaveLength(28);
    expect(days[0].date).toBe('2001-02-11');
    expect(days.at(-1)).toEqual({
      date: '2001-03-10',
      activeBlocks: 3,
      commits: 3,
      captures: 2,
      resumes: 1,
    });
    expect(days.at(-2)).toEqual({
      date: '2001-03-09',
      activeBlocks: 1,
      commits: 1,
      captures: 0,
      resumes: 0,
    });
    expect(days[0].activeBlocks).toBe(0);
  });

  it('기준일까지의 최근 커밋을 최신순으로 돌려준다', async () => {
    const res = await request(app.getHttpServer())
      .get('/activity/dashboard')
      .query({ date: '2001-03-10' })
      .expect(200);
    const { recentCommits } = ActivityDashboardSchema.parse(res.body);

    expect(recentCommits.slice(0, 2)).toEqual([
      {
        repo: 'e2e-test/dashboard',
        message: '아침 커밋 2',
        committedAt: '2001-03-10T00:20:00.000Z',
      },
      {
        repo: 'e2e-test/dashboard',
        message: '아침 커밋 1',
        committedAt: '2001-03-10T00:10:00.000Z',
      },
    ]);
  });

  it('date를 생략하면 오늘 기준으로 돌려준다', async () => {
    const res = await request(app.getHttpServer())
      .get('/activity/dashboard')
      .expect(200);
    const dashboard = ActivityDashboardSchema.parse(res.body);
    expect(dashboard.days.at(-1)?.date).toBe(dashboard.date);
  });

  it('잘못된 date는 400으로 거부한다', async () => {
    await request(app.getHttpServer())
      .get('/activity/dashboard')
      .query({ date: '03/10/2001' })
      .expect(400);
  });

  it('기간을 주면 날짜별 집계와 날짜가 붙은 작업 블록을 돌려준다', async () => {
    const res = await request(app.getHttpServer())
      .get('/activity/range')
      .query({ from: '2001-03-08', to: '2001-03-11' })
      .expect(200);
    const range = ActivityRangeSchema.parse(res.body);

    expect(range.days.map((day) => [day.date, day.activeBlocks])).toEqual([
      ['2001-03-08', 0],
      ['2001-03-09', 1],
      ['2001-03-10', 3],
      ['2001-03-11', 0],
    ]);
    expect(range.blocks).toEqual([
      { date: '2001-03-09', index: 47, sources: ['github'] },
      { date: '2001-03-10', index: 0, sources: ['github'] },
      { date: '2001-03-10', index: 18, sources: ['capture', 'github'] },
      { date: '2001-03-10', index: 24, sources: ['capture'] },
    ]);
  });

  it('거꾸로 된 기간과 366일을 넘는 기간은 400으로 거부한다', async () => {
    await request(app.getHttpServer())
      .get('/activity/range')
      .query({ from: '2001-03-10', to: '2001-03-09' })
      .expect(400);
    await request(app.getHttpServer())
      .get('/activity/range')
      .query({ from: '2001-01-01', to: '2002-01-02' })
      .expect(400);
    await request(app.getHttpServer())
      .get('/activity/range')
      .query({ from: '2000-01-01', to: '2000-12-31' })
      .expect(200);
  });

  it('동기화하면 커밋을 저장하고, 다시 해도 중복 저장하지 않는다', async () => {
    const first = await request(app.getHttpServer())
      .post('/github/sync')
      .expect(200);
    expect(GithubSyncResultSchema.parse(first.body)).toEqual({
      inserted: 2,
      repos: 1,
    });

    const second = await request(app.getHttpServer())
      .post('/github/sync')
      .expect(200);
    expect(second.body).toEqual({ inserted: 0, repos: 1 });

    const rows = await dataSource.query(
      `SELECT e.sha, e.message, e.event_type
       FROM github_events e
       JOIN repos r ON r.id = e.repo_id
       WHERE r.github_full_name = 'e2e-test/synced'
       ORDER BY e.committed_at`,
    );
    expect(rows).toEqual([
      { sha: 'aaa111', message: 'first', event_type: 'commit' },
      { sha: 'bbb222', message: 'second', event_type: 'commit' },
    ]);
    // 커밋이 없는 레포는 repos에 만들지 않는다.
    const empty = await dataSource.query(
      `SELECT 1 FROM repos WHERE github_full_name = 'e2e-test/no-commits'`,
    );
    expect(empty).toEqual([]);

    const status = await request(app.getHttpServer())
      .get('/github/sync')
      .expect(200);
    expect(status.body.lastSyncedAt).not.toBeNull();

    const res = await request(app.getHttpServer())
      .get('/activity/dashboard')
      .expect(200);
    const { githubSync } = ActivityDashboardSchema.parse(res.body);
    expect(githubSync.enabled).toBe(true);
    expect(githubSync.lastSyncedAt).not.toBeNull();
    expect(githubSync.lastError).toBeNull();
  });
});
