import { FilmIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type PosterProps = {
  src: string | null;
  title: string;
  /** Thumbnail mode: decorative, no caption in the placeholder. */
  compact?: boolean;
  className?: string;
};

/**
 * Movie cover art with a placeholder when none is set.
 * Posters are normally cached locally (/posters/…, see src/lib/posters.ts) and
 * already sized by TMDB, so a plain lazy <img> is used rather than next/image;
 * if a download failed the src may still be a remote URL.
 */
export function Poster({ src, title, compact, className }: PosterProps) {
  return (
    <div
      className={cn(
        "relative aspect-[2/3] overflow-hidden rounded-lg bg-muted text-muted-foreground",
        className,
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={compact ? "" : `Poster for ${title}`}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 size-full object-cover"
        />
      ) : compact ? (
        <div className="flex size-full items-center justify-center">
          <FilmIcon className="size-3.5 opacity-50" aria-hidden />
        </div>
      ) : (
        <div className="flex size-full flex-col items-center justify-center gap-2 p-3 text-center">
          <FilmIcon className="size-8 opacity-50" aria-hidden />
          <span className="line-clamp-3 text-xs font-medium">{title}</span>
        </div>
      )}
    </div>
  );
}
