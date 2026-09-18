import { redirect } from "next/navigation";

// The agent index is the leaderboard: every agent, ranked by whether its odds came true.
export default function AgentsIndex() {
  redirect("/leaderboard");
}
