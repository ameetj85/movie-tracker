import type { ReactNode } from "react";

/** The centered panel shared by the sign-in, sign-up and password reset pages. */
export function AuthCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="flex justify-center py-8 sm:py-16">
      <div className="flex w-full max-w-sm flex-col gap-6 rounded-2xl border border-primary/10 bg-card p-6 shadow-sm shadow-primary/5">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-gradient w-fit text-2xl font-bold tracking-tight">{title}</h1>
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
        {children}
        {footer && <div className="text-center text-sm text-muted-foreground">{footer}</div>}
      </div>
    </div>
  );
}

export function AuthCardSkeleton() {
  return (
    <div className="flex justify-center py-8 sm:py-16">
      <div className="h-96 w-full max-w-sm animate-pulse rounded-2xl border border-primary/10 bg-card" />
    </div>
  );
}
