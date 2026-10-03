"use client";

import { useRouter } from "next/navigation";

// 날짜를 고르면 그 날의 캡처 기록으로 이동한다.
export function DatePicker({
  value,
  max,
  active,
}: {
  value: string;
  max: string;
  active: boolean;
}) {
  const router = useRouter();
  return (
    <label
      className={`inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm shadow-seg ${
        active ? "bg-brand font-semibold text-white" : "bg-white text-ink-soft"
      }`}
    >
      <span className="font-medium">날짜 선택</span>
      <input
        type="date"
        value={value}
        max={max}
        onChange={(event) => {
          if (event.target.value) {
            router.push(`/captures?date=${event.target.value}`);
          }
        }}
        className={`cursor-pointer bg-transparent font-mono text-[13px] outline-none ${
          active ? "[color-scheme:dark]" : ""
        }`}
      />
    </label>
  );
}
