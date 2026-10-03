// 서버 컴포넌트에서만 쓴다 — 브라우저가 아니라 Next 서버가 API에 붙는다.
export const API_URL = process.env.API_URL ?? "http://localhost:4000";
