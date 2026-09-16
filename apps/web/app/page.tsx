import { ButtonLink } from "@vitalos/ui";
import Link from "next/link";

export default function Home() {
  return (
    <>
      <header className="site-header">
        <Link className="wordmark" href="/">
          VITALOS
        </Link>
        <nav aria-label="Primary">
          <a href="#what-we-do">What we do</a>
          <a href="#about">About</a>
        </nav>
      </header>
      <main id="main" tabIndex={-1}>
        <section className="hero">
          <p className="eyebrow">Technology Consulting, Engineering &amp; Digital Transformation</p>
          <h1>From strategy to production.</h1>
          <p className="lead">
            We help ambitious organisations modernise operations, build digital products and adopt
            AI.
          </p>
          <ButtonLink href="mailto:hello@vitalos.co.uk">Talk to Vitalos</ButtonLink>
        </section>
        <section id="what-we-do" className="section">
          <h2>One Vitalos. Six connected practices.</h2>
          <ul className="practice-list">
            {[
              "Consulting",
              "Engineering",
              "AI & Data",
              "Experience",
              "Managed Services",
              "Labs",
            ].map((name) => (
              <li key={name}>Vitalos {name}</li>
            ))}
          </ul>
        </section>
        <section id="about" className="section muted">
          <h2>A production-minded partner</h2>
          <p>
            Strategy, design, engineering and responsible operations joined into one delivery
            system.
          </p>
        </section>
      </main>
      <footer>
        <span>Vitalos</span>
        <span>UK-first. Built for responsible growth.</span>
      </footer>
    </>
  );
}
