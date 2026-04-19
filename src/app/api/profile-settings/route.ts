import { getChatProfile } from "@/lib/profile-registry";
import { getProfileSettings } from "@/lib/profile-settings";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const agentId = searchParams.get("agentId")?.trim().toLowerCase();

  if (!agentId || !(await getChatProfile(agentId))) {
    return Response.json({ error: "Valid profile required" }, { status: 400 });
  }

  const settings = await getProfileSettings(agentId);

  if (!settings) {
    return Response.json({ error: "Profile settings unavailable" }, { status: 404 });
  }

  return Response.json({ settings });
}
