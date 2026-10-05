// 브라우저의 창 제목(탭 제목)에서 "어느 사이트였는지"만 뽑는다.
// 탭 제목 자체는 내보내지 않으므로(visibility.ts), 브라우저에서 무엇을 했는지는
// 이 사이트 이름까지만 보인다. 목록에 없는 사이트는 전부 "기타 사이트"로 묶는다
// — 제목의 끝부분을 그대로 쓰면 개인적인 내용이 새어 나올 수 있어서다.

export const BROWSER_APPS = [
  'Google Chrome',
  'Safari',
  'Arc',
  'Microsoft Edge',
  'Firefox',
  'Brave Browser',
  'Whale',
];

export const OTHER_SITES = '기타 사이트';

interface Site {
  name: string;
  pattern: RegExp;
  // 작업과 무관하게 시간을 쓰기 쉬운 곳 (화면에 "딴짓"으로 표시)
  distraction: boolean;
}

// 위에서부터 먼저 맞는 것을 쓴다.
const SITES: Site[] = [
  { name: 'YouTube', pattern: /youtube|유튜브/i, distraction: true },
  { name: 'Netflix', pattern: /netflix|넷플릭스/i, distraction: true },
  { name: 'Instagram', pattern: /instagram|인스타그램/i, distraction: true },
  { name: 'X (Twitter)', pattern: /twitter|트위터| \/ X$/i, distraction: true },
  { name: 'TikTok', pattern: /tiktok|틱톡/i, distraction: true },
  { name: 'Twitch', pattern: /twitch|트위치/i, distraction: true },
  { name: '치지직', pattern: /chzzk|치지직/i, distraction: true },
  { name: 'Reddit', pattern: /reddit/i, distraction: true },
  { name: 'Facebook', pattern: /facebook|페이스북/i, distraction: true },
  {
    name: '디시인사이드',
    pattern: /dcinside|디시인사이드/i,
    distraction: true,
  },
  { name: '에펨코리아', pattern: /fmkorea|에펨코리아/i, distraction: true },
  {
    name: '네이버 웹툰',
    pattern: /네이버\s*웹툰|naver webtoon/i,
    distraction: true,
  },
  { name: 'GitHub', pattern: /github/i, distraction: false },
  { name: 'Stack Overflow', pattern: /stack overflow/i, distraction: false },
  { name: 'Notion', pattern: /notion/i, distraction: false },
  { name: 'ChatGPT', pattern: /chatgpt/i, distraction: false },
  { name: 'Claude', pattern: /claude/i, distraction: false },
  { name: 'Figma', pattern: /figma/i, distraction: false },
  {
    name: 'Google 검색',
    pattern: / - Google (검색|Search)/i,
    distraction: false,
  },
];

export function siteOf(title: string): { name: string; distraction: boolean } {
  const site = SITES.find(({ pattern }) => pattern.test(title));
  return site
    ? { name: site.name, distraction: site.distraction }
    : { name: OTHER_SITES, distraction: false };
}
