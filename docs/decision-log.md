# ADHD-irection 기획 결정 로그

> ADHD(추정) 성향으로 인한 집중력·단기 작업 기억 저하를 돕기 위한 개인 작업 패턴 분석 앱.
> 이 문서는 최초 기획부터 어떤 근거로 방향이 바뀌었는지 그 흐름을 그대로 남긴다. 최신 상태만 보려면 8번으로 바로 이동.

---

## 1. 초기 기획 (v1)

**기술 스택**
- **프레임워크**: Expo (React Native) — 기존 Next.js / TypeScript / React Query / Zustand / FSD 아키텍처를 그대로 재사용 가능
- **백엔드**: Next.js API Route + Supabase

**패턴 분석 아이디어**
- OS 레벨 사용량 API 대신 **앱 자체 행동 로그**(포모도로 세션, `AppState` 백그라운드 전환, 작업 유형 전환 빈도)를 1차 신호로 사용
- Android는 `UsageStatsManager`를 선택적 기능으로, iOS는 `DeviceActivity` 계열 API가 3rd-party 앱으로 사용 데이터를 넘겨주지 않는 구조적 제약이 있어 처음부터 기대하지 않기로 함

**외부 데이터 연동**
- GitHub API + Webhook — 커밋 타임스탬프를 코딩 리듬 신호로 사용
- Notion API + Webhook — 페이지 편집 이력 동기화

**학습 노트(태블릿) 연동**
- 태블릿 작업(갤럭시 기본 Notes 앱)은 서드파티 API가 없어 자동 연동이 불가능함을 확인
- → **오늘 공부한 내용을 PDF로 export해서 앱에 직접 업로드**하는 방식으로 확정 (`expo-document-picker`, 텍스트는 `pdf-parse`, 손글씨는 비전 모델 fallback)

---

## 2. 방향 재검토 — "모바일 중심 구조가 맞나?"

여기까지 설계한 핵심 기능은 **"인터럽트가 발생한 순간을 낮은 마찰로 캡처"** 하는 것이었다. 그런데 다시 보니 구조적 문제가 있었다:

- 실제 작업 전환(코딩 ↔ Notion ↔ 브라우저)은 **MacBook에서** 일어난다
- 그런데 감지 로직으로 설계했던 `AppState` 앱 전환 감지는 **모바일 앱 안에서만** 작동한다 — 폰으로 다른 앱을 켜고 끄는 걸 감지하는 것이지, 맥에서 VSCode를 나가고 Notion을 켜는 걸 감지하는 게 아니다
- 즉 "인터럽트 순간을 낚아채는" 핵심 기능이 모바일 앱만으로는 애초에 성립하지 않는 지점이었다

### 검토했던 선택지

| 안 | 내용 |
|---|---|
| A. 데스크톱 캡처 + 모바일 보조 | 맥에서 캡처 도구를 만들고, 모바일은 이동 중 캡처·리뷰·PDF 업로드만 담당 |
| B. 모바일 유지, 자동감지 포기 | 자동 트리거 없이 정시/랜덤 알림으로 다운그레이드 |
| C. 트리거 보류 | 캡처 설계는 미루고 리뷰·업로드 기능부터 구현 |

**→ A안 채택.** 실제 작업이 일어나는 위치에 캡처 도구를 두는 게 근본적으로 맞다고 판단.

---

## 3. 재구성 (v2) — 데스크톱 캡처 + 모바일 보조

**데스크톱 캡처 앱: Tauri 메뉴바 앱**
- UI는 React/TypeScript 그대로 작성 (기존 스택 재사용), Rust는 트레이 아이콘·전역 단축키·백그라운드 상주 정도만 담당
- Electron보다 가볍고 배포 부담이 적음

**재정리된 구조**

| 구성 요소 | 역할 |
|---|---|
| 데스크톱 캡처 앱 (Tauri) | 실제 작업 전환 순간의 저마찰 캡처 (신규) |
| 모바일 앱 (Expo) | 이동 중 캡처, 학습노트 PDF 업로드, 패턴 대시보드 리뷰 |
| 백엔드 (Next.js API + Supabase) | 공통 캡처 API, GitHub/Notion 웹훅 수신, 패턴 분석 |

