export type AgentId = string;
export type MessageRole = "user" | "assistant";
export type SessionSource = "local" | "hermes-root-cli" | `hermes-profile-cli:${string}`;

export interface AgentDefinition {
  id: AgentId;
  name: string;
  accent: string;
  lightAccent: string;
  glyph: string;
}

export interface RunTrace {
  phase: "running" | "complete" | "error";
  title: string;
  lines: string[];
}

export interface ChatRunState {
  phase: "running" | "error";
  activePrompt: string;
  queuedPrompts: string[];
  trace: RunTrace;
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  createdAt: string;
  speakerId?: AgentId | null;
  speakerName?: string | null;
}

export interface ChatSession {
  id: string;
  agentId: AgentId;
  title: string;
  createdAt: string;
  updatedAt: string;
  archived: boolean;
  messages: ChatMessage[];
  source: SessionSource;
  readOnly: boolean;
  externalSessionId: string | null;
  runtimeSource: SessionSource | null;
  runState: ChatRunState | null;
}

export interface ChatSessionSummary {
  id: string;
  agentId: AgentId;
  title: string;
  createdAt: string;
  updatedAt: string;
  archived: boolean;
  messageCount: number;
  preview: string;
  source: SessionSource;
  readOnly: boolean;
  externalSessionId: string | null;
  runtimeSource: SessionSource | null;
}

const DARK_ACCENTS = ["#c5a6ff", "#8fd1a1", "#85b6ff", "#ff9f6b", "#d6b58e", "#f17ecb"];
const LIGHT_ACCENTS = ["#9270cf", "#6f9b7b", "#5b8fd7", "#cf7d50", "#b28a64", "#c058a0"];
const GLYPHS = ["◉", "◌", "△", "□", "◇", "✦", "✳", "⬡", "◎"];

function titleCase(value: string) {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function hash(value: string) {
  return [...value].reduce((total, char) => total + char.charCodeAt(0), 0);
}

export function getAgent(agentId: AgentId): AgentDefinition {
  const token = hash(agentId);
  return {
    id: agentId,
    name: agentId === "hermes" ? "Hermes" : titleCase(agentId),
    accent: DARK_ACCENTS[token % DARK_ACCENTS.length]!,
    lightAccent: LIGHT_ACCENTS[token % LIGHT_ACCENTS.length]!,
    glyph: GLYPHS[token % GLYPHS.length]!,
  };
}

export function isAgentId(value: string): value is AgentId {
  return /^[a-z0-9][a-z0-9_-]*$/i.test(value.trim());
}

export function isRootSessionSource(source: SessionSource | null | undefined) {
  return source === "hermes-root-cli";
}

export function toProfileSessionSource(agentId: AgentId): SessionSource {
  return agentId === "hermes" ? "hermes-root-cli" : `hermes-profile-cli:${agentId}`;
}

export function formatSessionSource(source: SessionSource | string) {
  if (source === "local") {
    return "Aesir";
  }

  if (source === "hermes-root-cli" || source === "hermes-cli") {
    return "Hermes CLI";
  }

  if (source.startsWith("hermes-profile-cli:")) {
    return `${titleCase(source.slice("hermes-profile-cli:".length))} CLI`;
  }

  if (source.endsWith("-cli")) {
    return `${titleCase(source.slice(0, -4))} CLI`;
  }

  return source;
}
