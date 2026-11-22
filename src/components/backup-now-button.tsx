"use client";

import { DatabaseBackupIcon, Loader2Icon } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { backupNow } from "@/lib/actions";

export function BackupNowButton() {
  const [pending, startTransition] = useTransition();

  function run() {
    startTransition(async () => {
      const result = await backupNow();
      if (result.ok) toast.success("Backup created", { description: result.file });
      else toast.error(result.message);
    });
  }

  return (
    <Button variant="outline" onClick={run} disabled={pending}>
      {pending ? <Loader2Icon className="animate-spin" /> : <DatabaseBackupIcon />}
      Back up now
    </Button>
  );
}