두 클라이언트가 캡처 API 하나를 공유하는 구조.

---

## 4. ADHD 특성 분석 — 왜 "인터럽트 캡처"가 핵심 기능인가

기획 방향을 잡기 위해 ADHD 관련 어려움을 정리했다:

1. **작업 개시 마찰 (Task Initiation)** — 시작하는 순간의 심리적 저항이 큼
2. **작업 기억 붕괴 (Working Memory)** — 인터럽트가 끼면 이전 맥락이 통째로 날아감
3. **시간맹 (Time Blindness)** — 시간 경과에 대한 내적 감각이 약함
4. **인터럽트 이후 복귀 비용** — 전환 자체보다 "원래 맥락으로 돌아오는 것"이 훨씬 비쌈
5. **눈에 안 보이면 존재하지 않는 것 (Object Permanence)** — 기록해둬도 시야 밖으로 나가면 인지에서 사라짐

→ 2번(작업 기억)과 4번(복귀 비용)이 "집중력·단기 작업 기억" 문제와 정확히 겹침. 그래서 **"이탈 후 복귀 시점에 방금 하던 일의 맥락을 남기는 기능"**을 앱의 핵심으로 잡기로 함 — 사후 분석용 대시보드가 아니라, 매일 실제로 도움이 되는 기능.

---

## 5. 캡처 마찰 문제와 해결

기존에 쓰던 할일 앱의 문제: 직접 타이핑해야 해서 일이 몰릴 때일수록 기록을 포기하게 됨.

**해결 — 타이핑 없는 캡처**
- **1순위: 음성 메모** — 원탭 녹음 5~15초 → 비동기 STT(Whisper/Claude API)로 나중에 텍스트화
- **2순위: 원탭 프리셋 태그** — "막힘" / "거의 다 함" / "전환함" / "휴식" 등 버튼 하나로 끝
- **보조: 자동 컨텍스트 추론** — 캡처 시점의 활성 앱 정보를 자동 기록해서 사용자 입력이 없어도 최소한의 흔적은 남김

---

## 6. 실측 데이터 분석 — 실제 작업 패턴

"트리거를 언제 발생시킬지"를 감으로 정하지 않기 위해, MacBook에 로컬로 있는 실제 저장소 6개(`bon-ron`, `connecting-road-web`, `connectors-cluster-config`, `connectorsfrontend`, `portfolio`, `todo-api`)의 **커밋 이력 1,375건**을 직접 분석했다.

### 6-1. 시간대별 분포

![시간대별 커밋 분포](assets/hour-distribution.png)

특정 시간대에 몰리지 않고 하루 전체에 넓게 분산. 12시·16시·19시·23시에 국지적 피크, 05~06시·09~10시가 저점. **심야(23시~06시) 작업이 전체의 22.7%(312/1375건)** — 트리거를 "업무시간대만" 작동하게 만들면 안 된다는 근거.

### 6-2. 요일별 분포

![요일별 커밋 분포](assets/day-of-week-distribution.png)

일요일(311건)·월요일(245건)이 가장 많고 목요일(110건)이 가장 적음. 본업(비개발직) 평일보다 주말에 개인 프로젝트 작업이 몰리는 구조.

### 6-3. 세션 파편화 — 가장 중요한 발견

커밋 간 간격 60분을 기준으로 "연속 작업 세션"을 묶었을 때:

| 지표 | 값 |
|---|---|
| 총 세션 수 | 366개 |
| 세션당 평균 커밋 수 | 3.8개 |
| 세션 평균 길이 | 25.6분 |
| **세션 길이 중앙값** | **3.4분** |
| 2시간 넘는 세션 | 21개 (5.7%) |

![세션 길이 분포](assets/session-length-distribution.png)

