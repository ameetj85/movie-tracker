"use client";

import { DicesIcon, Loader2Icon } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

type RandomResponse =
  | { pick: { id: number; title: string }; pool: number }
  | { pick: null; unwatchedOnly: boolean };

/** Opens a random unwatched movie that matches the current search and filters. */
export function SurpriseMeButton() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [busy, setBusy] = useState(false);

  async function pick() {
    setBusy(true);
    try {
      const res = await fetch(`/api/random?${searchParams.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as RandomResponse;
      if (!data.pick) {
        toast.info(
          data.unwatchedOnly
            ? "No unwatched movies match your current filters."
            : "No movies match your current filters.",
        );
        return;
      }
      toast.success(`Tonight's pick: ${data.pick.title}`, {
        description: data.pool > 1 ? `Chosen at random from ${data.pool} movies.` : undefined,
      });
      router.push(`/movies/${data.pick.id}`);
    } catch {
      toast.error("Couldn't pick a movie. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={pick}
      disabled={busy}
      title="Pick a random unwatched movie matching the current filters"
    >
      {busy ? <Loader2Icon className="animate-spin" /> : <DicesIcon />}
      <span className="hidden md:inline">Surprise me</span>
      <span className="sr-only md:hidden">Surprise me</span>
    </Button>
  );
}
