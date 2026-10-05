// 이 앱을 쓰고 있던 시간만 작업으로 센다. 그 밖의 앱은 저장만 하고 집계에서 뺀다.
// WORK_APPS 환경변수(쉼표로 구분)로 바꿀 수 있다. 이름은 macOS가 알려주는 앱 이름 그대로다.
const DEFAULT_WORK_APPS = [
  'Code',
  'Cursor',
  'Terminal',
  'iTerm2',
  'Xcode',
  'Notion',
  'Figma',
  'Google Chrome',
  'Safari',
];

export function workApps(): string[] {
  const configured = process.env.WORK_APPS?.split(',')
    .map((name) => name.trim())
    .filter(Boolean);
  return configured?.length ? configured : DEFAULT_WORK_APPS;
}
