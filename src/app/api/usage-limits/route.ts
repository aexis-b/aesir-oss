import { getChatProfile } from "@/lib/profile-registry";
import { getCodexUsageSummary } from "@/lib/codex-usage";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const agentId = searchParams.get("agentId")?.trim().toLowerCase();

  if (!agentId || !(await getChatProfile(agentId))) {
    return Response.json({ error: "Valid profile required" }, { status: 400 });
  }

  const summary = await getCodexUsageSummary(agentId);
  return Response.json({ summary });
}
