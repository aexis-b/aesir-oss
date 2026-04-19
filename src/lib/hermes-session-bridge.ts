import { readFile, readdir } from "node:fs/promises";
import { basename, join } from "node:path";

import type { AgentId, ChatMessage, ChatSession, ChatSessionSummary, SessionSource } from "@/lib/agents";
import { isAgentId, toProfileSessionSource } from "@/lib/agents";
import { getHermesInstallStatus } from "@/lib/hermes-install";
import { deriveTitle, normalizeMessageContent, normalizeText, toSummary } from "@/lib/session-store";

interface HermesTranscriptMessage {
  role?: string;
  content?: string;
}

interface HermesTranscript {
  session_id?: string;
  session_start?: string;
  last_updated?: string;
  system_prompt?: string;
  messages?: HermesTranscriptMessage[];
}

interface HermesBridgeRoot {
  directory: string;
  source: SessionSource;
  agentId: string;
}

function extractIdentity(systemPrompt: string) {
  const match = systemPrompt.match(/# Identity\s+([^\n]+)/i);
  return match?.[1]?.trim() ?? null;
}

function toAgentId(identity: string | null, fallback: string): AgentId | null {
  if (identity) {
    const normalized = identity.toLowerCase();
    if (isAgentId(normalized)) {
      return normalized;
    }
  }

  return isAgentId(fallback) ? fallback : null;
}

function buildImportedId(source: SessionSource, transcriptId: string, fileName: string) {
  return `import:${source}:${transcriptId || fileName}`;
}

function normalizeTimestamp(value: string | undefined, fallback: string) {
  return value && !Number.isNaN(Date.parse(value)) ? new Date(value).toISOString() : fallback;
}

function mapMessages(
  messages: HermesTranscriptMessage[],
  sessionStart: string,
  sessionEnd: string,
  sessionId: string,
) {
  const visible = messages.filter(
    (message): message is Required<Pick<HermesTranscriptMessage, "role" | "content">> =>
      (message.role === "user" || message.role === "assistant") &&
      !!normalizeText(message.content ?? ""),
  );

  const start = Date.parse(sessionStart);
  const end = Date.parse(sessionEnd);
  const duration = Math.max(end - start, visible.length);

  return visible.map<ChatMessage>((message, index) => {
    const ratio = visible.length === 1 ? 0 : index / (visible.length - 1);
    const timestamp = new Date(start + Math.floor(duration * ratio)).toISOString();

    return {
      id: `${sessionId}:${index}`,
      role: message.role as "user" | "assistant",
      content: normalizeMessageContent(message.content),
      createdAt: timestamp,
    };
  });
}

interface HermesBridgeOptions {
  roots?: HermesBridgeRoot[];
}

async function getBridgeRoots(options?: HermesBridgeOptions): Promise<HermesBridgeRoot[]> {
  if (options?.roots) {
    return options.roots;
  }

  const install = await getHermesInstallStatus();
  const roots: HermesBridgeRoot[] = [];

  if (install.rootProfile.exists) {
    roots.push({
      directory: install.rootProfile.sessionsPath,
      source: toProfileSessionSource("hermes"),
      agentId: "hermes",
    });
  }

  for (const profile of install.namedProfiles) {
    if (!profile.exists) {
      continue;
    }

    roots.push({
      directory: profile.sessionsPath,
      source: toProfileSessionSource(profile.id),
      agentId: profile.id,
    });
  }

  return roots;
}

async function readTranscript(root: HermesBridgeRoot, fileName: string): Promise<ChatSession | null> {
  const filePath = join(root.directory, fileName);
  const raw = await readFile(filePath, "utf8");
  const transcript = JSON.parse(raw) as HermesTranscript;
  const agentId = toAgentId(extractIdentity(transcript.system_prompt ?? ""), root.agentId);

  if (!agentId) {
    return null;
  }

  const fallbackTime = new Date(0).toISOString();
  const createdAt = normalizeTimestamp(transcript.session_start, fallbackTime);
  const updatedAt = normalizeTimestamp(transcript.last_updated, createdAt);
  const transcriptId = transcript.session_id ?? basename(fileName, ".json");
  const id = buildImportedId(root.source, transcriptId, fileName);
  const messages = mapMessages(transcript.messages ?? [], createdAt, updatedAt, id);

  if (messages.length === 0) {
    return null;
  }

  const firstUserMessage =
    messages.find((message) => message.role === "user")?.content ?? transcriptId;

  return {
    id,
    agentId,
    title: deriveTitle(firstUserMessage),
    createdAt,
    updatedAt,
    archived: false,
    messages,
    source: root.source,
    readOnly: true,
    externalSessionId: transcriptId,
    runtimeSource: root.source,
    runState: null,
  };
}

export function createHermesSessionBridge(options?: HermesBridgeOptions) {
  return {
    isImportedSessionId(sessionId: string) {
      return sessionId.startsWith("import:");
    },

    async listSessions(agentId?: AgentId) {
      const roots = await getBridgeRoots(options);
      const sessions: ChatSessionSummary[] = [];

      for (const root of roots) {
        const files = await readdir(root.directory).catch(() => []);
        const candidates = files.filter((file) => file.startsWith("session_") && file.endsWith(".json"));

        for (const fileName of candidates) {
          try {
            const session = await readTranscript(root, fileName);
            if (!session) {
              continue;
            }

            if (agentId && session.agentId !== agentId) {
              continue;
            }

            sessions.push(toSummary(session));
          } catch {
            // ignore malformed transcript
          }
        }
      }

      return sessions.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    },

    async getSession(sessionId: string) {
      if (!sessionId.startsWith("import:")) {
        return null;
      }

      const roots = await getBridgeRoots(options);
      for (const root of roots) {
        const files = await readdir(root.directory).catch(() => []);
        const candidates = files.filter((file) => file.startsWith("session_") && file.endsWith(".json"));
        for (const fileName of candidates) {
          try {
            const session = await readTranscript(root, fileName);
            if (session?.id === sessionId) {
              return session;
            }
          } catch {
            // ignore malformed transcript
          }
        }
      }

      return null;
    },
  };
}

export const hermesSessionBridge = createHermesSessionBridge();
