"use client";

import { Loader2Icon, RefreshCwIcon } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { refreshMovieFromTmdb } from "@/lib/library-actions";

/** Re-fetch this movie's metadata (and franchise) from TMDB. */
export function RefreshTmdbButton({ movieId }: { movieId: number }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      disabled={pending}
      title="Replace the title, poster, cast, genres, synopsis and franchise with TMDB's. Your rating, notes, tags and copies are kept."
      onClick={() =>
        startTransition(async () => {
          const result = await refreshMovieFromTmdb(movieId);
          if (result.ok) toast.success(result.message ?? "Updated.");
          else toast.error(result.message);
        })
      }
    >
      {pending ? <Loader2Icon className="animate-spin" /> : <RefreshCwIcon />}
      Refresh from TMDB
    </Button>
  );
}
