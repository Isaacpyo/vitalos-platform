import type { ReactNode } from "react";

/**
 * The page's `<main>` landmark and skip-link target (`#main`, see app/layout.tsx).
 *
 * Convention (matches the contact page): each page owns its `<main id="main" tabIndex={-1}>`
 * because the (site) layout is currently a pass-through. If workstream G2a's shell takes over the
 * landmark, change this single component to a fragment and every G2b template follows.
 */
export function PageMain({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <main id="main" tabIndex={-1}>
      {children}
    </main>
  );
}
