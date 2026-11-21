import type { Metadata } from "next";

import { MovieForm } from "@/components/movie-form";
import { createMovie } from "@/lib/actions";
import { isTmdbConfigured } from "@/lib/tmdb";

export const metadata: Metadata = { title: "Add movie" };

export default function AddMoviePage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">Add movie</h1>
      <MovieForm
        action={createMovie}
        submitLabel="Add to collection"
        cancelHref="/"
        tmdbEnabled={isTmdbConfigured()}
      />
    </div>
  );
}
