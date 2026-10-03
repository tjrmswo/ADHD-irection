import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans_KR } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

const plexSans = IBM_Plex_Sans_KR({
  variable: "--font-plex-sans",
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  weight: ["500"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: { default: "ADHD-irection", template: "%s | ADHD-irection" },
  description: "작업 흔적과 전환 맥락 캡처 기록",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`${plexSans.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full pb-20">
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
