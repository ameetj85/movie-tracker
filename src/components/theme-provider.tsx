"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

/**
 * Light/dark theme via a `.dark` class on <html> (matches the `dark` variant in
 * globals.css). Follows the OS setting until the user flips the header switch;
 * the choice is remembered in localStorage.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </NextThemesProvider>
  );
}