평균(25.6분)과 중앙값(3.4분)의 큰 차이는 극소수의 긴 몰입 세션이 평균을 끌어올릴 뿐, **실제로는 짧은 작업 버스트가 대다수**임을 의미. "짧은 작업 기억, 지속적 집중의 어려움" 가설과 일치하는 실증 데이터.

### 6-4. 전환 패턴

- 한 세션(60분 이내) 안에서 저장소를 넘나든 비율: **22/366 = 6.0%**
- 하루 단위로 2개 이상 저장소를 건드린 날: **56/180일 = 31.1%**

→ 전환은 "그 순간 즉시"가 아니라 **시간 간격을 두고(휴식/다른 일 하고 돌아와서)** 일어난다는 뜻. 지난번 설계했던 "앱/저장소 전환 즉시 감지" 트리거보다, **"이탈 후 복귀 시점"**을 잡는 게 실제 패턴에 더 맞다는 근거.

### 6-5. Gap 분포로 찾은 임계값

커밋과 커밋 사이 간격(gap) 1,374개 전체의 분포:

![Gap 분포](assets/gap-distribution.png)

| 구간 | 비율 |
|---|---|
| 0~15분 | 52.3% |
| 15~30분 | 9.0% |
| 30~60분 | 6.3% |
| 1~2시간 | 4.9% |
| 2시간+ | 27.5% |

15~20분을 넘어가는 지점부터 밀도가 뚜렷하게 꺾인다. 즉 **15~20분 이내 간격은 자연스러운 소강(생각 정리, 문서 확인)**이고, 그걸 넘기면 실제 이탈일 가능성이 높다는 뜻. → 이 지점을 idle 판정 임계값(20분)으로 채택.

### 6-6. 최근 30일 (참고)

최근 30일 커밋은 26건뿐이고 오후 3~9시에만 몰려 있어 심야 작업이 없음 — 최근엔 좀 더 규칙적으로 바뀐 걸로 보이나 표본이 작아 확정하기는 이름.

---

## 7. 트리거 로직 최종안 (v2, 데이터 기반)

### 자동 트리거 — Idle → Resume (핵심)
- 시스템 유휴시간이 **20분 이상** 지속되면 "이탈 상태"로 판정 (근거: 6-5 gap 분포의 자연스러운 경계)
- 이탈 상태에서 키보드/마우스 입력이 재개되는 **복귀 순간**에 캡처 모달 자동 팝업
- 리밋: 직전 캡처로부터 20분 이내엔 재발생 안 함 (짧은 반복 이탈로 인한 알림 남발 방지)
- 시간대 제한 없음 (6-1 근거: 심야 작업 22.7%)

**폐기된 대안**: "앱/저장소 전환 즉시 감지". 실측상 한 시간 이내 저장소 전환은 6%뿐이고 전환 대부분이 텀을 두고 일어나므로(6-4), "전환의 순간"보다 "이탈 후 복귀의 순간"을 잡는 게 맞음.

### 수동 트리거 — 항상 보조로 유지
- 전역 단축키로 언제든 즉시 캡처
- 자동 감지가 못 잡는 케이스(20분 미만의 빠른 전환, 이탈 없이 바로 넘어가는 6% 케이스)를 사용자가 직접 커버

### 2단계 보류 — 활성 상태 전환 감지
- 이탈 없이 활성 창만 빠르게 바뀌는 경우까지 잡으려면 `NSWorkspace`/Accessibility 권한 기반 추적이 필요한데, 데이터상 이 케이스는 소수(6%)라 MVP에서는 제외. 실사용 데이터가 쌓이면 재검토.

### 기술 구현 메모 (Tauri)
- 유휴시간 측정: Rust `user-idle` 크레이트 (macOS는 IOKit `HIDIdleTime` 기반), 60초 주기 폴링
- 유휴 20분 도달 → 내부 상태 `idle` 전환 → idle time 리셋(활동 재개) 시점에 캡처 창 팝업
- 리밋 로직: 마지막 캡처 타임스탬프를 로컬에 저장해두고 비교

