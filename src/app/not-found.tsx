import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center gap-4 py-24 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Not found</h1>
      <p className="text-muted-foreground">That movie isn&apos;t in your vault.</p>
      <Link href="/" className={buttonVariants({ variant: "outline" })}>
        Back to collection
      </Link>
    </div>
  );
}
