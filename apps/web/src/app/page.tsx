import { Button } from "@pickler/ui";

export default function Home() {
  return (
    <main>
      <p className="eyebrow">PICKLER</p>
      <h1>Un nuevo comienzo.</h1>
      <p>Estamos preparando lo que viene.</p>
      <form action="/api/v1/health" method="get">
        <Button type="submit">Consultar estado</Button>
      </form>
    </main>
  );
}
