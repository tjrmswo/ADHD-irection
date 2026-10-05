import type { ActivityRecap } from "@adhd-irection/shared-types";
import type { CaptureContext } from "./api";

const clock = new Intl.DateTimeFormat("ko-KR", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function formatMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}분`;
  return rest === 0 ? `${hours}시간` : `${hours}시간 ${rest}분`;
}

export type RecapState =
  | { kind: "loading" }
  | { kind: "ready"; recap: ActivityRecap | null; loadedAt: number }
  | { kind: "error" };

// 캡처 창 위쪽에 "떠나기 전에 뭘 하고 있었는지"를 짧게 보여준다.
export function Recap({
  state,
  triggerType,
}: {
  state: RecapState;
  triggerType: CaptureContext["triggerType"];
}) {
  if (state.kind === "loading") {
    return <section className="recap muted">직전 흔적을 불러오는 중…</section>;
  }
  if (state.kind === "error") {
    return (
      <section className="recap muted">직전 흔적을 불러오지 못했어요.</section>
    );
  }
  const { recap, loadedAt } = state;
  if (!recap) {
    return (
      <section className="recap muted">
        최근 12시간 안에 남은 흔적이 없어요.
      </section>
    );
  }

  const started = new Date(recap.startedAt);
  const ended = new Date(recap.endedAt);
  const duration = Math.round((ended.getTime() - started.getTime()) / 60_000);
  const ago = Math.max(0, Math.round((loadedAt - ended.getTime()) / 60_000));
  const counts = [
    recap.commits > 0 && `커밋 ${recap.commits}개`,
    recap.captures > 0 && `캡처 ${recap.captures}개`,
    recap.notionEdits > 0 && `노션 편집 ${recap.notionEdits}번`,
  ].filter(Boolean);

  return (
    <section className="recap">
      <p className="recap-head">
        {/* 자리를 비웠다 돌아온 경우와 작업 중에 직접 부른 경우의 말을 달리한다. */}
        <strong>{triggerType === "idle_resume" ? "떠나기 전" : "방금까지"}</strong>{" "}
        {duration > 0 && `${formatMinutes(duration)} 동안 `}
        {/* 커밋도 캡처도 없으면 작업용 앱을 쓰고 있던 사용 흔적만 있는 구간이다. */}
        {counts.length > 0 ? counts.join(" · ") : "앱 사용"}
      </p>
      <p className="recap-sub">
        마지막 흔적 {clock.format(ended)}
        {ago > 0 && ` (${formatMinutes(ago)} 전)`}
      </p>
      {recap.lastCommit && (
        <p className="recap-line" title={recap.lastCommit.message}>
          <span>마지막 커밋</span>
          {recap.lastCommit.message}
        </p>
      )}
      {recap.lastNotionPage && (
        <p className="recap-line" title={recap.lastNotionPage}>
          <span>노션</span>
          {recap.lastNotionPage}
        </p>
      )}
      {recap.lastContext && (
        <p
          className="recap-line"
          title={[recap.lastContext.activeApp, recap.lastContext.windowTitle]
            .filter(Boolean)
            .join(" — ")}
        >
          <span>보던 화면</span>
          {[recap.lastContext.activeApp, recap.lastContext.windowTitle]
            .filter(Boolean)
            .join(" — ")}
        </p>
      )}
    </section>
  );
}
