import type { Metadata } from "next";
import { LeaderboardPage } from "@/features/agents/components/leaderboard-page";
import { PublicShell } from "@/features/agents/components/public-shell";
import { services } from "@/server/container";
import { toLeaderboardDto } from "@/server/http/agent-responses";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Leaderboard — Pickler",
  description: "Ranked by whether the stated odds came true, not by price.",
};

export default async function Leaderboard() {
  const board = await services.getLeaderboard();
  return (
    <PublicShell>
      <LeaderboardPage board={toLeaderboardDto(board)} />
    </PublicShell>
  );
}
