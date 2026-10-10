"use client";

/**
 * Last-resort boundary: replaces the root layout when it fails, so it has to render its own
 * `<html>` and `<body>` and cannot rely on the stylesheet or fonts. It uses browser defaults on
 * purpose (no raw colours, no external assets) and is deliberately plain.
 */
export default function GlobalError({
  error,
  reset,
}: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  return (
    <html lang="en-GB">
      <body>
        <main id="main" style={{ padding: "4rem 1.5rem", maxWidth: "40rem" }}>
          <h1>Something went wrong</h1>
          <p>We could not load this page. You can try again.</p>
          {error.digest ? (
            <p>
              Reference: <code>{error.digest}</code>
            </p>
          ) : null}
          <button type="button" onClick={() => reset()} style={{ minHeight: "3rem" }}>
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
