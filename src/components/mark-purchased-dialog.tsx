"use client";

import { AlertTriangleIcon, Loader2Icon, ShoppingBagIcon } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";

import { DatePicker } from "@/components/date-picker";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { MovieFormState } from "@/lib/actions";
import { CONDITIONS, FORMATS } from "@/lib/constants";
import type { CopyFormValues } from "@/lib/validation";

const formatItems = Object.fromEntries(FORMATS.map((f) => [f, f]));
const conditionItems = Object.fromEntries(CONDITIONS.map((c) => [c, c]));

type MarkPurchasedDialogProps = {
  title: string;
  /** Formats listed on the wishlist entry; the first one is preselected. */
  wantedFormats: string[];
  /** `markPurchased` with the movie id bound. */
  action: (state: MovieFormState, formData: FormData) => Promise<MovieFormState>;
};

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Wishlist → Owned in one step: record the copy you bought. */
export function MarkPurchasedDialog({ title, wantedFormats, action }: MarkPurchasedDialogProps) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(action, { status: "idle" });
  const [copy, setCopy] = useState<CopyFormValues>({
    format: wantedFormats[0] ?? "",
    edition: "",
    purchaseDate: "",
    price: "",
    condition: "New / Sealed",
    location: "",
  });
  const errors = state.status === "error" ? state.fieldErrors : {};
  const patch = (p: Partial<CopyFormValues>) => setCopy((c) => ({ ...c, ...p }));

  function handleOpenChange(next: boolean) {
    // Default the purchase date to today (read here, not during render).
    if (next && !copy.purchaseDate) patch({ purchaseDate: todayIso() });
    setOpen(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button />}>
        <ShoppingBagIcon />
        Mark as purchased
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="payload" value={JSON.stringify(copy)} />
          <DialogHeader>
            <DialogTitle>You bought &ldquo;{title}&rdquo;</DialogTitle>
            <DialogDescription>
              Moves it from your wishlist to your collection with the copy you bought.
              {wantedFormats.length > 1 && " The other wanted formats are removed from the wishlist entry."}
            </DialogDescription>
          </DialogHeader>

          {state.status === "error" && (
            <Alert variant="destructive">
              <AlertTriangleIcon />
              <AlertTitle>Couldn&apos;t save</AlertTitle>
              <AlertDescription>{state.message}</AlertDescription>
            </Alert>
          )}
          {state.status === "duplicate" && (
            <Alert>
              <AlertTriangleIcon />
              <AlertTitle>You may already own this</AlertTitle>
              <AlertDescription>
                <ul className="my-1 list-disc pl-5">
                  {state.duplicates.map((d) => (
                    <li key={`${d.movieId}-${d.format}`}>
                      <Link href={`/movies/${d.movieId}`} className="underline underline-offset-2" target="_blank">
                        {d.title}
                        {d.releaseYear ? ` (${d.releaseYear})` : ""}
                      </Link>{" "}
                      — {d.format}
                    </li>
                  ))}
                </ul>
                <Button type="submit" name="confirmDuplicate" value="1" size="sm" variant="outline" disabled={pending}>
                  Save anyway
                </Button>
              </AlertDescription>
            </Alert>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label>
                Format <span className="text-destructive" aria-hidden>*</span>
              </Label>
              <Select items={formatItems} value={copy.format || null} onValueChange={(v) => patch({ format: v ?? "" })}>
                <SelectTrigger className="w-full" aria-label="Format" aria-invalid={!!errors.format}>
                  <SelectValue placeholder="Choose format" />
                </SelectTrigger>
                <SelectContent>
                  {FORMATS.map((f) => (
                    <SelectItem key={f} value={f}>
                      {f}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.format && <p className="text-xs text-destructive">{errors.format}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mp-edition">Edition</Label>
              <Input
                id="mp-edition"
                placeholder="Standard, Steelbook…"
                value={copy.edition}
                onChange={(e) => patch({ edition: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mp-date">Purchase date</Label>
              <DatePicker id="mp-date" value={copy.purchaseDate} onChange={(v) => patch({ purchaseDate: v })} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mp-price">Price paid</Label>
              <Input
                id="mp-price"
                inputMode="decimal"
                placeholder="0.00"
                value={copy.price}
                onChange={(e) => patch({ price: e.target.value })}
                aria-invalid={!!errors.price}
              />
              {errors.price && <p className="text-xs text-destructive">{errors.price}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Condition</Label>
              <Select
                items={conditionItems}
                value={copy.condition || null}
                onValueChange={(v) => patch({ condition: v ?? "" })}
              >
                <SelectTrigger className="w-full" aria-label="Condition">
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  {CONDITIONS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mp-location">Location</Label>
              <Input
                id="mp-location"
                placeholder="e.g. Shelf B3"
                value={copy.location ?? ""}
                onChange={(e) => patch({ location: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !copy.format}>
              {pending && <Loader2Icon className="animate-spin" />}
              Move to collection
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
