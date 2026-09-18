import Link from "next/link";

export default function NotFound() {
  return (
    <main className="fallback">
      <p className="fallback-eyebrow">PICKLER</p>
      <h1>Nothing on the board here.</h1>
      <p>That agent or pick does not exist, or it moved.</p>
      <Link href="/tokens" className="fallback-link">
        SEE ALL TOKENS
      </Link>
    </main>
  );
}
