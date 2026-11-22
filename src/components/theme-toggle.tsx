"use client";

import { MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

import { cn } from "@/lib/utils";

const noopSubscribe = () => () => {};

/**
 * Light/dark switch. The theme is only known in the browser, so the thumb's
 * position and icons are driven by the `dark:` variant (correct on first paint,
 * no flash); JS state is only used for the accessible checked state.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  // false during SSR/hydration, true afterwards — avoids a hydration mismatch.
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const isDark = mounted && resolvedTheme === "dark";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label="Dark mode"
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={cn(
        "relative inline-flex h-7 w-13 shrink-0 cursor-pointer items-center rounded-full border border-primary/20 p-0.5 shadow-inner transition-all outline-none",
        "bg-linear-to-r from-amber-100 to-violet-100 hover:border-primary/40 hover:shadow-md hover:shadow-primary/20",
        "dark:from-violet-950 dark:to-indigo-950",
        "focus-visible:ring-3 focus-visible:ring-ring/50",
        className,
      )}
    >
      {/* Track icons: the one opposite the thumb hints at the other mode. */}
      <SunIcon className="absolute left-1.5 size-3.5 text-amber-500 opacity-0 dark:opacity-60" aria-hidden />
      <MoonIcon className="absolute right-1.5 size-3.5 text-violet-500 opacity-60 dark:opacity-0" aria-hidden />
      <span
        className={cn(
          "relative flex size-6 items-center justify-center rounded-full bg-white shadow-md shadow-primary/30 transition-transform duration-300",
          "dark:translate-x-6 dark:bg-linear-to-br dark:from-violet-500 dark:to-fuchsia-500",
        )}
      >
        <SunIcon className="size-3.5 text-amber-500 dark:hidden" aria-hidden />
        <MoonIcon className="hidden size-3.5 text-white dark:block" aria-hidden />
      </span>
    </button>
  );
}
