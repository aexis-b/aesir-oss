import type { AgentId, MessageRole, SessionSource } from "@/lib/agents";
import { getAgent } from "@/lib/agents";
import { generateHermesProfileReply, resolveHermesCommand } from "@/lib/hermes-profile-runtime";

interface RuntimeMessage {
  role: MessageRole;
  content: string;
  speakerId?: AgentId | null;
  speakerName?: string | null;
}

interface GenerateAgentReplyInput {
  agentId: AgentId;
  messages: RuntimeMessage[];
  externalSessionId?: string | null;
}

export type RuntimeMode = "profile-runtime" | "local-fallback" | "openai-compatible";

interface ProviderConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  label: RuntimeMode;
  headers?: Record<string, string>;
}

export interface AgentReplyResult {
  content: string;
  externalSessionId: string | null;
  runtimeSource: SessionSource | null;
  speakerId: AgentId;
  speakerName: string;
}

function hasHermesCommand() {
  return Boolean(resolveHermesCommand());
}

function getProviderConfig(): ProviderConfig | null {
  if (process.env.OPENROUTER_API_KEY) {
    return {
      apiKey: process.env.OPENROUTER_API_KEY,
      baseUrl: process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1/chat/completions",
      model: process.env.OPENROUTER_MODEL ?? "openai/gpt-4.1-mini",
      label: "openai-compatible",
      headers: {
        "HTTP-Referer": "https://github.com/NousResearch/hermes-agent",
        "X-Title": "Aesir OSS",
      },
    };
  }

  if (process.env.OPENAI_API_KEY) {
    return {
      apiKey: process.env.OPENAI_API_KEY,
      baseUrl: process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1/chat/completions",
      model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
      label: "openai-compatible",
    };
  }

  return null;
}

export function getRuntimeMode(): RuntimeMode {
  if (hasHermesCommand()) {
    return "profile-runtime";
  }

  return getProviderConfig()?.label ?? "local-fallback";
}

function getLatestUserMessage(messages: RuntimeMessage[]) {
  return messages.findLast((message) => message.role === "user")?.content.trim() ?? "";
}

function fallbackReply(agentId: AgentId, latestUserMessage: string) {
  const agent = getAgent(agentId);
  const focus = latestUserMessage || "your request";
  return `${agent.name} can’t reach Hermes CLI right now, so I can’t answer ${focus.includes("\n") ? "that request" : `“${focus}”`} through the real profile runtime. Check your Hermes install or configure an OpenAI-compatible provider.`;
}

async function generateOpenAiCompatibleReply({ agentId, messages }: GenerateAgentReplyInput) {
  const provider = getProviderConfig();

  if (!provider) {
    return null;
  }

  const agent = getAgent(agentId);
  const response = await fetch(provider.baseUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${provider.apiKey}`,
      ...provider.headers,
    },
    body: JSON.stringify({
      model: provider.model,
      temperature: 0.4,
      messages: [
        {
          role: "system",
          content: `You are ${agent.name}. Respond tersely, clearly, and helpfully. Avoid markdown tables.`,
        },
        ...messages,
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Provider returned ${response.status}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: string;
      };
    }>;
  };

  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) {
    return null;
  }

  return {
    content,
    externalSessionId: null,
    runtimeSource: null,
  } satisfies Omit<AgentReplyResult, "speakerId" | "speakerName">;
}

function attachSpeaker(agentId: AgentId, result: Omit<AgentReplyResult, "speakerId" | "speakerName">): AgentReplyResult {
  const agent = getAgent(agentId);
  return {
    ...result,
    speakerId: agentId,
    speakerName: agent.name,
  };
}

export async function generateAgentReplyResults(input: GenerateAgentReplyInput): Promise<AgentReplyResult[]> {
  const latestUserMessage = getLatestUserMessage(input.messages);

  if (hasHermesCommand()) {
    try {
      const reply = await generateHermesProfileReply({
        agentId: input.agentId,
        message: latestUserMessage,
        externalSessionId: input.externalSessionId,
      });

      return [
        attachSpeaker(input.agentId, {
          content: reply.content,
          externalSessionId: reply.externalSessionId,
          runtimeSource: reply.source,
        }),
      ];
    } catch {
      // fall through
    }
  }

  try {
    const compatibleReply = await generateOpenAiCompatibleReply(input);
    if (compatibleReply) {
      return [attachSpeaker(input.agentId, compatibleReply)];
    }
  } catch {
    // fall through
  }

  return [
    attachSpeaker(input.agentId, {
      content: fallbackReply(input.agentId, latestUserMessage),
      externalSessionId: null,
      runtimeSource: null,
    }),
  ];
}

export async function generateAgentReply(input: GenerateAgentReplyInput): Promise<string> {
  const result = await generateAgentReplyResult(input);
  return result.content;
}

export async function generateAgentReplyResult(input: GenerateAgentReplyInput): Promise<AgentReplyResult> {
  const [result] = await generateAgentReplyResults(input);
  if (!result) {
    throw new Error("No agent reply generated");
  }

  return result;
}
