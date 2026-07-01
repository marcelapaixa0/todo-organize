"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const tabs = [
  {
    href: "/tarefas",
    label: "Backlog",
    icon: (active: boolean) => (
      <svg className={cn("w-6 h-6", active ? "text-indigo-600" : "text-slate-400")} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 2.5 : 2}
          d="M4 6h16M4 10h16M4 14h10M4 18h7" />
      </svg>
    ),
  },
  {
    href: "/calendario",
    label: "To Do",
    icon: (active: boolean) => (
      <svg className={cn("w-6 h-6", active ? "text-indigo-600" : "text-slate-400")} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 2.5 : 2}
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
  {
    href: "/perfil",
    label: "Perfil",
    icon: (active: boolean) => (
      <svg className={cn("w-6 h-6", active ? "text-indigo-600" : "text-slate-400")} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={active ? 2.5 : 2}
          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 max-w-2xl mx-auto"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <div className="flex">
        {tabs.map((tab) => {
          const active = pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors touch-manipulation",
                active ? "text-indigo-600" : "text-slate-400"
              )}
            >
              {tab.icon(active)}
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
