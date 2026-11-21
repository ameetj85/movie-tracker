import { FilmIcon, PlusIcon } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <FilmIcon className="size-5" aria-hidden />
          Movie Vault
        </Link>
        <Link href="/movies/add" className={buttonVariants({ size: "sm" })}>
          <PlusIcon aria-hidden />
          Add movie
        </Link>
      </div>
    </header>
  );
}
