import type { Metadata } from "next";
import { Suspense } from "react";

import { MovieForm } from "@/components/movie-form";
import { TagSuggestions } from "@/components/tag-suggestions";
import { createMovie } from "@/lib/actions";
import { isTmdbConfigured } from "@/lib/tmdb";

export const metadata: Metadata = { title: "Add movie" };

export default function AddMoviePage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-gradient w-fit text-3xl font-bold tracking-tight">Add movie</h1>
      <MovieForm
        action={createMovie}
        submitLabel="Add to collection"
        cancelHref="/"
        tmdbEnabled={isTmdbConfigured()}
      />
      {/* Streams in after the prerendered form; only feeds the Tags autocomplete. */}
      <Suspense>
        <TagSuggestions />
      </Suspense>
    </div>
  );
}
