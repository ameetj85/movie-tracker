import { ArrowDownUpIcon, FilmIcon, PlusIcon } from "lucide-react";
import Link from "next/link";

import { ThemeToggle } from "@/components/theme-toggle";
import { buttonVariants } from "@/components/ui/button";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-primary/10 bg-background/80 shadow-sm shadow-primary/5 backdrop-blur-md supports-[backdrop-filter]:bg-background/65">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="group flex items-center gap-2.5 rounded-lg text-lg font-semibold tracking-tight outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <span className="flex size-9 items-center justify-center rounded-xl bg-linear-to-br from-violet-500 to-fuchsia-500 text-white shadow-md shadow-primary/30 transition-all duration-300 group-hover:scale-105 group-hover:-rotate-6 group-hover:shadow-lg group-hover:shadow-primary/45">
            <FilmIcon className="size-5" aria-hidden />
          </span>
          <span className="text-gradient whitespace-nowrap">Movie Vault</span>
        </Link>
        <nav className="flex items-center gap-1">
          <Link
            href="/data"
            className={buttonVariants({ variant: "ghost", size: "sm" })}
            aria-label="Import and export"
            title="Import & export"
          >
            <ArrowDownUpIcon aria-hidden />
            <span className="hidden sm:inline">Import / Export</span>
          </Link>
          <Link href="/movies/add" className={buttonVariants({ size: "sm" })} aria-label="Add movie" title="Add movie">
            <PlusIcon aria-hidden />
            <span className="hidden sm:inline">Add movie</span>
          </Link>
          <ThemeToggle className="ml-2" />
        </nav>
      </div>
    </header>
  );
}
