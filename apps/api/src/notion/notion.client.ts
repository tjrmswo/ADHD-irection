import { Injectable } from '@nestjs/common';

export interface NotionPage {
  id: string;
  title: string | null;
  lastEditedAt: string;
}

const API_URL = 'https://api.notion.com/v1';
const SEARCH_URL = `${API_URL}/search`;
// 페이지 상세에서 보여줄 최상위 블록 수
const MAX_BLOCKS = 60;

export interface NotionBlock {
  type: string;
  text: string;
  checked: boolean | null;
}

export interface NotionPageContent {
  title: string | null;
  url: string;
  lastEditedAt: string;
  blocks: NotionBlock[];
  truncated: boolean;
}

type Properties = Record<
  string,
  { type: string; title?: { plain_text: string }[] }
>;

// 제목은 type이 title인 속성에 들어 있다 (속성 이름은 페이지마다 다르다).
function titleOf(properties: Properties | undefined): string | null {
  const titleProperty = Object.values(properties ?? {}).find(
    (property) => property.type === 'title',
  );
  const title = titleProperty?.title
    ?.map((part) => part.plain_text)
    .join('')
    .trim();
  return title || null;
}
const NOTION_VERSION = '2022-06-28';
// 한 번에 가져오는 페이지 수. 최근에 편집된 것부터 오므로 그 뒤는 볼 필요가 없다.
const PAGE_SIZE = 100;

interface SearchResponse {
  results: {
    id: string;
    last_edited_time: string;
    properties?: Properties;
  }[];
}

// Notion API를 감싼다. 토큰은 NOTION_TOKEN 환경변수(통합의 시크릿)에서 읽는다.
@Injectable()
export class NotionClient {
  private readonly token = process.env.NOTION_TOKEN;

  get enabled(): boolean {
    return Boolean(this.token);
  }

  /**
   * 통합에 공유된 페이지(공유한 페이지와 그 하위 페이지)를 최근 편집 순으로.
   * 감시할 페이지는 Notion에서 통합에 공유하는 것으로 정한다.
   */
  async listRecentlyEditedPages(): Promise<NotionPage[]> {
    if (!this.token) throw new Error('NOTION_TOKEN이 설정되지 않았습니다');
    const res = await fetch(SEARCH_URL, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.token}`,
        'content-type': 'application/json',
        'notion-version': NOTION_VERSION,
      },
      body: JSON.stringify({
        filter: { property: 'object', value: 'page' },
        sort: { direction: 'descending', timestamp: 'last_edited_time' },
        page_size: PAGE_SIZE,
      }),
    });
    if (!res.ok) throw new Error(`Notion API 호출 실패 (${res.status})`);
    const body = (await res.json()) as SearchResponse;

    return body.results.map((page) => ({
      id: page.id,
      title: titleOf(page.properties),
      lastEditedAt: page.last_edited_time,
    }));
  }

  /** 페이지의 현재 내용. 최상위 블록의 글만 위에서부터 가져온다. */
  async getPageContent(pageId: string): Promise<NotionPageContent> {
    const [page, children] = await Promise.all([
      this.get<{
        url: string;
        last_edited_time: string;
        properties?: Properties;
      }>(`/pages/${pageId}`),
      this.get<{
        has_more: boolean;
        results: (Record<string, unknown> & { type: string })[];
      }>(`/blocks/${pageId}/children?page_size=${MAX_BLOCKS}`),
    ]);

    const blocks: NotionBlock[] = [];
    for (const block of children.results) {
      // 블록의 내용은 자기 type 이름의 필드 안에 있다.
      const content = block[block.type] as
        | {
            rich_text?: { plain_text: string }[];
            title?: string;
            checked?: boolean;
          }
        | undefined;
      const text = (
        content?.rich_text?.map((part) => part.plain_text).join('') ??
        content?.title ??
        ''
      ).trim();
      // 글이 없는 블록(구분선, 이미지, 빈 줄 등)은 건너뛴다.
      if (!text) continue;
      blocks.push({
        type: block.type,
        text,
        checked: content?.checked ?? null,
      });
    }
    return {
      title: titleOf(page.properties),
      url: page.url,
      lastEditedAt: page.last_edited_time,
      blocks,
      truncated: children.has_more,
    };
  }

  private async get<T>(path: string): Promise<T> {
    if (!this.token) throw new Error('NOTION_TOKEN이 설정되지 않았습니다');
    const res = await fetch(`${API_URL}${path}`, {
      headers: {
        authorization: `Bearer ${this.token}`,
        'notion-version': NOTION_VERSION,
      },
    });
    if (!res.ok) throw new Error(`Notion API 호출 실패 (${res.status})`);
    return (await res.json()) as T;
  }
}
