import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { AuthCard, AuthCardSkeleton } from "@/components/auth-card";
import { SignUpForm } from "@/components/auth-forms";
import { buttonVariants } from "@/components/ui/button";
import { countUsers, isSignUpOpen } from "@/lib/auth-service";

export const metadata: Metadata = { title: "Create account" };

export default function SignUpPage() {
  return (
    <Suspense fallback={<AuthCardSkeleton />}>
      <SignUp />
    </Suspense>
  );
}

async function SignUp() {
  await connection();
  const signInLink = (
    <>
      Already have an account?{" "}
      <Link href="/login" className="font-medium text-primary hover:underline">
        Sign in
      </Link>
    </>
  );

  if (!isSignUpOpen()) {
    return (
      <AuthCard title="Sign-up is closed" description="This vault already has an owner. Ask them to create an account for you.">
        <Link href="/login" className={buttonVariants({ variant: "outline" })}>
          Back to sign in
        </Link>
      </AuthCard>
    );
  }

  const first = countUsers() === 0;
  return (
    <AuthCard
      title="Create account"
      description={
        first
          ? "Set up the first account for this vault. After that, sign-up closes unless AUTH_ALLOW_SIGNUP=true."
          : "Create an account to open this Movie Vault."
      }
      footer={!first && signInLink}
    >
      <SignUpForm />
    </AuthCard>
  );
}
