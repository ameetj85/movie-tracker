"use client";

import { AlertTriangleIcon, Loader2Icon, MailCheckIcon } from "lucide-react";
import Link from "next/link";
import { useActionState, useId, type ReactNode } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  completePasswordReset,
  forgotPassword,
  signIn,
  signUp,
  type AuthFormState,
} from "@/lib/auth-actions";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth-validation";

const idle: AuthFormState = { status: "idle" };

/** A labelled input with its error message. Ids come from useId() (see "Forms" in CLAUDE.md). */
function Field({
  label,
  error,
  hint,
  aside,
  ...input
}: React.ComponentProps<typeof Input> & { label: string; error?: string; hint?: string; aside?: ReactNode }) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        {aside}
      </div>
      <Input id={id} aria-invalid={error ? true : undefined} aria-describedby={describedBy} {...input} />
      {error ? (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function ErrorAlert({ state }: { state: AuthFormState }) {
  if (state.status !== "error") return null;
  return (
    <Alert variant="destructive">
      <AlertTriangleIcon />
      <AlertDescription>{state.message}</AlertDescription>
    </Alert>
  );
}

function SubmitButton({ pending, children }: { pending: boolean; children: ReactNode }) {
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending && <Loader2Icon className="animate-spin" />}
      {children}
    </Button>
  );
}

const errorsOf = (state: AuthFormState) => (state.status === "error" ? state.fieldErrors : {});

export function SignInForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(signIn, idle);
  const errors = errorsOf(state);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="next" value={next} />
      <ErrorAlert state={state} />
      <Field
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        required
        autoFocus
        defaultValue={state.status === "error" ? state.email : undefined}
        error={errors.email}
      />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        error={errors.password}
        aside={
          <Link href="/forgot-password" className="text-xs text-muted-foreground hover:text-primary hover:underline">
            Forgot password?
          </Link>
        }
      />
      <SubmitButton pending={pending}>Sign in</SubmitButton>
    </form>
  );
}

export function SignUpForm() {
  const [state, action, pending] = useActionState(signUp, idle);
  const errors = errorsOf(state);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <ErrorAlert state={state} />
      <Field label="Name" name="name" autoComplete="name" hint="Optional. Shown in the header." error={errors.name} />
      <Field label="Email" name="email" type="email" autoComplete="email" required error={errors.email} />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={PASSWORD_MIN_LENGTH}
        hint={`At least ${PASSWORD_MIN_LENGTH} characters.`}
        error={errors.password}
      />
      <Field
        label="Confirm password"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        required
        error={errors.confirmPassword}
      />
      <SubmitButton pending={pending}>Create account</SubmitButton>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(forgotPassword, idle);
  if (state.status === "sent") {
    return (
      <Alert>
        <MailCheckIcon />
        <AlertTitle>Check your email</AlertTitle>
        <AlertDescription>
          If an account exists for {state.email}, we&apos;ve sent a link to reset its password. The link expires in 1
          hour.
        </AlertDescription>
      </Alert>
    );
  }
  const errors = errorsOf(state);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <ErrorAlert state={state} />
      <Field label="Email" name="email" type="email" autoComplete="email" required autoFocus error={errors.email} />
      <SubmitButton pending={pending}>Send reset link</SubmitButton>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(completePasswordReset, idle);
  const errors = errorsOf(state);
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="token" value={token} />
      <ErrorAlert state={state} />
      <Field
        label="New password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        autoFocus
        minLength={PASSWORD_MIN_LENGTH}
        hint={`At least ${PASSWORD_MIN_LENGTH} characters. You'll be signed out on all other devices.`}
        error={errors.password}
      />
      <Field
        label="Confirm new password"
        name="confirmPassword"
        type="password"
        autoComplete="new-password"
        required
        error={errors.confirmPassword}
      />
      <SubmitButton pending={pending}>Set new password</SubmitButton>
    </form>
  );
}
