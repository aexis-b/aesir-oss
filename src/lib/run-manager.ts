import { generateAgentReplyResults, getRuntimeMode } from "@/lib/agent-runtime";
import { getAgent } from "@/lib/agents";
import { getProfileSettings } from "@/lib/profile-settings";
import { buildPendingRunTrace } from "@/lib/runtime-trace";
import { sessionStore } from "@/lib/session-store";

const activeSessionRuns = new Set<string>();

function buildErrorTrace(agentId: Parameters<typeof getAgent>[0], message: string) {
  return {
    phase: "error" as const,
    title: agentId === "shell" ? "Hall relay" : getAgent(agentId).name,
    lines: [message],
  };
}

async function processSessionRun(sessionId: string) {
  while (true) {
    const session = await sessionStore.getSession(sessionId);

    if (!session?.runState || session.runState.phase !== "running") {
      return;
    }

    try {
      const replies = await generateAgentReplyResults({
        agentId: session.agentId,
        messages: session.messages.map((entry) => ({
          role: entry.role,
          content: entry.content,
          speakerId: entry.speakerId ?? null,
          speakerName: entry.speakerName ?? null,
        })),
        externalSessionId: session.externalSessionId,
      });

      const leadReply = replies[0] ?? null;
      const runtimeSource = leadReply?.runtimeSource ?? session.runtimeSource;
      const externalSessionId = leadReply?.externalSessionId ?? session.externalSessionId;
      const runtimeMode = getRuntimeMode();
      const traceSession = {
        ...session,
        runtimeSource,
        externalSessionId,
      };
      const profileSettings = session.agentId === "shell" ? null : await getProfileSettings(session.agentId);
      const nextTrace = buildPendingRunTrace({
        agentId: traceSession.agentId,
        session: traceSession,
        runtimeMode,
        profileSettings,
      });

      const { result: nextPrompt } = await sessionStore.resolveRun(sessionId, {
        replies: replies.map((reply) => ({
          content: reply.content,
          speakerId: reply.speakerId,
          speakerName: reply.speakerName,
        })),
        externalSessionId: leadReply?.externalSessionId ?? undefined,
        runtimeSource: leadReply?.runtimeSource ?? undefined,
        nextTrace,
      });

      if (!nextPrompt) {
        return;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to generate reply";
      const latest = await sessionStore.getSession(sessionId);

      if (latest) {
        await sessionStore.failRun(sessionId, buildErrorTrace(latest.agentId, message));
      }

      return;
    }
  }
}

export function ensureSessionRun(sessionId: string) {
  if (activeSessionRuns.has(sessionId)) {
    return;
  }

  activeSessionRuns.add(sessionId);

  void processSessionRun(sessionId).finally(() => {
    activeSessionRuns.delete(sessionId);
  });
}
