# ADHD-irection

집중력·단기 작업 기억이 약한 사용자(본인) 전용 개인 프로젝트. 코딩·학습·작업 전환 패턴을 분석하고, 인터럽트가 발생한 순간의 맥락을 저마찰로 캡처한다.

## 현재 상태

- 기획·기술 스택 확정, 모노레포 스캐폴딩 완료 (각 앱은 생성기 기본 템플릿 상태, 기능 코드는 아직 없음).
- 한 번에 켜고 끄기: `pnpm start`(DB + API + 웹 + 데스크톱. Ctrl+C 또는 메뉴바 아이콘 → 종료로 DB까지 전부 꺼짐) / `pnpm stop`(따로 띄운 것까지 전부 종료). API dev 서버의 watch가 가끔 소스 변경을 다시 빌드하지 않고 멈춤(원인 미확인, `pnpm build` 없이도 발생) — 새 라우트가 404면 `pnpm stop` 후 다시 시작
- 개별 실행: `pnpm dev`(DB 제외 전체) / `pnpm dev:api`(4000) / `pnpm dev:web`(3000) / `pnpm dev:desktop`(Rust 툴체인 필요, API가 떠 있어야 저장됨)
- 데스크톱 캡처 트리거 두 가지 구현됨: 수동(Option+Shift+C 또는 메뉴바 아이콘 → 캡처), 자동(유휴 20분→복귀). Dock에는 안 뜨고 메뉴바에 상주하며 종료는 메뉴바 아이콘 → 종료. 캡처 창 위쪽에 복귀 요약(직전 작업 구간의 시간·커밋 수·마지막 커밋·보던 화면)이 뜸. 캡처마다 계기(`trigger_type`)와 직전에 쓰던 앱(`active_app`)을 함께 저장하고, 창 제목(`window_title`)은 macOS 화면 기록 권한이 있을 때만 채워짐(개발 빌드는 터미널 권한을 물려받고, 배포용 앱은 시스템 설정 → 화면 및 시스템 오디오 녹음에 앱을 직접 추가해야 함)(터미널에 `[capture]` 로그 출력). 자리에 있는 동안 1분마다 맨 앞 앱을 사용 흔적으로 저장(터미널에 `[usage]` 로그). 자동 트리거 확인은 `pnpm dev:desktop:idle10`(유휴 임계값과 사용 흔적 주기 모두 10초, 터미널에 `[idle]` 로그 출력). Rust 테스트는 `apps/desktop/src-tauri`에서 `cargo test`. 검증: `pnpm typecheck && pnpm build && pnpm test && pnpm lint`
- 인증: 웹은 카카오 로그인(처음 로그인한 계정이 주인으로 등록되고 그 계정만 허용), 데스크톱 앱은 `x-api-key`. API의 모든 라우트는 기본이 인증 필요이고 `@Public()`만 열림. 필요한 값은 `apps/api/.env.example`의 인증 항목과 `apps/desktop/.env.example` 참고 (`SESSION_SECRET`, `DESKTOP_API_KEY`, `KAKAO_REST_API_KEY`, `KAKAO_CLIENT_SECRET`). e2e는 `auth.e2e-spec.ts`만 실제 가드를 쓰고 나머지는 통과시킴
- DB: 초기 스키마 마이그레이션 작성 완료 (`apps/api/src/database/migrations/`). 로컬 실행은 `pnpm db:up`(Docker 필요) → `apps/api/.env.example`을 `.env`로 복사 → `pnpm db:migrate`. Nest 앱은 `TypeOrmModule`로 DB에 연결됨(`GET /health`로 확인). 기능 모듈은 `captures`(`POST /captures` 임시 유저로 저장, `GET /captures` 최신순 조회, `after`/`before`로 기간 지정), `github`(5분마다 내 커밋을 `github_events`에 동기화, `POST /github/sync`로 즉시 실행, `GET /github/sync`로 상태 조회, `GET /github/commits/:sha`로 커밋 상세 조회, `apps/api/.env`의 `GITHUB_TOKEN` 필요), `notion`(2분마다 통합에 공유된 페이지의 편집을 `notion_events`에 동기화, `POST /notion/sync`, `GET /notion/pages/:pageId`로 페이지 현재 내용 조회, `apps/api/.env`의 `NOTION_TOKEN` 필요), `usage`(`POST /usage` — 데스크톱이 1분마다 보내는 맨 앞 앱 "사용 흔적", 작업용 앱 목록은 `WORK_APPS`. 창 제목은 전부 저장하되 API 응답에는 작업 도구의 것만 내보냄 — `TITLE_VISIBLE_APPS`, `apps/api/src/usage/visibility.ts`. 브라우저는 탭 제목 대신 사이트 이름(YouTube 등)만 — `apps/api/src/usage/sites.ts`), `activity`(`GET /activity/dashboard`, `GET /activity/range` — 커밋+캡처+Notion 편집+작업용 앱 사용 흔적을 30분 칸 "작업 블록"으로 집계, `GET /activity/recap` — 가장 최근에 이어서 작업한 구간 요약). 웹은 Claude Design 캔버스 "화이트 & 그린" 디자인을 따르며(색·그림자 토큰은 `apps/web/src/app/globals.css`, 라이트 테마만) `/`에 작업 흔적 화면(오늘 / 이번 주 / 이번 달 / 올해 탭, 주는 일요일 시작, 오늘 탭의 최근 작업은 커밋과 Notion 편집을 섞어 보여주고 줄을 누르면 상세가 펼쳐짐), `/work`에 작업 기록 화면(기간별 작업 구간·많이 한 작업·개별 작업 통합 조회, `GET /activity/log`), `/captures`에 캡처 기록 화면(오늘 / 이번 주 / 이번 달 / 날짜 선택, 상태 필터)이 있음(`pnpm dev:api`가 떠 있어야 함). API e2e 테스트(`pnpm --filter @adhd-irection/api test:e2e`)는 로컬 DB가 떠 있어야 함
- 확정된 스택 전체와 선택 이유: @docs/tech-stack.md
- 결정이 바뀐 과정과 실측 데이터 근거(커밋 1,375건 분석 등) — 필요할 때만 `docs/decision-log.md` 열어볼 것. 매 세션 자동 로드 대상 아님.

