"use client";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="fallback">
      <p className="fallback-eyebrow">PICKLER</p>
      <h1>We could not load the board.</h1>
      <p>The data source did not answer. Try again in a moment.</p>
      <button type="button" onClick={reset}>
        TRY AGAIN
      </button>
    </main>
  );
}
