// 창 제목을 밖으로 내보내도 되는 앱. 그 밖의 앱(브라우저, 메신저 등)은 창 제목을
// DB에는 저장하되 API 응답에는 넣지 않는다 — 탭 제목·검색어·대화방 이름 같은
// 개인적인 내용이 화면에 나오지 않게 하기 위해서다. 앱 이름은 모든 앱을 내보낸다.
// TITLE_VISIBLE_APPS 환경변수(쉼표로 구분)로 바꿀 수 있고, 바꾸면 과거 기록에도 바로 적용된다.
const DEFAULT_TITLE_VISIBLE_APPS = [
  'Code',
  'Cursor',
  'Terminal',
  'iTerm2',
  'Xcode',
  'Notion',
  'Figma',
];

export function titleVisibleApps(): string[] {
  const configured = process.env.TITLE_VISIBLE_APPS?.split(',')
    .map((name) => name.trim())
    .filter(Boolean);
  return configured?.length ? configured : DEFAULT_TITLE_VISIBLE_APPS;
}

/** 내보내도 되는 앱의 창 제목만 그대로 돌려주고, 나머지는 null로 가린다. */
export function visibleTitle(
  app: string | null,
  title: string | null,
): string | null {
  return app !== null && titleVisibleApps().includes(app) ? title : null;
}