---

## 8. 현재 확정된 아키텍처 요약

| 영역 | 결정 사항 |
|---|---|
| 데스크톱 캡처 | Tauri 메뉴바 앱, idle(20분)→resume 자동 트리거 + 전역 단축키 수동 트리거 |
| 캡처 입력 방식 | 음성 메모(비동기 STT) 1순위, 원탭 프리셋 태그 2순위 |
| 모바일 앱 | Expo(React Native) — 이동 중 캡처, 학습노트 PDF 업로드, 패턴 대시보드 리뷰 |
| 백엔드 | Next.js API Route + Supabase, 캡처 API를 두 클라이언트가 공유 |
| 외부 연동 | GitHub API+Webhook(커밋 리듬), Notion API+Webhook(편집 이력) |
| 학습노트 | Samsung Notes 자동 연동 불가 → PDF export 후 앱 업로드로 대체 |
| 보류 | 활성 창 전환 자동 감지(Accessibility API 기반) — 데이터 근거 부족으로 2단계로 연기 |

---

## 9. 백엔드/DB 재검토 — NestJS + PostgreSQL(직접 설계)

당초 Next.js API Route + Supabase로 잡았던 백엔드를 재검토:

- 백엔드를 **NestJS**로 별도 구축하기로 함 (Next.js API Route에서 분리)
- DB는 Supabase(매니지드 BaaS) 대신 **PostgreSQL을 직접 설계**하기로 함 — SQL 기반 스택을 최종 목표로 삼고 있어, 복잡한 관계형 스키마를 스스로 설계·운영해보는 것 자체가 목적
- ORM은 **TypeORM** 채택 (NestJS 공식 문서가 기본으로 다루는 조합), 단 마이그레이션은 자동생성 대신 **raw SQL로 직접 작성** — "SQL을 직접 짜본다"는 학습 목표에 가장 직접적으로 닿는 부분
- 로컬 개발은 Docker Compose Postgres, 배포는 Neon/Railway 등 순수 매니지드 Postgres

실제 스키마 초안:

```
repos            (id, name, local_path, github_full_name)
captures         (id, user_id, repo_id FK nullable, type[voice|tag], content, source[desktop|mobile], captured_at)
sessions         (id, started_at, ended_at, trigger_type[idle_resume|manual])
session_captures (session_id FK, capture_id FK)   -- N:M
github_events    (id, repo_id FK, event_type, committed_at)
notion_events    (id, page_id, edited_at)
study_notes      (id, uploaded_at, source_pdf_path, extracted_summary, repo_id FK nullable)
```

## 10. 모노레포 채택

모바일(Expo)/데스크톱(Tauri)/백엔드(NestJS) 세 앱을 하나의 레포로 관리하기로 결정. 근거:

1. **API 계약 공유**: 세 앱이 같은 캡처 API(Capture, Session)를 주고받음. 이미 핵심 스택인 Zod로 스키마를 `packages/shared-types`에 한 번만 정의하면, 백엔드는 `nestjs-zod` 등으로 DTO 검증에, 두 클라이언트는 React Hook Form + Zod 폼 검증에 그대로 재사용 가능. 레포가 나뉘면 이 스키마를 패키지로 배포·버전 관리해야 하는 오버헤드가 생김
2. **원자적 스키마 변경**: DB 마이그레이션 하나가 API DTO + 모바일/데스크톱 클라이언트 코드를 동시에 바꿔야 하는 구조라, 한 커밋/PR로 세 곳을 함께 바꿀 수 있어야 배포 순서 문제(백엔드는 배포됐는데 클라이언트가 옛 스키마를 기대하는 등)를 피할 수 있음
3. **1인 개발**: 멀티레포의 버전 태깅·cross-repo 이슈 트래킹 비용을 상쇄할 팀 단위 이점이 없는 개인 프로젝트

**주의점**: 세 앱의 빌드 파이프라인이 서로 다름(Expo EAS / Tauri Cargo / NestJS Docker) → pnpm workspaces + Turborepo로 태스크를 스코프별로 분리해서 관리.

