import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types.js';
import { DataSource } from 'typeorm';
import { AppModule } from './../src/app.module.js';
import { KakaoClient } from './../src/auth/kakao.client.js';
import { signToken } from './../src/auth/session.js';

const TEMP_USER_ID = '00000000-0000-4000-8000-000000000001';
const SESSION_SECRET = 'e2e-session-secret';
const DESKTOP_API_KEY = 'e2e-desktop-key';
const WEB_URL = 'http://web.test';

// 실제 카카오를 부르지 않도록 바꿔 끼우는 가짜 클라이언트. 인가 코드가 곧 카카오 계정 ID다.
const fakeKakao = {
  authorizeUrl: (state: string) =>
    `https://kauth.kakao.com/oauth/authorize?state=${encodeURIComponent(state)}`,
  getUser: async (code: string) => {
    if (code === 'broken') throw new Error('카카오 오류');
    return { id: code, nickname: '주인' };
  },
};

// 로컬 Postgres(pnpm db:up + pnpm db:migrate)가 떠 있어야 한다.
describe('인증 (e2e)', () => {
  let app: INestApplication<App>;
  let dataSource: DataSource;
  let original: { kakao_id: string | null; name: string };
  const env = { ...process.env };

  beforeAll(async () => {
    Object.assign(process.env, {
      SESSION_SECRET,
      DESKTOP_API_KEY,
      KAKAO_REST_API_KEY: 'e2e-rest-key',
      WEB_URL,
    });
    const moduleFixture = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(KakaoClient)
      .useValue(fakeKakao)
      .compile();
    app = moduleFixture.createNestApplication();
    await app.init();
    dataSource = app.get(DataSource);

    // 실제 주인 등록을 건드리지 않도록 잠시 비워 두고, 끝나면 되돌린다.
    [original] = await dataSource.query(
      `SELECT kakao_id, name FROM users WHERE id = $1`,
      [TEMP_USER_ID],
    );
    await dataSource.query(`UPDATE users SET kakao_id = NULL WHERE id = $1`, [
      TEMP_USER_ID,
    ]);
  });

  afterAll(async () => {
    await dataSource.query(
      `UPDATE users SET kakao_id = $2, name = $3 WHERE id = $1`,
      [TEMP_USER_ID, original.kakao_id, original.name],
    );
    await app.close();
    process.env = env;
  });

  /** 카카오 로그인 화면으로 보내는 주소에서 state를 꺼낸다. */
  async function startLogin(): Promise<string> {
    const res = await request(app.getHttpServer())
      .get('/auth/kakao')
      .expect(302);
    return new URL(res.headers.location).searchParams.get('state')!;
  }

  /** 카카오에서 돌아온 것처럼 콜백을 부르고, 웹으로 보내는 주소를 돌려준다. */
  async function finishLogin(code: string, state: string): Promise<URL> {
    const res = await request(app.getHttpServer())
      .get('/auth/kakao/callback')
      .query({ code, state })
      .expect(302);
    return new URL(res.headers.location);
  }

  it('로그인하지 않으면 401이고, 상태 확인은 열려 있다', async () => {
    await request(app.getHttpServer()).get('/captures').expect(401);
    await request(app.getHttpServer()).get('/activity/dashboard').expect(401);
    await request(app.getHttpServer())
      .post('/usage')
      .send({ activeApp: 'Code' })
      .expect(401);
    await request(app.getHttpServer()).get('/health').expect(200);
  });

  it('데스크톱 앱의 키가 맞으면 통과하고, 틀리면 401이다', async () => {
    await request(app.getHttpServer())
      .get('/captures')
      .set('x-api-key', DESKTOP_API_KEY)
      .expect(200);
    await request(app.getHttpServer())
      .get('/captures')
      .set('x-api-key', 'wrong-key')
      .expect(401);
  });

  it('처음 로그인한 카카오 계정이 주인이 되고, 받은 세션 토큰으로 통과한다', async () => {
    const redirect = await finishLogin('kakao-owner', await startLogin());

    expect(redirect.origin + redirect.pathname).toBe(
      `${WEB_URL}/auth/callback`,
    );
    const token = redirect.searchParams.get('token')!;
    const me = await request(app.getHttpServer())
      .get('/auth/me')
      .set('authorization', `Bearer ${token}`)
      .expect(200);
    expect(me.body).toEqual({ id: TEMP_USER_ID, name: '주인' });

    const [user] = await dataSource.query(
      `SELECT kakao_id FROM users WHERE id = $1`,
      [TEMP_USER_ID],
    );
    expect(user.kakao_id).toBe('kakao-owner');

    // 주인은 다시 로그인할 수 있다.
    const again = await finishLogin('kakao-owner', await startLogin());
    expect(again.searchParams.get('token')).toBeTruthy();
  });

  it('주인이 아닌 카카오 계정은 로그인할 수 없다', async () => {
    const redirect = await finishLogin('kakao-stranger', await startLogin());
    expect(redirect.toString()).toBe(`${WEB_URL}/login?error=forbidden`);
  });

  it('이 서버가 시작하지 않은 로그인(state 불일치)은 받지 않는다', async () => {
    const forged = await finishLogin('kakao-owner', 'forged-state');
    expect(forged.toString()).toBe(`${WEB_URL}/login?error=state`);

    // 세션 토큰을 state로 재사용할 수도 없다.
    const session = signToken(TEMP_USER_ID, 60_000, SESSION_SECRET);
    const reused = await finishLogin('kakao-owner', session);
    expect(reused.toString()).toBe(`${WEB_URL}/login?error=state`);
  });

  it('동의를 취소했거나 카카오 호출이 실패하면 로그인 화면으로 돌려보낸다', async () => {
    const cancelled = await request(app.getHttpServer())
      .get('/auth/kakao/callback')
      .query({ error: 'access_denied' })
      .expect(302);
    expect(cancelled.headers.location).toBe(`${WEB_URL}/login?error=cancelled`);

    const failed = await finishLogin('broken', await startLogin());
    expect(failed.toString()).toBe(`${WEB_URL}/login?error=kakao`);
  });

  it('위조하거나 만료된 세션 토큰은 401이다', async () => {
    const valid = signToken(TEMP_USER_ID, 60_000, SESSION_SECRET);
    const [data] = valid.split('.');
    const call = (token: string) =>
      request(app.getHttpServer())
        .get('/auth/me')
        .set('authorization', `Bearer ${token}`);

    await call(valid).expect(200);
    // 서명만 바꾼 것
    await call(`${data}.AAAA`).expect(401);
    // 다른 키로 서명한 것
    await call(signToken(TEMP_USER_ID, 60_000, 'other-secret')).expect(401);
    // 만료된 것
    await call(signToken(TEMP_USER_ID, -1, SESSION_SECRET)).expect(401);
  });
});
