import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { randomUUID } from "node:crypto";

import type {
  AgentId,
  ChatMessage,
  ChatRunState,
  ChatSession,
  ChatSessionSummary,
  MessageRole,
  RunTrace,
  SessionSource,
} from "@/lib/agents";

interface SessionFile {
  sessions: ChatSession[];
}

interface AppendMessageOptions {
  speakerId?: AgentId | null;
  speakerName?: string | null;
}

interface ResolveRunReply extends AppendMessageOptions {
  content: string;
}

const DEFAULT_TITLE = "Untitled session";
const TITLE_LIMIT = 46;
const DEFAULT_DATA_ROOT = process.env.AESIR_DATA_DIR ?? process.cwd();
const DEFAULT_STORE_PATH = join(DEFAULT_DATA_ROOT, "data", "sessions.json");

function buildEmptyStore(): SessionFile {
  return { sessions: [] };
}

export function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeMessageContent(value: string) {
  return value
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[\t ]+$/g, ""))
    .join("\n")
    .trim();
}

function normalizeTrace(trace: RunTrace | null | undefined): RunTrace | null {
  if (!trace) {
    return null;
  }

  return {
    phase: trace.phase,
    title: trace.title,
    lines: Array.isArray(trace.lines) ? trace.lines.map((line) => line.trim()).filter(Boolean) : [],
  };
}

function normalizeRunState(runState: ChatRunState | null | undefined): ChatRunState | null {
  if (!runState) {
    return null;
  }

  const activePrompt = normalizeMessageContent(runState.activePrompt ?? "");
  const trace = normalizeTrace(runState.trace);

  if (!activePrompt || !trace || (runState.phase !== "running" && runState.phase !== "error")) {
    return null;
  }

  return {
    phase: runState.phase,
    activePrompt,
    queuedPrompts: Array.isArray(runState.queuedPrompts)
      ? runState.queuedPrompts.map((prompt) => normalizeMessageContent(prompt)).filter(Boolean)
      : [],
    trace,
  };
}

export function deriveTitle(value: string) {
  const normalized = normalizeText(value);

  if (!normalized) {
    return DEFAULT_TITLE;
  }

  if (normalized.length <= TITLE_LIMIT) {
    return normalized;
  }

  return `${normalized.slice(0, TITLE_LIMIT).replace(/[\s.,:;!?-]+$/u, "")}…`;
}

export function buildPreview(messages: ChatMessage[]) {
  const latest = messages.at(-1);

  if (!latest) {
    return "No messages yet";
  }

  const normalized = normalizeText(latest.content);
  const previewBody =
    normalized.length <= 72
      ? normalized
      : `${normalized.slice(0, 72).replace(/[\s.,:;!?-]+$/u, "")}…`;

  if (latest.role === "assistant" && latest.speakerName) {
    return `${latest.speakerName} · ${previewBody}`;
  }

  return previewBody;
}

function createMessage(role: MessageRole, content: string, createdAt: string, options: AppendMessageOptions = {}): ChatMessage {
  return {
    id: randomUUID(),
    role,
    content: normalizeMessageContent(content),
    createdAt,
    speakerId: options.speakerId ?? null,
    speakerName: options.speakerName ?? null,
  };
}

function pushMessage(session: ChatSession, role: MessageRole, content: string, createdAt: string, options: AppendMessageOptions = {}) {
  const message = createMessage(role, content, createdAt, options);
  const hadUserMessage = session.messages.some((entry) => entry.role === "user");

  session.messages.push(message);
  session.updatedAt = createdAt;

  if (!hadUserMessage && role === "user" && session.title === DEFAULT_TITLE) {
    session.title = deriveTitle(content);
  }

  return message;
}