```
adhd-irection/
├── apps/
│   ├── mobile/       (Expo)
│   ├── desktop/      (Tauri)
│   └── api/          (NestJS)
├── packages/
│   └── shared-types/ (Capture/Session Zod 스키마 + API 타입)
├── docs/
├── pnpm-workspace.yaml
└── turbo.json
```

---

## 11. Turborepo 도입 보류

pnpm workspaces는 채택하되, Turborepo는 지금 넣지 않기로 함.

**이유**: Turborepo가 값어치를 하는 상황은 ①빌드 시간이 CI에서 실제로 아파질 때 ②`shared-types` 변경 순서 문제가 실제로 버그를 낸 적이 있을 때 ③여러 명이 캐시를 공유해야 할 때인데, 지금은 1인 개발·앱 3개·CI 없음 단계라 셋 다 해당 안 됨. `packages/shared-types`가 순수 TypeScript라 tsconfig `paths`로 소스를 직접 참조하면 "먼저 빌드해야 하는 순서" 문제 자체가 애초에 안 생김. 세 앱 동시 실행은 `concurrently` + pnpm 스크립트로 충분.

**나중에 추가할 때 비용이 거의 0인 이유**: 지금 구조(`apps/*`, `packages/*`)가 이미 Turborepo가 기대하는 표준 구조라, 필요해지면 `turbo.json` 추가 + 스크립트를 `turbo run dev`로 바꾸기만 하면 됨. 폴더 재구성이 필요 없어서 "일단 넣어두고 익숙해지자"가 아니라 "필요해질 때 넣어도 손해 없다"는 계산이 성립.

**재도입 트리거**: `pnpm run dev` 스크립트가 손으로 관리하기 번거로워질 때 / shared-types 변경 후 특정 앱이 옛 버전을 참조해 버그가 난 적이 있을 때 / CI를 붙였는데 매번 전체 재빌드로 시간이 아깝게 느껴질 때.

## 12. 모바일 앱 재검토 — Expo 대신 Next.js PWA

Apple Developer Program(연 $99)이 미니 프로젝트 치고 비싸다는 문제 제기에서 시작된 재검토.

**검토 배경**: 모바일 앱에 실제로 필요한 기능은 ①음성 녹음(캡처) ②PDF 업로드(학습노트) ③패턴 대시보드 리뷰 세 가지뿐. 자동 이탈 감지 같은 OS 레벨 트리거는 이미 3절에서 데스크톱으로 옮겨놨기 때문에, 모바일에 네이티브 모듈이 필요한 이유가 애초에 없었음.

**확인한 사실**: 이 세 기능은 전부 iOS Safari/PWA로 커버됨 —
- 음성 녹음: `MediaRecorder` API, iOS 14.3+
- PDF 업로드: `<input type="file">`로 파일 앱 접근
- 푸시 알림(필요해질 경우): iOS 16.4+부터 홈 화면에 추가된 PWA에 한해 Web Push 지원, **Apple Developer Program 없이도 동작**

**결정**: `apps/mobile`을 Expo(React Native) 대신 **Next.js PWA**로 변경. 부수 효과로 Expo보다 오히려 러닝커브가 낮아짐 — Next.js는 이미 근재님 코어 스택이라 새로 배울 게 없음. Apple Developer Program은 모바일 쪽에선 완전히 불필요해짐.

## 13. 배포 플랫폼 선택

**프론트(Next.js PWA) → Vercel**: Vercel은 Next.js에 최적화된 PaaS. 무료 티어(대역폭 100GB/월)로 개인 사용 트래픽은 충분히 커버.

**백엔드(NestJS) → Railway (Render 대신)**: 처음엔 Render 무료 티어를 고려했으나, 15분 무활동 시 슬립되어 재기동 지연(수십 초)이 생기는 게 단점. Railway Hobby 플랜($5/월 고정 구독, $5어치 사용량 포함)으로 전환 — 슬립 없는 상시 실행의 대가로 월 $5는 감수 가능한 수준으로 판단. DB는 Railway가 아니라 Neon에 그대로 둬서 Railway 쪽 사용량을 API 서비스 하나로 최소화.

