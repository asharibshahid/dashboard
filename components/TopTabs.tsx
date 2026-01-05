"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { tabs } from "../data/tabs";

export default function TopTabs() {
  const pathname = usePathname();

  return (
    <div className="border-t border-slate-100 bg-white">
      <nav className="mx-auto flex w-full max-w-6xl items-center gap-2 overflow-x-auto px-4 py-3">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={isActive ? "page" : undefined}
              className={`whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition ${
                isActive
                  ? "border-[#003b6f] bg-[#003b6f] text-white"
                  : "border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
