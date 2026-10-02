import { redirect } from "next/navigation";

// 대시보드가 생기기 전까지는 캡처 기록이 첫 화면이다.
export default function Home() {
  redirect("/captures");
}
