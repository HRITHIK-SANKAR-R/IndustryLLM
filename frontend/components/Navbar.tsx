"use client";

import { useTheme } from "next-themes";
import { Moon, Sun, MonitorSmartphone, Search, CheckCircle2 } from "lucide-react";
import { useAppStore } from "@/store/useAppStore";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function Navbar() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const { isMockModeActive, toggleMockMode } = useAppStore();

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <nav className="sticky top-0 z-50 flex h-16 w-full items-center justify-between border-b border-[var(--border)] bg-[var(--bg)] px-6">
      {/* Left */}
      <div className="flex items-center gap-4">
        <Link href="/" className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-sm bg-[var(--primary)] shadow-[0_0_10px_var(--primary)]" />
          <span className="text-lg font-bold tracking-widest text-[var(--text)]">OMNI-GRAPH</span>
        </Link>
        <div className="flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs text-[var(--muted)]">
          <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_theme(colors.emerald.500)]" />
          System Online
        </div>
      </div>

      {/* Center - Search */}
      <div className="hidden flex-1 justify-center md:flex">
        <div className="relative w-full max-w-md">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <Search className="h-4 w-4 text-[var(--muted)]" />
          </div>
          <input
            type="text"
            className="block w-full rounded-md border border-[var(--border)] bg-[var(--surface)] p-2 pl-10 text-sm text-[var(--text)] placeholder-[var(--muted)] focus:border-[var(--primary)] focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
            placeholder="Search equipment, tags, or rules..."
          />
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-4">
        <button
          onClick={toggleMockMode}
          className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors ${
            isMockModeActive
              ? "border-[var(--secondary)] text-[var(--secondary)] shadow-[0_0_10px_var(--secondary)]"
              : "border-[var(--border)] text-[var(--muted)] hover:border-[var(--text)] hover:text-[var(--text)]"
          }`}
        >
          <MonitorSmartphone className="h-4 w-4" />
          <span className="hidden sm:inline">Mock Mode</span>
          {isMockModeActive && <CheckCircle2 className="h-3 w-3" />}
        </button>

        {mounted && (
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="flex h-9 w-9 items-center justify-center rounded-md border border-[var(--border)] text-[var(--muted)] transition-colors hover:border-[var(--text)] hover:text-[var(--text)]"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        )}
      </div>
    </nav>
  );
}
