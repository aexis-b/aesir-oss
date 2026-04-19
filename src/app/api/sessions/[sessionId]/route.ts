import { hermesSessionBridge } from "@/lib/hermes-session-bridge";
import { sessionStore } from "@/lib/session-store";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await context.params;
  const session = (await sessionStore.getSession(sessionId)) ?? (await hermesSessionBridge.getSession(sessionId));

  if (!session) {
    return Response.json({ error: "Session not found" }, { status: 404 });
  }

  return Response.json({ session });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  const { sessionId } = await context.params;
  const body = (await request.json()) as { title?: string; archived?: boolean };
  const title = typeof body.title === "string" ? body.title.trim() : undefined;
  const hasArchiveUpdate = typeof body.archived === "boolean";

  if (!title && !hasArchiveUpdate) {
    return Response.json({ error: "Title or archived state required" }, { status: 400 });
  }

  if (hermesSessionBridge.isImportedSessionId(sessionId)) {
    return Response.json({ error: "Imported sessions are read-only" }, { status: 400 });
  }

  const session = await sessionStore.updateSession(sessionId, {
    title,
    archived: hasArchiveUpdate ? body.archived : undefined,
  });
  return Response.json({ session });
}
