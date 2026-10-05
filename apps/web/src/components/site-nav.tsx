"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "작업 흔적" },
  { href: "/work", label: "작업 기록" },
  { href: "/captures", label: "캡처 기록" },
];

export function SiteNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-auto gap-7">
      {LINKS.map(({ href, label }) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-[72px] items-center border-b-2 pt-0.5 text-[15px] ${
              active
                ? "border-brand font-semibold text-ink-strong"
                : "border-transparent font-medium text-muted hover:text-ink-strong"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
