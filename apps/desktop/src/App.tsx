import {
  PRESET_TAG_LABELS,
  PresetTagSchema,
  type PresetTag,
} from "@adhd-irection/shared-types";
import { LogicalSize } from "@tauri-apps/api/dpi";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback, useEffect, useRef, useState } from "react";
import { createTagCapture, fetchRecap, type CaptureContext } from "./api";
import { Recap, type RecapState } from "./Recap";
import "./App.css";

const TAGS = PresetTagSchema.options;
// tauri.conf.json의 창 너비와 같다.
const WINDOW_WIDTH = 380;

type Status =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; tag: PresetTag }
  | { kind: "error"; message: string };

function App() {
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [recap, setRecap] = useState<RecapState>({ kind: "loading" });
  const [triggerType, setTriggerType] =
    useState<CaptureContext["triggerType"]>(null);

  // 창이 뜰 때마다(Rust가 알려준다) 복귀 요약을 새로 불러온다.
  useEffect(() => {
    let stale = false;
    const load = () => {
      setRecap({ kind: "loading" });
      fetchRecap()
        .then((data) => {
          if (!stale) {
            setRecap({ kind: "ready", recap: data, loadedAt: Date.now() });
          }
        })
        .catch(() => {
          if (!stale) setRecap({ kind: "error" });
        });
    };
    load();
    const unlisten = listen<CaptureContext | null>("capture-shown", (event) => {
      setTriggerType(event.payload?.triggerType ?? null);
      load();
    });
    return () => {
      stale = true;
      void unlisten.then((stop) => stop());
    };
  }, []);

  // 요약 줄 수에 따라 내용 높이가 달라지므로 창 높이를 내용에 맞춘다.
  const content = useRef<HTMLElement>(null);
  useEffect(() => {
    const element = content.current;
    if (!element) return;
    const observer = new ResizeObserver(() => {
      const height = Math.ceil(element.getBoundingClientRect().height);
      getCurrentWindow()
        .setSize(new LogicalSize(WINDOW_WIDTH, height))
        .catch(() => undefined);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const hide = useCallback(async () => {
    await getCurrentWindow().hide();
    setStatus({ kind: "idle" });
  }, []);

  const capture = useCallback(
    async (tag: PresetTag) => {
      setStatus({ kind: "saving" });
      try {
        await createTagCapture(tag);
        setStatus({ kind: "saved", tag });
        setTimeout(hide, 700);
      } catch (error) {
        setStatus({
          kind: "error",
          message: error instanceof Error ? error.message : String(error),
        });
      }
    },
    [hide],
  );

  const busy = status.kind === "saving" || status.kind === "saved";

  // 1~4로 태그 선택, Esc로 닫기
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        void hide();
        return;
      }
      const tag = TAGS[Number(event.key) - 1];
      if (tag && !busy) void capture(tag);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [busy, capture, hide]);

  return (
    <main className="capture" ref={content}>
      <Recap state={recap} triggerType={triggerType} />
      <h1>지금 어떤 상태였나요?</h1>
      <div className="tags">
        {TAGS.map((tag, index) => (
          <button key={tag} disabled={busy} onClick={() => capture(tag)}>
            <kbd>{index + 1}</kbd>
            {PRESET_TAG_LABELS[tag]}
            <span className={`dot ${tag}`} />
          </button>
        ))}
      </div>
      <p className={`status ${status.kind}`} role="status">
        {status.kind === "saving" && "저장 중…"}
        {status.kind === "saved" &&
          `저장됨: ${PRESET_TAG_LABELS[status.tag]}`}
        {status.kind === "error" && status.message}
        {status.kind === "idle" && "Esc로 닫기"}
      </p>
    </main>
  );
}

export default App;
