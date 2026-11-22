import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import { AuthCard, AuthCardSkeleton } from "@/components/auth-card";
import { SignInForm } from "@/components/auth-forms";
import { countUsers, isSignUpOpen } from "@/lib/auth-service";
import { safeNextPath } from "@/lib/auth-validation";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <Suspense fallback={<AuthCardSkeleton />}>
      <Login searchParams={searchParams} />
    </Suspense>
  );
}

async function Login({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const { next } = await searchParams;
  await connection();
  // Fresh install: there is nobody to sign in as yet.
  if (countUsers() === 0) redirect("/signup");
  const signUpOpen = isSignUpOpen();
  return (
    <AuthCard
      title="Sign in"
      description="Sign in to open your Movie Vault."
      footer={
        signUpOpen && (
          <>
            No account yet?{" "}
            <Link href="/signup" className="font-medium text-primary hover:underline">
              Create one
            </Link>
          </>
        )
      }
    >
      <SignInForm next={safeNextPath(next)} />
    </AuthCard>
  );
}
