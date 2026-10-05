import type {
  CommitDetail,
  NotionPageDetail,
} from "@adhd-irection/shared-types";
import { fetchCommitDetail, fetchNotionPage } from "@/lib/activity";

// 최근 작업에서 고른 줄의 상세. 조회에 실패하면 error만 채워진다.
export type WorkDetail =
  | { kind: "commit"; commit: CommitDetail }
  | { kind: "notion"; page: NotionPageDetail }
  | { kind: "error"; message: string };

const externalLink =
  "inline-flex min-h-11 items-center gap-1.5 self-start rounded-full bg-white px-4 text-sm font-semibold text-brand-deep shadow-chip hover:shadow-chip-hover";

function ExternalIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M14 5h5v5" />
      <path d="M19 5l-9 9" />
      <path d="M19 14v5H5V5h5" />
    </svg>
  );
}

function CommitPanel({ commit }: { commit: CommitDetail }) {
  // 첫 줄(제목)은 목록에 이미 있으므로 본문만 보여준다.
  const body = commit.message.split("\n").slice(1).join("\n").trim();
  const hiddenFiles = commit.fileCount - commit.files.length;
  return (
    <>
      {body && (
        <p className="text-sm break-words whitespace-pre-wrap text-ink-soft">
          {body}
        </p>
      )}
      <p className="text-[13px] text-muted">
        파일 {commit.fileCount}개 ·{" "}
        <span className="font-mono font-medium text-brand">
          +{commit.additions}
        </span>{" "}
        <span className="font-mono font-medium text-[#b4232a]">
          −{commit.deletions}
        </span>
      </p>
      {commit.files.length > 0 && (
        <ul className="flex max-h-64 flex-col gap-1 overflow-y-auto pr-2">
          {commit.files.map((file) => (
            <li
              key={file.path}
              className="flex items-baseline gap-3 font-mono text-[13px]"
            >
              <span className="min-w-0 flex-auto truncate" title={file.path}>
                {file.path}
              </span>
              <span className="flex-none text-brand">+{file.additions}</span>
              <span className="flex-none text-[#b4232a]">
                −{file.deletions}
              </span>
            </li>
          ))}
        </ul>
      )}
      {hiddenFiles > 0 && (
        <p className="text-[13px] text-subtle">외 {hiddenFiles}개 파일</p>
      )}
      <a
        href={commit.url}
        target="_blank"
        rel="noreferrer"
        className={externalLink}
      >
        GitHub에서 보기
        <ExternalIcon />
      </a>
    </>
  );
}

// 블록 종류에 따라 앞에 붙이는 표시와 글자 모양
function Block({ block }: { block: NotionPageDetail["blocks"][number] }) {
  if (block.type.startsWith("heading_")) {
    return <p className="mt-1.5 font-bold text-ink-strong">{block.text}</p>;
  }
  if (block.type === "to_do") {
    return (
      <p className="flex gap-2">
        <span
          aria-label={block.checked ? "완료" : "미완료"}
          className={`mt-[3px] flex size-3.5 flex-none items-center justify-center rounded-[3px] border text-[10px] leading-none ${
            block.checked
              ? "border-brand bg-brand text-white"
              : "border-faint bg-white"
          }`}
        >
          {block.checked ? "✓" : ""}
        </span>
        <span className={block.checked ? "text-muted line-through" : ""}>
          {block.text}
        </span>
      </p>
    );
  }
  if (
    block.type === "bulleted_list_item" ||
    block.type === "numbered_list_item" ||
    block.type === "toggle"
  ) {
    return (
      <p className="flex gap-2">
        <span className="flex-none text-faint">•</span>
        <span>{block.text}</span>
      </p>
    );
  }
  if (block.type === "code") {
    return (
      <pre className="overflow-x-auto rounded-lg bg-white px-3 py-2 font-mono text-[13px]">
        {block.text}
      </pre>
    );
  }
  if (block.type === "quote" || block.type === "callout") {
    return (
      <p className="border-l-2 border-level-2 pl-3 text-ink-soft">
        {block.text}
      </p>
    );
  }
  if (block.type === "child_page" || block.type === "child_database") {
    return (
      <p className="text-ink-soft">
        <span className="mr-2 text-[13px] text-subtle">하위 페이지</span>
        {block.text}
      </p>
    );
  }
  return <p>{block.text}</p>;
}

function NotionPanel({ page }: { page: NotionPageDetail }) {
  return (
    <>
      <p className="text-[13px] text-subtle">
        지금의 페이지 내용이에요. 그때 무엇을 고쳤는지는 Notion이 알려주지
        않아요.
      </p>
      {page.blocks.length === 0 ? (
        <p className="text-sm text-subtle">
          보여줄 글이 없어요. (하위 페이지나 표·이미지만 있는 페이지일 수 있어요)
        </p>
      ) : (
        <div className="flex max-h-80 flex-col gap-1.5 overflow-y-auto pr-2 text-sm break-words">
          {page.blocks.map((block, index) => (
            <Block key={index} block={block} />
          ))}
          {page.truncated && (
            <p className="text-[13px] text-subtle">
              … 아래 내용은 Notion에서 이어서 보세요.
            </p>
          )}
        </div>
      )}
      <a
        href={page.url}
        target="_blank"
        rel="noreferrer"
        className={externalLink}
      >
        Notion에서 열기
        <ExternalIcon />
      </a>
    </>
  );
}

// 펼쳐 둔 줄의 상세를 가져온다. 실패해도 화면은 그릴 수 있게 오류를 값으로 돌려준다.
export async function loadWorkDetail(open: {
  kind: "commit" | "notion";
  ref: string;
}): Promise<WorkDetail> {
  try {
    return open.kind === "commit"
      ? { kind: "commit", commit: await fetchCommitDetail(open.ref) }
      : { kind: "notion", page: await fetchNotionPage(open.ref) };
  } catch (error) {
    return {
      kind: "error",
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

export function WorkDetailPanel({ detail }: { detail: WorkDetail }) {
  return (
    <div className="mb-2 ml-[50px] flex flex-col gap-3 rounded-xl bg-pill px-4 py-3.5">
      {detail.kind === "commit" && <CommitPanel commit={detail.commit} />}
      {detail.kind === "notion" && <NotionPanel page={detail.page} />}
      {detail.kind === "error" && (
        <p className="text-sm text-[#b4232a]">
          상세 내용을 불러오지 못했어요. ({detail.message})
        </p>
      )}
    </div>
  );
}
