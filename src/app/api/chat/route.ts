import { hermesSessionBridge } from "@/lib/hermes-session-bridge";
import { getChatProfile } from "@/lib/profile-registry";
import { getProfileSettings } from "@/lib/profile-settings";
import { ensureSessionRun } from "@/lib/run-manager";
import { buildPendingRunTrace } from "@/lib/runtime-trace";
import { getRuntimeMode } from "@/lib/agent-runtime";
import { sessionStore } from "@/lib/session-store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    sessionId?: string;
    agentId?: string;
    message?: string;
  };

  const message = body.message?.trim();
  if (!message) {
    return Response.json({ error: "Message required" }, { status: 400 });
  }

  let session = body.sessionId ? await sessionStore.getSession(body.sessionId) : null;

  if (body.sessionId && !session && hermesSessionBridge.isImportedSessionId(body.sessionId)) {
    return Response.json(
      { error: "Imported Hermes sessions are read-only for now. Start a new local thread to continue." },
      { status: 400 },
    );
  }

  const requestedAgentId = body.agentId?.trim().toLowerCase();

  if (!session) {
    if (!requestedAgentId || !(await getChatProfile(requestedAgentId))) {
      return Response.json({ error: "Valid profile required" }, { status: 400 });
    }

    session = await sessionStore.createSession(requestedAgentId);
  }

  if (requestedAgentId && session.agentId !== requestedAgentId) {
    return Response.json({ error: "Session and profile mismatch" }, { status: 400 });
  }

  if (session.runState?.phase === "running") {
    const queuedSession = await sessionStore.queuePrompt(session.id, message);
    ensureSessionRun(session.id);
    return Response.json({ session: queuedSession, disposition: "queued" });
  }

  const runtimeMode = getRuntimeMode();
  const profileSettings = await getProfileSettings(session.agentId);
  const pendingTrace = buildPendingRunTrace({
    agentId: session.agentId,
    session,
    runtimeMode,
    profileSettings,
  });

  const activeSession = await sessionStore.activateRun(session.id, message, pendingTrace);
  ensureSessionRun(activeSession.id);

  return Response.json({ session: activeSession, disposition: "started" });
}
