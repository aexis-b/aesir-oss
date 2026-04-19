import type { AgentId, ChatSession, RunTrace } from "@/lib/agents";
import { getAgent, formatSessionSource } from "@/lib/agents";
import type { ProfileSettingsSummary } from "@/lib/profile-settings";

interface BuildPendingRunTraceInput {
  agentId: AgentId;
  session: ChatSession;
  runtimeMode: string;
  profileSettings: ProfileSettingsSummary | null;
}

export function buildPendingRunTrace({
  agentId,
  session,
  runtimeMode,
  profileSettings,
}: BuildPendingRunTraceInput): RunTrace {
  const agent = getAgent(agentId);
  return {
    phase: "running",
    title: agent.name,
    lines: [
      `runtime :: ${profileSettings ? `${profileSettings.provider}/${profileSettings.model}` : runtimeMode}`,
      `auth :: ${profileSettings?.authProvider ? `${profileSettings.authProvider}${profileSettings.authMode ? `/${profileSettings.authMode}` : ""}` : "none"}`,
      `session :: ${session.externalSessionId ? `resume ${session.externalSessionId}` : "new profile thread"}`,
      `source :: ${session.runtimeSource ? formatSessionSource(session.runtimeSource) : "local"}`,
      "status :: waiting for model/tool activity",
    ],
  };
}
