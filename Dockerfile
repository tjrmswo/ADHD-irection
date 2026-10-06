# API 서버 이미지. Railway는 저장소 루트에 Dockerfile이 있으면 자동으로 이 파일로 빌드한다
# (없으면 루트의 `pnpm start`, 즉 개발용 명령을 실행해 버린다). 그래서 apps/api가 아니라 루트에 둔다.
#   docker build -t adhd-irection-api .
# shared-types는 빌드 없이 .ts를 그대로 읽으므로 Node 24(타입 스트리핑)가 필요하다.
FROM node:24-slim

RUN corepack enable
WORKDIR /repo

# 의존성 목록만 먼저 복사해서, 코드만 바뀌었을 때는 설치 단계를 다시 하지 않게 한다.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY packages/shared-types/package.json packages/shared-types/
RUN pnpm install --frozen-lockfile --filter "@adhd-irection/api..."

COPY packages/shared-types packages/shared-types
COPY apps/api apps/api
RUN pnpm --filter @adhd-irection/api build

WORKDIR /repo/apps/api
ENV NODE_ENV=production

# 뜰 때마다 아직 적용 안 된 마이그레이션을 먼저 돌린다 (이미 적용된 것은 건너뛴다).
# 마이그레이션이 실패하면 서버를 띄우지 않는다.
CMD ["sh", "-c", "node node_modules/typeorm/cli.js migration:run -d src/database/data-source.ts && node dist/main"]
