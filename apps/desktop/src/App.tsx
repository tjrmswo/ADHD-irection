import {
  PRESET_TAG_LABELS,
  PresetTagSchema,
  type PresetTag,
} from "@adhd-irection/shared-types";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback, useEffect, useState } from "react";
import { createTagCapture } from "./api";
import "./App.css";

const TAGS = PresetTagSchema.options;

type Status =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; tag: PresetTag }
  | { kind: "error"; message: string };

function App() {
  const [status, setStatus] = useState<Status>({ kind: "idle" });

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
    <main className="capture">
      <h1>지금 어떤 상태였나요?</h1>
      <div className="tags">
        {TAGS.map((tag, index) => (
          <button key={tag} disabled={busy} onClick={() => capture(tag)}>
            <kbd>{index + 1}</kbd>
            {PRESET_TAG_LABELS[tag]}
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
