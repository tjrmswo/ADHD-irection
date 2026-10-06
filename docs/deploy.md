# 배포 안내

> 웹은 Vercel, API는 Railway, DB는 Neon에 올린다. 데스크톱 앱은 배포하지 않고 맥에 설치해 쓰며, 저장하는 주소만 배포한 API로 바꾼다. 선택 이유는 `tech-stack.md`, 결정 과정은 `decision-log.md` 30절.

```
폰·맥 브라우저 ──▶ Vercel(웹) ──▶ Railway(API) ──▶ Neon(DB)
맥의 데스크톱 앱 ────────────────▶ Railway(API)
                                  Railway(API) ──▶ GitHub, Notion, 카카오
```

세 서비스 모두 GitHub 레포를 연결해 두면 `main`에 병합할 때마다 자동으로 다시 배포된다.

## 순서

아래 순서를 지킨다. 뒤 단계가 앞 단계에서 나온 주소를 쓴다.

### 1. Neon — 데이터베이스

1. https://neon.tech 에서 프로젝트를 만든다. 지역은 가까운 곳(싱가포르 등), Postgres 버전은 17.
2. 대시보드의 **Connection string**을 복사한다. `postgresql://…?sslmode=require` 모양이다. 이것이 `DATABASE_URL`이다.

표는 따로 만들지 않아도 된다. API가 처음 뜰 때 마이그레이션을 돌려서 만든다.

### 2. Railway — API 서버

1. https://railway.com 에서 **New Project → Deploy from GitHub repo**로 이 레포를 고른다.
2. 빌드 설정은 건드리지 않는다. 레포 루트의 `railway.json`이 `apps/api/Dockerfile`로 빌드하고 `/health`로 상태를 확인하게 해 둔다.
3. **Variables**에 아래 값을 넣는다.

| 이름 | 값 |
|---|---|
| `DATABASE_URL` | 1단계에서 복사한 Neon 연결 문자열 |
| `SESSION_SECRET` | 새로 만든 긴 임의의 값 (`openssl rand -base64 48`). 로컬과 다른 값 |
| `DESKTOP_API_KEY` | 새로 만든 임의의 값 (`openssl rand -base64 32`). 로컬과 다른 값 |
| `KAKAO_REST_API_KEY` | 카카오 콘솔의 REST API 키 |
| `KAKAO_CLIENT_SECRET` | 카카오 콘솔의 클라이언트 시크릿 |
| `KAKAO_REDIRECT_URI` | `https://<Railway 주소>/auth/kakao/callback` |
| `WEB_URL` | `https://<Vercel 주소>` (4단계 뒤에 채운다) |
| `GITHUB_TOKEN` | GitHub 개인 액세스 토큰 (private 레포를 읽으려면 `repo` 권한) |
| `NOTION_TOKEN` | Notion 통합의 내부 시크릿 |

4. **Settings → Networking → Generate Domain**으로 공개 주소를 만든다. 이것이 `<Railway 주소>`다.
5. 배포가 끝나면 `https://<Railway 주소>/health`가 `{"status":"ok","db":"up"}`을 돌려주는지 확인한다.

`GITHUB_TOKEN`은 로컬에서 쓰던 `gh auth token` 값 대신, GitHub 설정에서 따로 만든 토큰을 쓴다. gh 명령의 토큰은 그 명령에서 로그아웃하면 못 쓰게 된다.

### 3. 카카오 콘솔

1. 카카오 로그인 → **Redirect URI**에 `https://<Railway 주소>/auth/kakao/callback`을 추가한다. 로컬용 `http://localhost:4000/auth/kakao/callback`은 그대로 둔다.
2. 앱 설정 → 플랫폼 → **Web 사이트 도메인**에 `https://<Vercel 주소>`를 추가한다.

### 4. Vercel — 웹

1. https://vercel.com 에서 **Add New → Project**로 이 레포를 고른다.
2. **Root Directory**를 `apps/web`으로 지정한다. 나머지 빌드 설정은 자동으로 잡힌다.
3. **Environment Variables**에 두 값을 넣는다. 둘 다 같은 주소다.

| 이름 | 값 |
|---|---|
| `API_URL` | `https://<Railway 주소>` |
| `NEXT_PUBLIC_API_URL` | `https://<Railway 주소>` |

4. 배포가 끝나면 나온 주소가 `<Vercel 주소>`다. Railway의 `WEB_URL`에 이 주소를 넣고 Railway를 다시 배포한다.

### 5. 로그인 확인과 주인 등록

