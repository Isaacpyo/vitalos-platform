import Link from "next/link";
import {
  closedGates,
  ctaNav,
  ctas,
  descriptor,
  brandLine,
  filterNavByGates,
  primaryNav,
  proposition,
  routes,
  utilityNav,
  wordmarkText,
} from "@vitalos/cms";

/**
 * Interim homepage: locked copy only (see packages/cms/src/locked-copy.ts). Every string is
 * approved copy from the specs; section content arrives from Sanity in workstream G2a.
 * Hierarchy per Stage 8 §8: category descriptor, proposition as the H1, brand line as the
 * supporting line, then the primary and secondary CTAs.
 */
export default function Home() {
  // With no content source wired yet, every publication gate is closed.
  const nav = filterNavByGates(primaryNav, closedGates);
  return (
    <>
      <header className="flex items-center justify-between gap-6 border-b border-hairline px-6 py-5 md:px-20">
        <Link className="font-extrabold tracking-[0.12em] no-underline" href={routes.home()}>
          {wordmarkText}
        </Link>
        <div className="flex items-center gap-6">
          <nav aria-label="Primary" className="flex gap-6">
            {nav.map((item) => (
              <Link key={item.key} href={item.href}>
                {item.label}
              </Link>
            ))}
          </nav>
          {utilityNav.map((item) => (
            <Link key={item.key} className="text-slate" href={item.href}>
              {item.label}
            </Link>
          ))}
          <Link
            className="inline-flex min-h-12 items-center rounded-sm bg-blue px-5 font-bold text-white no-underline"
            href={ctaNav.href}
          >
            {ctaNav.label}
          </Link>
        </div>
      </header>
      <main id="main" tabIndex={-1}>
        <section className="bg-cloud px-6 py-20 md:px-20 md:py-32">
          <p className="font-bold tracking-wide text-slate uppercase">{descriptor}</p>
          <h1 className="my-4 max-w-5xl text-4xl leading-tight font-bold text-pretty md:text-6xl">
            {proposition}
          </h1>
          <p className="text-xl text-slate md:text-2xl">{brandLine}</p>
          <div className="mt-8 flex flex-wrap items-center gap-6">
            <Link
              className="inline-flex min-h-12 items-center rounded-sm bg-blue px-5 font-bold text-white no-underline"
              href={routes.contact()}
            >
              {ctas.primary}
            </Link>
            <Link className="font-bold underline underline-offset-4" href={routes.whatWeDo()}>
              {ctas.secondary}
            </Link>
          </div>
        </section>
      </main>
    </>
  );
}
