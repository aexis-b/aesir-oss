import { hermesSessionBridge } from "@/lib/hermes-session-bridge";
import { getChatProfile } from "@/lib/profile-registry";
import { sessionStore } from "@/lib/session-store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const agentId = searchParams.get("agentId") ?? undefined;

  if (agentId && !(await getChatProfile(agentId))) {
    return Response.json({ error: "Unknown profile" }, { status: 400 });
  }

  const [localSessions, importedSessions] = await Promise.all([
    sessionStore.listSessions(agentId),
    hermesSessionBridge.listSessions(agentId),
  ]);

  const bridgedKeys = new Set(
    localSessions
      .filter((session) => session.externalSessionId && session.runtimeSource)
      .map((session) => `${session.runtimeSource}:${session.externalSessionId}`),
  );

  const sessions = [...localSessions, ...importedSessions]
    .filter((session) => {
      if (!session.readOnly || !session.externalSessionId) {
        return true;
      }

      return !bridgedKeys.has(`${session.source}:${session.externalSessionId}`);
    })
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

  return Response.json({ sessions });
}

export async function POST(request: Request) {
  const body = (await request.json()) as { agentId?: string; title?: string };
  const agentId = body.agentId?.trim().toLowerCase();

  if (!agentId || !(await getChatProfile(agentId))) {
    return Response.json({ error: "Valid profile required" }, { status: 400 });
  }

  const session = await sessionStore.createSession(agentId, body.title?.trim() || undefined);

  return Response.json({
    session,
    sessions: await sessionStore.listSessions(agentId),
  });
}