export function normalizeSession(session: ChatSession): ChatSession {
  return {
    ...session,
    archived: session.archived ?? false,
    source: (session.source ?? "local") as SessionSource,
    readOnly: session.readOnly ?? false,
    externalSessionId: session.externalSessionId ?? null,
    runtimeSource: (session.runtimeSource ?? null) as SessionSource | null,
    runState: normalizeRunState(session.runState),
    messages: session.messages.map((message) => ({
      ...message,
      speakerId: message.speakerId ?? null,
      speakerName: message.speakerName ?? null,
    })),
  };
}

export function toSummary(session: ChatSession): ChatSessionSummary {
  const normalizedSession = normalizeSession(session);

  return {
    id: normalizedSession.id,
    agentId: normalizedSession.agentId,
    title: normalizedSession.title,
    createdAt: normalizedSession.createdAt,
    updatedAt: normalizedSession.updatedAt,
    archived: normalizedSession.archived,
    messageCount: normalizedSession.messages.length,
    preview: buildPreview(normalizedSession.messages),
    source: normalizedSession.source,
    readOnly: normalizedSession.readOnly,
    externalSessionId: normalizedSession.externalSessionId,
    runtimeSource: normalizedSession.runtimeSource,
  };
}

export function createSessionStore(filePath = DEFAULT_STORE_PATH) {
  let queue = Promise.resolve();
  let lastTimestamp = 0;

  function nextTimestamp() {
    const now = Date.now();
    lastTimestamp = Math.max(now, lastTimestamp + 1);
    return new Date(lastTimestamp).toISOString();
  }

  async function ensureStore() {
    await mkdir(dirname(filePath), { recursive: true });

    try {
      const raw = await readFile(filePath, "utf8");
      const parsed = JSON.parse(raw) as Partial<SessionFile>;

      return {
        sessions: Array.isArray(parsed.sessions) ? parsed.sessions.map(normalizeSession) : [],
      } satisfies SessionFile;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        const empty = buildEmptyStore();
        await writeFile(filePath, JSON.stringify(empty, null, 2));
        return empty;
      }

      throw error;
    }
  }

  async function persist(store: SessionFile) {
    const nextContent = JSON.stringify(store, null, 2);
    const tempPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;

    await writeFile(tempPath, nextContent);
    await rename(tempPath, filePath);
  }

  async function mutate<T>(updater: (store: SessionFile) => Promise<T> | T): Promise<T> {
    const run = queue.then(async () => {
      const store = await ensureStore();
      const result = await updater(store);
      await persist(store);
      return result;
    });

    queue = run.then(
      () => undefined,
      () => undefined,
    );

    return run;
  }

  async function mutateSession<T>(sessionId: string, updater: (session: ChatSession) => Promise<T> | T) {
    return mutate(async (store) => {
      const session = store.sessions.find((entry) => entry.id === sessionId);

      if (!session) {
        throw new Error(`Session not found: ${sessionId}`);
      }

      const result = await updater(session);
      return {
        result,
        session: normalizeSession(session),
      };
    });
  }

  return {
    async listSessions(agentId?: AgentId) {
      const store = await ensureStore();

      return store.sessions
        .filter((session) => (agentId ? session.agentId === agentId : true))
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
        .map(toSummary);
    },

    async getSession(sessionId: string) {
      const store = await ensureStore();
      const session = store.sessions.find((entry) => entry.id === sessionId) ?? null;
      return session ? normalizeSession(session) : null;
    },

    async createSession(agentId: AgentId, title = DEFAULT_TITLE) {
      return mutate(async (store) => {
        const now = nextTimestamp();
        const session: ChatSession = {
          id: randomUUID(),
          agentId,
          title,
          createdAt: now,
          updatedAt: now,
          archived: false,
          messages: [],
          source: "local",
          readOnly: false,
          externalSessionId: null,
          runtimeSource: null,
          runState: null,
        };

        store.sessions.push(session);
        return session;
      });
    },

    async updateSession(
      sessionId: string,
      updates: Partial<
        Pick<ChatSession, "title" | "externalSessionId" | "runtimeSource" | "archived">
      >,
    ) {
      const { session } = await mutateSession(sessionId, async (entry) => {
        if (typeof updates.title === "string" && updates.title.trim()) {
          entry.title = updates.title.trim();
        }

        if (typeof updates.archived === "boolean") {
          entry.archived = updates.archived;
          entry.updatedAt = nextTimestamp();
        }

        if (updates.externalSessionId !== undefined) {
          entry.externalSessionId = updates.externalSessionId;
        }

        if (updates.runtimeSource !== undefined) {
          entry.runtimeSource = updates.runtimeSource;
        }
      });

      return session;
    },

    async appendMessage(sessionId: string, role: MessageRole, content: string, options: AppendMessageOptions = {}) {
      const { session } = await mutateSession(sessionId, async (entry) => {
        pushMessage(entry, role, content, nextTimestamp(), options);
      });

      return session;
    },

    async activateRun(sessionId: string, prompt: string, trace: RunTrace) {
      const { session } = await mutateSession(sessionId, async (entry) => {
        const normalizedPrompt = normalizeMessageContent(prompt);
        const normalizedTrace = normalizeTrace(trace);

        if (!normalizedPrompt || !normalizedTrace) {
          throw new Error("Prompt and trace required to start run");
        }

        pushMessage(entry, "user", normalizedPrompt, nextTimestamp());
        entry.runState = {
          phase: "running",
          activePrompt: normalizedPrompt,
          queuedPrompts: [],
          trace: normalizedTrace,
        };
      });

      return session;
    },

    async queuePrompt(sessionId: string, prompt: string) {
      const { session } = await mutateSession(sessionId, async (entry) => {
        const normalizedPrompt = normalizeMessageContent(prompt);

        if (!normalizedPrompt) {
          throw new Error("Prompt required");
        }

        if (!entry.runState) {
          throw new Error(`Session is not currently running: ${sessionId}`);
        }

        entry.runState = {
          ...entry.runState,
          phase: "running",
          queuedPrompts: [...entry.runState.queuedPrompts, normalizedPrompt],
        };
        entry.updatedAt = nextTimestamp();
      });

      return session;
    },

    async resolveRun(
      sessionId: string,
      input: {
        replies: ResolveRunReply[];
        externalSessionId?: string | null;
        runtimeSource?: SessionSource | null;
        nextTrace?: RunTrace | null;
      },
    ) {
      return mutateSession(sessionId, async (entry) => {
        if (input.externalSessionId !== undefined) {
          entry.externalSessionId = input.externalSessionId;
        }

        if (input.runtimeSource !== undefined) {
          entry.runtimeSource = input.runtimeSource;
        }

        for (const reply of input.replies) {
          pushMessage(entry, "assistant", reply.content, nextTimestamp(), {
            speakerId: reply.speakerId,
            speakerName: reply.speakerName,
          });
        }

        const queue = entry.runState?.queuedPrompts ?? [];
        const [nextPrompt, ...rest] = queue;
        const normalizedTrace = normalizeTrace(input.nextTrace);

        if (nextPrompt) {
          pushMessage(entry, "user", nextPrompt, nextTimestamp());
          entry.runState = {
            phase: "running",
            activePrompt: nextPrompt,
            queuedPrompts: rest,
            trace:
              normalizedTrace ??
              entry.runState?.trace ?? {
                phase: "running",
                title: entry.agentId,
                lines: ["status :: waiting for model/tool activity"],
              },
          };
        } else {
          entry.runState = null;
          entry.updatedAt = nextTimestamp();
        }

        return nextPrompt ?? null;
      });
    },

    async failRun(sessionId: string, trace: RunTrace) {
      const { session } = await mutateSession(sessionId, async (entry) => {
        const normalizedTrace = normalizeTrace(trace);

        if (!entry.runState || !normalizedTrace) {
          entry.runState = null;
          return;
        }

        entry.runState = {
          ...entry.runState,
          phase: "error",
          trace: normalizedTrace,
        };
        entry.updatedAt = nextTimestamp();
      });

      return session;
    },
  };
}

export const sessionStore = createSessionStore();