**DB → Neon PostgreSQL**: 무료 티어로 개인 캡처 데이터 규모 충분히 커버.

**주의**: Vercel은 애초에 NestJS 같은 상시 실행 서버에 안 맞는 플랫폼(서버리스 함수는 요청 시에만 켜졌다 꺼지는 구조라 DB 커넥션 풀 유지 등에 불리함) — 그래서 "Vercel이냐 AWS냐"가 아니라 처음부터 "프론트=Vercel, 백엔드=별도 상시 컨테이너"로 역할이 나뉘어 있었음.

## 14. GitHub Actions 비용 재확인 — public 레포의 이점

Tauri 데스크톱 릴리스 빌드는 macOS 러너가 필수(macOS 앱 서명/공증은 실제 macOS에서만 가능). macOS 러너는 분당 과금 배수가 Linux 대비 **10배**인데, 이 배수는 **private 레포에만 적용**된다는 걸 확인함. `tjrmswo/ADHD-irection`은 **public 레포**라서 GitHub 호스팅 러너는 OS 상관없이 무제한 무료 — macOS 러너 비용 걱정 자체가 이 프로젝트엔 해당 없음. (레포를 public으로 유지해야 하는 이유가 하나 더 생긴 셈.)

## 15. 비용 상한선 정책

미니 프로젝트 정체성을 지키기 위한 예산 가이드라인:

| 단계 | 월 예산 상한선 |
|---|---|
| 현재 (Vercel+Railway+Neon+GitHub Actions) | **$5** (Railway 고정비만) |
| 커스텀 도메인 추가 시 | +1~2천원/월 |
| AWS 확장 시 (Fargate+RDS, NAT Gateway 회피) | 약 1~1.5만원/월 |
| NAT Gateway를 실무처럼 그대로 쓸 때 | +4만원/월 — **이 지점부터 미니 프로젝트 범위를 넘어선 것으로 판단** |

AWS(ECS Fargate + RDS + Terraform/CDK)는 학습 목적의 확장 방향으로 남겨두되, 지금 당장 옮길 이유는 없음. NAT Gateway를 켜는 순간이 실질적인 비용 경계선.

## 16. 모노레포 스캐폴딩 시 정한 세부 사항 (2026-10-02)

- **shared-types 참조 방식**: 11절에서는 "tsconfig `paths`로 소스 직접 참조"라고 적었지만, 실제로는 `package.json`의 `exports`가 `./src/index.ts`를 가리키게 하고 각 앱이 `workspace:*`로 의존하는 방식으로 구현. 빌드 단계가 없다는 점은 동일하고, 앱마다 `paths`를 따로 맞출 필요가 없음. NestJS(ESM)는 런타임에 Node 24의 타입 스트리핑으로 `.ts`를 그대로 읽으므로 **shared-types는 지워지는 문법(enum·namespace 금지)만 쓰고 상대 import에 `.ts` 확장자를 붙여야 함** (`erasableSyntaxOnly`로 강제). Next.js는 `transpilePackages`, Vite는 별도 설정 없이 동작
- **Node 24 이상 필수**: 위 타입 스트리핑 때문. Railway 배포 이미지도 Node 24로 맞춰야 함
- **포트**: API 기본 포트를 4000으로 변경 (Next.js dev 서버 3000과 충돌 방지). Tauri dev는 1420
- **ID 타입**: Zod 스키마에서 id를 UUID로 가정. 9절 초안에는 타입이 없었으므로 마이그레이션 작성 시 바꾸려면 `shared-types`도 함께 수정
- **프리셋 태그 코드값**: `blocked`(막힘) / `almost_done`(거의 다 함) / `switched`(전환함) / `break`(휴식)

## 17. `apps/mobile` → `apps/web` 이름 변경 (2026-10-02)

