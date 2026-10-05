import {
  ActivityDashboardSchema,
  CommitDetailSchema,
  NotionPageDetailSchema,
  WorkItemsSchema,
  WorkLogSchema,
  ActivityRangeSchema,
  ActivityRecapResponseSchema,
  GithubSyncResultSchema,
} from '@adhd-irection/shared-types';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { DataSource } from 'typeorm';
import { AppModule } from './../src/app.module.js';
import { GithubClient } from './../src/github/github.client.js';
import { NotionClient } from './../src/notion/notion.client.js';

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
  getCommit: async (repoFullName: string, sha: string) => ({
    message: `전체 메시지 (${repoFullName})\n\n본문`,
    url: `https://github.com/${repoFullName}/commit/${sha}`,
    committedAt: '2001-03-10T00:20:00Z',
    additions: 12,
    deletions: 3,
    fileCount: 1,
    files: [
      { path: 'src/main.ts', status: 'modified', additions: 12, deletions: 3 },
    ],
  }),
};

// 실제 Notion을 부르지 않도록 바꿔 끼우는 가짜 클라이언트. 테스트가 돌려줄 페이지를 바꿔 가며 쓴다.
const fakeNotion = {
  enabled: true,
  pages: [] as { id: string; title: string | null; lastEditedAt: string }[],
  listRecentlyEditedPages: async () => fakeNotion.pages,
  getPageContent: async () => ({
    title: '정리 노트',
    url: 'https://www.notion.so/e2e',
    lastEditedAt: '2001-03-14T01:10:00Z',
    blocks: [
      { type: 'heading_1', text: '오늘 한 일', checked: null },
      { type: 'to_do', text: '모듈 구조 정리', checked: true },
    ],
    truncated: false,
  }),
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
      .overrideProvider(NotionClient)
      .useValue(fakeNotion)
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
      `INSERT INTO captures
         (user_id, type, content, source, captured_at, trigger_type, active_app, window_title)
       VALUES
         ($1, 'tag', 'blocked', 'desktop', '2001-03-10T00:25:00Z', 'idle_resume', 'Code', 'main.ts'),
         ($1, 'tag', 'break',   'desktop', '2001-03-10T03:05:00Z', 'manual', NULL, NULL)`,
      [TEMP_USER_ID],
    );
  });

  // 사용 흔적 테스트가 넣은 것 (2001-03-12 KST 전후)
  const clearUsage = () =>
    dataSource.query(
      `DELETE FROM app_usage WHERE observed_at >= '2001-03-01' AND observed_at < '2001-04-01'`,
    );

  afterAll(async () => {
    await clearUsage();
    await dataSource.query(
      `DELETE FROM notion_events WHERE page_id LIKE 'e2e-%'`,
    );
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

  it('기준일까지의 최근 커밋과 Notion 편집을 한 목록으로 최신순으로 돌려준다', async () => {
    // 두 커밋(09:10, 09:20 KST) 사이에 Notion 편집 하나
    await dataSource.query(
      `INSERT INTO notion_events (page_id, page_title, edited_at)
       VALUES ('e2e-recent', '아침 정리', '2001-03-10T00:15:00Z')`,
    );
    const res = await request(app.getHttpServer())
      .get('/activity/dashboard')
      .query({ date: '2001-03-10' })
      .expect(200);
    const { recentWork } = ActivityDashboardSchema.parse(res.body);
    await dataSource.query(
      `DELETE FROM notion_events WHERE page_id = 'e2e-recent'`,
    );

    expect(recentWork.slice(0, 3)).toEqual([
      {
        kind: 'commit',
        title: '아침 커밋 2',
        detail: 'e2e-test/dashboard',
        at: '2001-03-10T00:20:00.000Z',
        ref: 's4',
      },
      {
        kind: 'notion',
        title: '아침 정리',
        detail: null,
        at: '2001-03-10T00:15:00.000Z',
        ref: 'e2e-recent',
      },
      {
        kind: 'commit',
        title: '아침 커밋 1',
        detail: 'e2e-test/dashboard',
        at: '2001-03-10T00:10:00.000Z',
        ref: 's3',
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

  it('직전에 이어서 작업한 구간을 요약한다', async () => {
    // 09:10, 09:20 커밋과 09:25 캡처가 한 구간. 그 앞의 00:10 커밋은 30분 넘게 떨어져 있다.
    const res = await request(app.getHttpServer())
      .get('/activity/recap')
      .query({ at: '2001-03-10T01:00:00Z' })
      .expect(200);
    const { recap } = ActivityRecapResponseSchema.parse(res.body);

    expect(recap).toEqual({
      startedAt: '2001-03-10T00:10:00.000Z',
      endedAt: '2001-03-10T00:25:00.000Z',
      commits: 2,
      captures: 1,
      notionEdits: 0,
      lastNotionPage: null,
      lastCommit: {
        repo: 'e2e-test/dashboard',
        message: '아침 커밋 2',
        committedAt: '2001-03-10T00:20:00.000Z',
      },
      lastContext: { activeApp: 'Code', windowTitle: 'main.ts' },
    });
  });

  it('구간에 커밋이나 앱 정보가 없으면 그 항목은 null이다', async () => {
    // 12:05 캡처 하나뿐인 구간 (앱 정보 없음)
    const res = await request(app.getHttpServer())
      .get('/activity/recap')
      .query({ at: '2001-03-10T04:00:00Z' })
      .expect(200);
    expect(ActivityRecapResponseSchema.parse(res.body).recap).toEqual({
      startedAt: '2001-03-10T03:05:00.000Z',
      endedAt: '2001-03-10T03:05:00.000Z',
      commits: 0,
      captures: 1,
      notionEdits: 0,
      lastNotionPage: null,
      lastCommit: null,
      lastContext: null,
    });
  });

  it('최근 12시간 안에 흔적이 없으면 요약은 null이다', async () => {
    const res = await request(app.getHttpServer())
      .get('/activity/recap')
      .query({ at: '2001-03-05T00:00:00Z' })
      .expect(200);
    expect(res.body).toEqual({ recap: null });
  });

  it('작업용 앱의 사용 흔적만 작업 블록과 요약에 들어간다', async () => {
    const post = (activeApp: string, windowTitle: string, observedAt: string) =>
      request(app.getHttpServer())
        .post('/usage')
        .send({ activeApp, windowTitle, observedAt })
        .expect(201);
    // 한국 시간 2001-03-12 10:00~10:20
    await post('Code', 'main.ts', '2001-03-12T01:00:00Z');
    await post('Code', 'app.module.ts', '2001-03-12T01:05:00Z');
    await post('Google Chrome', 'NestJS 문서', '2001-03-12T01:10:00Z');
    // 작업용 앱이 아니라 저장만 되고 집계에서는 빠진다.
    await post('Music', '재생 목록', '2001-03-12T01:20:00Z');
    await post('Music', '재생 목록', '2001-03-12T03:00:00Z');

    const range = await request(app.getHttpServer())
      .get('/activity/range')
      .query({ from: '2001-03-12', to: '2001-03-12' })
      .expect(200);
    expect(ActivityRangeSchema.parse(range.body).blocks).toEqual([
      { date: '2001-03-12', index: 20, sources: ['usage'] },
    ]);

    const res = await request(app.getHttpServer())
      .get('/activity/recap')
      .query({ at: '2001-03-12T04:00:00Z' })
      .expect(200);
    expect(ActivityRecapResponseSchema.parse(res.body).recap).toEqual({
      startedAt: '2001-03-12T01:00:00.000Z',
      endedAt: '2001-03-12T01:10:00.000Z',
      commits: 0,
      captures: 0,
      notionEdits: 0,
      lastNotionPage: null,
      lastCommit: null,
      // 브라우저는 창 제목을 저장만 하고 내보내지 않는다.
      lastContext: { activeApp: 'Google Chrome', windowTitle: null },
    });
  });

  it('observedAt을 보내지 않은 사용 흔적은 받은 시각으로 저장한다', async () => {
    const before = Date.now();
    const res = await request(app.getHttpServer())
      .post('/usage')
      .send({ activeApp: 'e2e-probe', windowTitle: null })
      .expect(201);
    await dataSource.query(`DELETE FROM app_usage WHERE id = $1`, [
      res.body.id,
    ]);
    const observedAt = Date.parse(res.body.observedAt);
    expect(observedAt).toBeGreaterThanOrEqual(before - 1000);
    expect(observedAt).toBeLessThanOrEqual(Date.now() + 1000);
  });

  it('앱 이름이 없는 사용 흔적은 400으로 거부한다', async () => {
    await request(app.getHttpServer())
      .post('/usage')
      .send({ activeApp: '', observedAt: '2001-03-12T01:00:00Z' })
      .expect(400);
  });

  it('Notion 페이지의 편집 시각이 바뀔 때만 편집으로 저장한다', async () => {
    const sync = () =>
      request(app.getHttpServer()).post('/notion/sync').expect(200);

    // 한국 시간 2001-03-14 10:00에 편집된 페이지
    fakeNotion.pages = [
      {
        id: 'e2e-page',
        title: '정리 노트',
        lastEditedAt: '2001-03-14T01:00:00Z',
      },
    ];
    expect((await sync()).body).toEqual({ inserted: 1 });
    // 그 사이 편집이 없으면 같은 시각이 다시 오고, 저장하지 않는다.
    expect((await sync()).body).toEqual({ inserted: 0 });
    // 다시 편집되면 시각이 바뀐다.
    fakeNotion.pages = [
      {
        id: 'e2e-page',
        title: '정리 노트 v2',
        lastEditedAt: '2001-03-14T01:10:00Z',
      },
    ];
    expect((await sync()).body).toEqual({ inserted: 1 });

    const range = await request(app.getHttpServer())
      .get('/activity/range')
      .query({ from: '2001-03-14', to: '2001-03-14' })
      .expect(200);
    expect(ActivityRangeSchema.parse(range.body).blocks).toEqual([
      { date: '2001-03-14', index: 20, sources: ['notion'] },
    ]);

    const res = await request(app.getHttpServer())
      .get('/activity/recap')
      .query({ at: '2001-03-14T02:00:00Z' })
      .expect(200);
    expect(ActivityRecapResponseSchema.parse(res.body).recap).toMatchObject({
      startedAt: '2001-03-14T01:00:00.000Z',
      endedAt: '2001-03-14T01:10:00.000Z',
      notionEdits: 2,
      lastNotionPage: '정리 노트 v2',
    });

    const status = await request(app.getHttpServer())
      .get('/notion/sync')
      .expect(200);
    expect(status.body).toMatchObject({ enabled: true, lastError: null });
  });

  it('저장된 커밋의 상세를 돌려주고, 저장되지 않은 커밋은 404다', async () => {
    const res = await request(app.getHttpServer())
      .get('/github/commits/s4')
      .expect(200);
    expect(CommitDetailSchema.parse(res.body)).toMatchObject({
      repo: 'e2e-test/dashboard',
      sha: 's4',
      message: '전체 메시지 (e2e-test/dashboard)\n\n본문',
      additions: 12,
      deletions: 3,
      files: [{ path: 'src/main.ts', status: 'modified' }],
    });

    await request(app.getHttpServer())
      .get('/github/commits/not-stored')
      .expect(404);
  });

  it('편집이 저장된 Notion 페이지의 내용을 돌려주고, 그렇지 않은 페이지는 404다', async () => {
    await dataSource.query(
      `INSERT INTO notion_events (page_id, page_title, edited_at)
       VALUES ('e2e-detail', '정리 노트', '2001-03-15T01:00:00Z')`,
    );
    const res = await request(app.getHttpServer())
      .get('/notion/pages/e2e-detail')
      .expect(200);
    expect(NotionPageDetailSchema.parse(res.body)).toMatchObject({
      pageId: 'e2e-detail',
      title: '정리 노트',
      blocks: [
        { type: 'heading_1', text: '오늘 한 일', checked: null },
        { type: 'to_do', text: '모듈 구조 정리', checked: true },
      ],
      truncated: false,
    });

    await request(app.getHttpServer())
      .get('/notion/pages/not-stored')
      .expect(404);
  });

  it('기간의 흔적을 작업 구간으로 묶고 가장 많이 한 것을 센다', async () => {
    // 2001-03-10 KST: 00:10 커밋 / (30분 넘는 간격) / 09:10·09:20 커밋 + 09:25 캡처 / 12:05 캡처
    const res = await request(app.getHttpServer())
      .get('/activity/log')
      .query({ from: '2001-03-10', to: '2001-03-10' })
      .expect(200);
    const log = WorkLogSchema.parse(res.body);

    expect(
      log.sessions.map((session) => [
        session.startedAt,
        session.endedAt,
        session.commits,
        session.captures,
      ]),
    ).toEqual([
      ['2001-03-10T03:05:00.000Z', '2001-03-10T03:05:00.000Z', 0, 1],
      ['2001-03-10T00:10:00.000Z', '2001-03-10T00:25:00.000Z', 2, 1],
      ['2001-03-09T15:10:00.000Z', '2001-03-09T15:10:00.000Z', 1, 0],
    ]);
    expect(log.sessions.every((s) => s.date === '2001-03-10')).toBe(true);
    expect(log.top.repos).toEqual([{ name: 'e2e-test/dashboard', count: 3 }]);
  });

  it('구간마다 쓴 앱과 주로 본 화면을 사용 시간순으로 돌려준다', async () => {
    await clearUsage();
    const rows = [
      ['Code', 'main.ts', '2001-03-16T01:00:00Z'],
      ['Code', 'main.ts', '2001-03-16T01:01:00Z'],
      ['Code', 'app.module.ts', '2001-03-16T01:02:00Z'],
      ['Notion', '정리 노트', '2001-03-16T01:03:00Z'],
      ['Google Chrome', '개인적인 탭 제목', '2001-03-16T01:04:00Z'],
      ['Google Chrome', '개인적인 탭 제목', '2001-03-16T01:05:00Z'],
      ['Google Chrome', '개인적인 탭 제목', '2001-03-16T01:06:00Z'],
      ['Google Chrome', '(1) 어떤 영상 - YouTube', '2001-03-16T01:07:00Z'],
      ['Google Chrome', '다른 영상 - YouTube', '2001-03-16T01:08:00Z'],
    ];
    for (const [activeApp, windowTitle, observedAt] of rows) {
      await request(app.getHttpServer())
        .post('/usage')
        .send({ activeApp, windowTitle, observedAt })
        .expect(201);
    }
    const res = await request(app.getHttpServer())
      .get('/activity/log')
      .query({ from: '2001-03-16', to: '2001-03-16' })
      .expect(200);
    const log = WorkLogSchema.parse(res.body);

    expect(log.sessions).toHaveLength(1);
    // 앱 이름과 시간은 브라우저도 나온다.
    expect(log.sessions[0]).toMatchObject({
      usageMinutes: 9,
      apps: [
        { name: 'Google Chrome', minutes: 5 },
        { name: 'Code', minutes: 3 },
        { name: 'Notion', minutes: 1 },
      ],
    });
    // 작업 도구는 창 제목 그대로, 브라우저는 탭 제목 대신 사이트 이름으로 묶여 나온다.
    // 이름을 모르는 사이트는 "기타 사이트"로 묶이고 맨 뒤에 온다.
    expect(log.sessions[0].screens).toEqual([
      { app: 'Code', title: 'main.ts', minutes: 2, distraction: false },
      { app: 'Google Chrome', title: 'YouTube', minutes: 2, distraction: true },
      { app: 'Code', title: 'app.module.ts', minutes: 1, distraction: false },
      { app: 'Notion', title: '정리 노트', minutes: 1, distraction: false },
      {
        app: 'Google Chrome',
        title: '기타 사이트',
        minutes: 3,
        distraction: false,
      },
    ]);
    expect(log.top.apps).toEqual([
      { name: 'Google Chrome', minutes: 5 },
      { name: 'Code', minutes: 3 },
      { name: 'Notion', minutes: 1 },
    ]);
    expect(log.top.sites).toEqual([
      { name: '기타 사이트', minutes: 3, distraction: false },
      { name: 'YouTube', minutes: 2, distraction: true },
    ]);
    // 어디에도 탭 제목은 나오지 않는다.
    expect(JSON.stringify(res.body)).not.toContain('어떤 영상');
    expect(JSON.stringify(res.body)).not.toContain('개인적인 탭 제목');
    // 가려도 DB에는 그대로 남아 있다.
    const [{ count }] = await dataSource.query(
      `SELECT count(*)::int AS count FROM app_usage
       WHERE window_title = '개인적인 탭 제목'`,
    );
    expect(count).toBe(3);
  });

  it('하루의 개별 작업에는 커밋·Notion 편집과 함께 캡처도 들어간다', async () => {
    const res = await request(app.getHttpServer())
      .get('/activity/log/items')
      .query({ date: '2001-03-10' })
      .expect(200);
    const { items } = WorkItemsSchema.parse(res.body);

    expect(items.map((item) => [item.kind, item.title, item.detail])).toEqual([
      ['capture', 'break', null],
      ['capture', 'blocked', 'Code — main.ts'],
      ['commit', '아침 커밋 2', 'e2e-test/dashboard'],
      ['commit', '아침 커밋 1', 'e2e-test/dashboard'],
      ['commit', '자정 직후 커밋', 'e2e-test/dashboard'],
    ]);
  });

  it('동기화하면 커밋을 저장하고, 다시 해도 중복 저장하지 않는다', async () => {
    // 복귀 요약도 조회 전에 동기화를 돌리므로, 앞선 테스트가 넣은 것을 지우고 시작한다.
    await dataSource.query(
      `DELETE FROM repos WHERE github_full_name = 'e2e-test/synced'`,
    );

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
