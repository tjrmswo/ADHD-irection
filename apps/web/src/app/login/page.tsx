import type { Metadata } from "next";

export const metadata: Metadata = { title: "로그인" };

// 브라우저가 직접 이동하는 주소라 서버 전용 API_URL과 따로 둔다.
const KAKAO_LOGIN_URL = `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}/auth/kakao`;

const ERRORS: Record<string, string> = {
  expired: "로그인이 만료됐어요. 다시 로그인해 주세요.",
  forbidden: "이 앱의 주인으로 등록된 카카오 계정이 아니에요.",
  cancelled: "카카오 로그인을 취소했어요.",
  state: "로그인 요청이 만료됐어요. 다시 시도해 주세요.",
  kakao: "카카오 로그인 중 문제가 생겼어요. 잠시 뒤 다시 시도해 주세요.",
  config: "서버에 로그인 설정이 빠져 있어요. (SESSION_SECRET, KAKAO_REST_API_KEY)",
};

export default async function LoginPage({
  searchParams,
}: PageProps<"/login">) {
  const { error } = await searchParams;
  const message = typeof error === "string" ? ERRORS[error] : undefined;

  return (
    <main className="mx-auto flex max-w-[1120px] justify-center px-6 pt-20">
      <section className="flex w-full max-w-[420px] flex-col gap-6 rounded-[18px] bg-white p-9 shadow-card">
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-brand">
            작업 흔적과 전환 맥락 기록
          </span>
          <h1 className="text-[28px] leading-tight font-bold tracking-[-0.02em] text-ink-strong">
            로그인
          </h1>
          <p className="text-sm text-muted">
            본인만 쓰는 기록이라, 주인으로 등록된 카카오 계정으로만 들어올 수
            있어요.
          </p>
        </div>

        {message && (
          <p
            role="alert"
            className="rounded-xl bg-[#fdf0dc] px-4 py-3 text-sm font-medium text-[#7a4a00]"
          >
            {message}
          </p>
        )}

        {/* 카카오 로그인 버튼 디자인 가이드의 색: 바탕 #FEE500, 글자 검정 85% */}
        <a
          href={KAKAO_LOGIN_URL}
          className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#FEE500] px-4 text-[15px] font-semibold text-black/85 hover:brightness-95"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
            <path
              fill="currentColor"
              d="M12 3.5c-5.25 0-9.5 3.3-9.5 7.4 0 2.6 1.75 4.9 4.4 6.2l-1.1 4 4.3-2.85c.6.1 1.25.15 1.9.15 5.25 0 9.5-3.3 9.5-7.5S17.25 3.5 12 3.5z"
            />
          </svg>
          카카오로 로그인
        </a>

        <p className="text-[13px] text-subtle">
          처음 로그인한 카카오 계정이 이 앱의 주인으로 등록돼요.
        </p>
      </section>
    </main>
  );
}
