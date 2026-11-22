import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { AuthCard, AuthCardSkeleton } from "@/components/auth-card";
import { ResetPasswordForm } from "@/components/auth-forms";
import { buttonVariants } from "@/components/ui/button";
import { findValidResetToken } from "@/lib/auth-service";

export const metadata: Metadata = {
  title: "Reset password",
  // The token is in the URL; don't leak it to other sites through the Referer header.
  referrer: "no-referrer",
};

export default function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  return (
    <Suspense fallback={<AuthCardSkeleton />}>
      <ResetPassword searchParams={searchParams} />
    </Suspense>
  );
}

async function ResetPassword({ searchParams }: Pick<PageProps<"/reset-password">, "searchParams">) {
  const { token } = await searchParams;
  await connection();

  if (typeof token !== "string" || !findValidResetToken(token)) {
    return (
      <AuthCard
        title="Link expired"
        description="This password reset link is invalid, has already been used, or has expired. Links work once and last 1 hour."
      >
        <Link href="/forgot-password" className={buttonVariants()}>
          Request a new link
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Choose a new password">
      <ResetPasswordForm token={token} />
    </AuthCard>
  );
}
