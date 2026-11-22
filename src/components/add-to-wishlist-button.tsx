"use client";

import { HeartIcon, Loader2Icon } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { addToWishlistFromTmdb } from "@/lib/library-actions";

/** Franchise page: put a film you don't have on the wishlist (details from TMDB). */
export function AddToWishlistButton({ tmdbId, title }: { tmdbId: number; title: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={pending}
      aria-label={`Add ${title} to wishlist`}
      onClick={() =>
        startTransition(async () => {
          const result = await addToWishlistFromTmdb(tmdbId);
          if (result.ok) toast.success(result.message ?? "Added to wishlist.");
          else toast.error(result.message);
        })
      }
    >
      {pending ? <Loader2Icon className="animate-spin" /> : <HeartIcon />}
      Add to wishlist
    </Button>
  );
}