## 아키텍처 한눈에

- **데스크톱 캡처**: Tauri (React/TS UI + Rust 셸) — idle 20분→resume 자동 트리거 + 전역 단축키 수동 트리거
- **웹/모바일**: Next.js PWA (`apps/web`) — 캡처 외 모든 화면(대시보드, 기록 조회, PDF 업로드, 이동 중 캡처). 맥 브라우저와 폰에서 같이 사용 (Expo 아님 — Apple Developer Program 불필요)
- **백엔드**: NestJS
- **DB**: PostgreSQL + TypeORM — 마이그레이션은 raw SQL 직접 작성, 자동생성 금지 (SQL 학습이 목적)
- **모노레포**: pnpm workspaces — `apps/web`, `apps/desktop`, `apps/api`, `packages/shared-types`. Turborepo는 아직 도입 안 함(보류)
- **배포**: Vercel(PWA, 무료) + Railway(API, $5/월 고정) + Neon(Postgres, 무료) + GitHub Actions(CI/CD, public repo라 전부 무료)

## 지금 할 일 (우선순위 순)

핵심 기획(작업 흔적 표시 + 작은 보상)의 단계 — `docs/decision-log.md` 23절:

1. 배포 (Vercel + Railway + Neon) — 코드 쪽 준비는 끝남(`apps/api/Dockerfile`, `railway.json`, 데스크톱 `.env.production`). 남은 것은 각 서비스에서 레포 연결과 환경변수 입력. 순서는 `docs/deploy.md`
2. API 배포 후 GitHub/Notion 웹훅 전환
3. 음성 메모 캡처 + 비동기 STT

## 작업 규칙

- `packages/shared-types`는 빌드 없이 소스(`.ts`)를 직접 노출한다 — enum/namespace 금지, 상대 import에 `.ts` 확장자 필수 (`docs/decision-log.md` 16절).
- DB 마이그레이션은 TypeORM 자동생성 대신 반드시 raw SQL로 직접 작성한다.
- 새 아키텍처 결정은 `docs/tech-stack.md`에 반영하고, 바뀐 이유는 `docs/decision-log.md`에 이어서 기록한다 (기존 결정 히스토리를 덮어쓰지 않음).
- git author/committer는 `Keunjae <zeus990506@gmail.com>`로 유지한다. Claude/AI 관련 attribution을 커밋에 넣지 않는다.
- 비용 상한선: 월 $0~5 유지가 목표. NAT Gateway를 실무처럼 켜는 순간부터 "미니 프로젝트 범위 초과"로 판단 (`docs/tech-stack.md` 비용 상한선 원칙 참고).