`https://<Vercel 주소>`를 열어 카카오로 로그인한다. **배포한 DB는 비어 있으므로 처음 로그인한 계정이 주인으로 등록된다.** 주소를 다른 사람에게 알리기 전에 본인이 먼저 로그인한다.

로컬 데이터를 옮길 계획이면(6단계) 로그인 전에 옮긴다. 옮긴 데이터에 주인 등록이 이미 들어 있다.

### 6. 로컬 데이터를 Neon으로 옮기기 (한 번만)

지금까지의 캡처, 사용 흔적, 주인 등록은 맥의 DB에만 있다. 옮기지 않으면 배포한 화면은 빈 상태로 시작한다(커밋과 Notion 편집은 다시 동기화된다).

```bash
pnpm db:up
# 맥의 DB를 파일로 내보낸다 (데이터만, 표 구조는 API의 마이그레이션이 만든다)
docker exec adhd-irection-postgres-1 pg_dump -U adhd -d adhd_irection \
  --data-only --exclude-table=migrations > local-data.sql
# Neon에 넣는다. 먼저 2단계까지 끝내서 Neon에 표가 만들어져 있어야 한다
psql "<Neon 연결 문자열>" -c "DELETE FROM users"   # 마이그레이션이 넣은 임시 유저를 비운다
psql "<Neon 연결 문자열>" -f local-data.sql
rm local-data.sql   # 개인 기록이 담긴 파일이니 남기지 않는다
```

`local-data.sql`에는 창 제목을 포함한 개인 기록이 그대로 들어 있다. 레포 폴더 밖에서 만들거나, 쓰고 바로 지운다.

### 7. 데스크톱 앱이 배포한 API로 저장하게 하기

1. `apps/desktop/.env.production` 파일을 만든다 (gitignore 대상).

```
VITE_API_URL=https://<Railway 주소>
VITE_API_KEY=<Railway의 DESKTOP_API_KEY와 같은 값>
```

2. 배포용 앱을 다시 빌드하고 연다.

```bash
pnpm --filter @adhd-irection/desktop tauri build --bundles app
open apps/desktop/src-tauri/target/release/bundle/macos/ADHD-irection.app
```

3. 창 제목까지 기록하려면 시스템 설정 → 개인정보 보호 및 보안 → 화면 및 시스템 오디오 녹음에서 앱을 다시 허용한다 (다시 빌드하면 권한이 풀린다).

개발용(`pnpm start`)은 `.env`만 읽으므로 계속 로컬 API와 로컬 DB를 쓴다. **배포용 앱과 개발용 앱을 동시에 켜 두면 사용 흔적이 양쪽에 따로 쌓인다.**

## 배포 후 달라지는 것

- **웹과 API의 주소가 다르다.** 그래서 세션 쿠키는 웹(Vercel)이 자기 주소에 심고, 웹 서버가 API를 부를 때 토큰을 붙인다 (`decision-log.md` 29절).
- **DB의 표시 시간대는 UTC다.** 로컬 Docker만 `Asia/Seoul`로 맞춰 둔 것이라, Neon의 SQL 편집기에서는 시각이 9시간 이르게 보인다. 저장된 값과 화면 표시는 그대로다.
- **동기화는 Railway에서 돈다.** GitHub 5분, Notion 2분 주기. 맥이 꺼져 있어도 커밋과 Notion 편집은 쌓인다. 사용 흔적과 캡처는 맥의 데스크톱 앱이 켜져 있을 때만 쌓인다.

## 문제가 생기면

| 증상 | 볼 곳 |
|---|---|
| Railway 배포가 실패 | Deploy Logs. 마이그레이션이 실패하면 서버가 뜨지 않게 해 두었다 |
| 로그인 버튼을 누르면 카카오 오류 (KOE006 등) | 카카오 콘솔의 Redirect URI가 `KAKAO_REDIRECT_URI`와 글자 하나까지 같은지 |
| 로그인 후 다시 로그인 화면 | Railway의 `WEB_URL`이 Vercel 주소와 같은지, Vercel의 `API_URL`이 Railway 주소인지 |
| "이 앱의 주인으로 등록된 카카오 계정이 아니에요" | 다른 계정이 먼저 주인으로 등록됨. Neon에서 `UPDATE users SET kakao_id = NULL` 후 본인이 다시 로그인 |
| 데스크톱 앱의 기록이 배포 화면에 안 보임 | `.env.production`의 주소와 키, 배포용 앱을 다시 빌드했는지 |
