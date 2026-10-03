import { Injectable } from '@nestjs/common';

export interface GithubViewer {
  id: string;
  login: string;
}

export interface GithubRepo {
  // "owner/name"
  fullName: string;
  name: string;
}

export interface GithubCommit {
  sha: string;
  // 커밋 메시지 첫 줄
  message: string;
  authoredAt: string;
}

const GRAPHQL_URL = 'https://api.github.com/graphql';
// 레포마다 최근에 커밋된 브랜치를 이만큼까지만 본다.
const MAX_BRANCHES = 50;

const VIEWER_QUERY = `query { viewer { id login } }`;

const REPOS_QUERY = `
  query ($cursor: String) {
    viewer {
      repositories(
        first: 100
        after: $cursor
        affiliations: [OWNER, COLLABORATOR, ORGANIZATION_MEMBER]
        ownerAffiliations: [OWNER, COLLABORATOR, ORGANIZATION_MEMBER]
        orderBy: { field: PUSHED_AT, direction: DESC }
      ) {
        pageInfo { hasNextPage endCursor }
        nodes { nameWithOwner name pushedAt }
      }
    }
  }
`;

const HISTORY_FIELDS = `
  history(first: 100, after: $cursor, since: $since, author: { id: $authorId }) {
    pageInfo { hasNextPage endCursor }
    nodes { oid messageHeadline authoredDate }
  }
`;

const BRANCHES_QUERY = `
  query ($owner: String!, $name: String!, $since: GitTimestamp!, $authorId: ID!, $cursor: String) {
    repository(owner: $owner, name: $name) {
      refs(
        refPrefix: "refs/heads/"
        first: ${MAX_BRANCHES}
        orderBy: { field: TAG_COMMIT_DATE, direction: DESC }
      ) {
        nodes { name target { ... on Commit { ${HISTORY_FIELDS} } } }
      }
    }
  }
`;

const BRANCH_PAGE_QUERY = `
  query ($owner: String!, $name: String!, $branch: String!, $since: GitTimestamp!, $authorId: ID!, $cursor: String) {
    repository(owner: $owner, name: $name) {
      ref(qualifiedName: $branch) {
        target { ... on Commit { ${HISTORY_FIELDS} } }
      }
    }
  }
`;

interface History {
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
  nodes: { oid: string; messageHeadline: string; authoredDate: string }[];
}

// GitHub GraphQL API를 감싼다. 토큰은 GITHUB_TOKEN 환경변수에서 읽는다.
@Injectable()
export class GithubClient {
  private readonly token = process.env.GITHUB_TOKEN;

  get enabled(): boolean {
    return Boolean(this.token);
  }

  async viewer(): Promise<GithubViewer> {
    const data = await this.graphql<{ viewer: GithubViewer }>(VIEWER_QUERY);
    return data.viewer;
  }

  /** 내가 접근할 수 있는 레포(개인·조직, private 포함) 중 since 이후에 푸시된 것. */
  async listReposPushedSince(since: Date): Promise<GithubRepo[]> {
    const repos: GithubRepo[] = [];
    let cursor: string | null = null;
    for (;;) {
      const data: {
        viewer: {
          repositories: {
            pageInfo: { hasNextPage: boolean; endCursor: string | null };
            nodes: {
              nameWithOwner: string;
              name: string;
              pushedAt: string | null;
            }[];
          };
        };
      } = await this.graphql(REPOS_QUERY, { cursor });
      const page = data.viewer.repositories;
      for (const node of page.nodes) {
        // 최근 푸시 순이라, since보다 오래된 레포가 나오면 그 뒤는 볼 필요가 없다.
        if (!node.pushedAt || new Date(node.pushedAt) < since) return repos;
        repos.push({ fullName: node.nameWithOwner, name: node.name });
      }
      if (!page.pageInfo.hasNextPage) return repos;
      cursor = page.pageInfo.endCursor;
    }
  }

  /** 레포의 모든 브랜치에서 authorId가 since 이후에 만든 커밋. 브랜치 간 중복은 제거한다. */
  async listCommits(
    repoFullName: string,
    since: Date,
    authorId: string,
  ): Promise<GithubCommit[]> {
    const [owner, name] = repoFullName.split('/');
    const variables = { owner, name, since: since.toISOString(), authorId };
    const data = await this.graphql<{
      repository: {
        refs: {
          nodes: { name: string; target: { history?: History } | null }[];
        };
      } | null;
    }>(BRANCHES_QUERY, { ...variables, cursor: null });

    const commits = new Map<string, GithubCommit>();
    for (const branch of data.repository?.refs.nodes ?? []) {
      let history = branch.target?.history;
      while (history) {
        for (const node of history.nodes) {
          commits.set(node.oid, {
            sha: node.oid,
            message: node.messageHeadline,
            authoredAt: node.authoredDate,
          });
        }
        if (!history.pageInfo.hasNextPage) break;
        const next = await this.graphql<{
          repository: {
            ref: { target: { history?: History } | null } | null;
          } | null;
        }>(BRANCH_PAGE_QUERY, {
          ...variables,
          branch: `refs/heads/${branch.name}`,
          cursor: history.pageInfo.endCursor,
        });
        history = next.repository?.ref?.target?.history;
      }
    }
    return [...commits.values()];
  }

  private async graphql<T>(
    query: string,
    variables: Record<string, unknown> = {},
  ): Promise<T> {
    if (!this.token) throw new Error('GITHUB_TOKEN이 설정되지 않았습니다');
    const res = await fetch(GRAPHQL_URL, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.token}`,
        'content-type': 'application/json',
        'user-agent': 'adhd-irection',
      },
      body: JSON.stringify({ query, variables }),
    });
    if (!res.ok) throw new Error(`GitHub API 호출 실패 (${res.status})`);
    const body = (await res.json()) as {
      data?: T;
      errors?: { message: string }[];
    };
    if (body.errors?.length || !body.data) {
      throw new Error(
        `GitHub API 오류: ${body.errors?.map((e) => e.message).join('; ') ?? '응답 없음'}`,
      );
    }
    return body.data;
  }
}
