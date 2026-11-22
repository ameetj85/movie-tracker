import { LogOutIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import { signOut } from "@/lib/auth-actions";

/** Who's signed in, plus a sign-out button. Reads the session, so render it inside <Suspense>. */
export async function UserMenu() {
  const user = await getCurrentUser();
  if (!user) return null;
  return (
    <form action={signOut} className="flex items-center gap-1">
      <span className="hidden max-w-40 truncate text-sm text-muted-foreground lg:inline" title={user.email}>
        {user.name ?? user.email}
      </span>
      <Button type="submit" variant="ghost" size="sm" aria-label="Sign out" title={`Sign out ${user.email}`}>
        <LogOutIcon aria-hidden />
      </Button>
    </form>
  );
}
