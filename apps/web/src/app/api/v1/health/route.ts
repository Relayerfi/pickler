import type { HealthResponse } from "@pickler/api-schema";
import { services } from "@/server/container";

export const runtime = "nodejs";

export function GET() {
  const health = services.getHealth();
  const body: HealthResponse = {
    status: health.status,
    checkedAt: health.checkedAt.toISOString(),
  };
  return Response.json(body, {
    headers: { "Cache-Control": "no-store" },
  });
}