Next.js PWA는 폰 전용이 아니라 캡처를 제외한 모든 화면(패턴 대시보드, 캡처 기록 조회, 학습노트 PDF 업로드, 이동 중 캡처)을 담당하고, 맥 브라우저에서도 주로 쓰게 됨. `mobile`이라는 이름이 실제 역할보다 좁아서 `apps/web`(패키지명 `@adhd-irection/web`)으로 변경. 역할 분담 자체는 그대로 — `apps/desktop`(Tauri)은 OS 권한이 필요한 캡처 순간만 담당. 캡처의 `source` 값은 18절에서 `desktop` | `web`으로 변경.

## 18. 초기 스키마 마이그레이션 작성 시 정한 세부 사항 (2026-10-02)

9절 초안 7개 테이블 + `users`를 `apps/api/src/database/migrations/1790920800000-InitSchema.ts`에 raw SQL로 작성. 초안에 없던 부분은 다음과 같이 정함:

- **PK**: 전부 `uuid` + `DEFAULT gen_random_uuid()` (Postgres 13+ 내장, 확장 불필요)
- **열거형 값**: Postgres `ENUM` 타입 대신 `text` + `CHECK` 제약. 값 추가/삭제가 제약 하나 교체로 끝나고, ENUM은 값 삭제가 불가능해서 초기 단계엔 CHECK가 다루기 쉬움
- **시각 컬럼**: 전부 `timestamptz`
- **`users` 테이블 추가**: 초안에는 없었지만 `captures.user_id`가 가리킬 대상이 필요해서 최소 컬럼(`id`, `name`, `created_at`)으로 추가하고 FK(`ON DELETE CASCADE`)를 걺. 인증은 **카카오 로그인을 NestJS로 직접 구현**할 계획이고, 그때 `kakao_id` 등은 새 마이그레이션으로 추가. 그 전까지는 `SeedTempUser` 마이그레이션이 넣는 임시 유저(`00000000-0000-4000-8000-000000000001`) 하나로 테스트
- **`captures.source` 값**: 9절 초안의 `desktop | mobile`을 `desktop | web`으로 변경 (17절에서 앱 이름을 `apps/web`으로 바꾼 것과 맞춤. 맥 브라우저에서 한 캡처가 `mobile`로 찍히는 어색함 제거)
- **삭제 동작**: repo 삭제 시 `captures`/`study_notes`의 `repo_id`는 `SET NULL`(기록은 남김), `github_events`는 `CASCADE`. `session_captures`는 양쪽 다 `CASCADE`
- **`sessions`**: `ended_at`은 nullable(진행 중), `ended_at >= started_at` CHECK 추가
- **인덱스**: 시간순 조회용(`captured_at`, `started_at`, `committed_at`, `edited_at`, `uploaded_at`)과 FK 역방향 조회용만 추가
- **로컬 Postgres 버전**: `postgres:17-alpine`

**검증**: 작성 시점에 맥에 Docker가 없어서 Docker Compose로는 못 돌려봄. 대신 임시 Postgres(embedded-postgres 18.4)에 `migration:run` → 제약/CASCADE 동작 확인 → `migration:revert` → 재실행까지 통과. 이후 Docker 설치 뒤 `pnpm db:up` → `pnpm db:migrate`도 로컬에서 통과 확인.

**Nest ↔ DB 연결**: `@nestjs/typeorm`의 `TypeOrmModule.forRoot()`에 CLI와 같은 `data-source.ts` 설정을 그대로 넘김(설정 한 곳). `.env` 로딩은 `@nestjs/config` 없이 Node 내장 `process.loadEnvFile`로 처리 — 환경변수가 `DATABASE_URL` 하나뿐이라 패키지를 더 얹지 않음. 마이그레이션은 앱 기동 시 자동 실행하지 않고 `pnpm db:migrate`로만 실행.

---

*이 문서는 실제 GitHub 로컬 저장소 커밋 이력 분석(2026-09-27 기준, 1,375건)을 근거로 작성됨.*
