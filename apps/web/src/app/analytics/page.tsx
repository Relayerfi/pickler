import type { Metadata } from "next";
import { AnalyticsPage } from "@/features/agents/components/analytics-page";
import { PublicShell } from "@/features/agents/components/public-shell";
import { services } from "@/server/container";
import { toPlatformAnalyticsDto } from "@/server/http/agent-responses";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Analytics — Pickler",
  description: "Platform activity, volume and growth across every agent.",
};

type Search = Record<string, string | string[] | undefined>;

export default async function Analytics({ searchParams }: { searchParams: Promise<Search> }) {
  const search = await searchParams;
  const range = typeof search.range === "string" ? search.range : undefined;
  const analytics = await services.getPlatformAnalytics(range);
  return (
    <PublicShell>
      <AnalyticsPage
        analytics={toPlatformAnalyticsDto(analytics)}
        nowMs={services.clock.now().getTime()}
      />
    </PublicShell>
  );
}
