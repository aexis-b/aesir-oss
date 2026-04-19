import { readFile } from "node:fs/promises";

import type { AgentId } from "@/lib/agents";
import type { CodexUsagePayload, CodexUsageSummary } from "@/lib/composer-status";
import { summarizeCodexUsage } from "@/lib/composer-status";
import { getProfilePaths } from "@/lib/profile-settings";

interface AuthFile {
  active_provider?: string;
  providers?: Record<
    string,
    {
      tokens?: {
        access_token?: string;
        id_token?: string;
      };
    }
  >;
}

function decodeBase64Url(value: string) {
  return Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

function readPlanFromIdToken(idToken: string | undefined) {
  if (!idToken) {
    return null;
  }

  try {
    const [, payload] = idToken.split(".");

    if (!payload) {
      return null;
    }

    const claims = JSON.parse(decodeBase64Url(payload)) as {
      [key: string]: unknown;
      "https://api.openai.com/auth"?: {
        chatgpt_plan_type?: string;
      };
    };

    return claims["https://api.openai.com/auth"]?.chatgpt_plan_type ?? null;
  } catch {
    return null;
  }
}

async function readAuth(agentId: AgentId) {
  const paths = await getProfilePaths(agentId);
  if (!paths) {
    return {} as AuthFile;
  }

  const authText = await readFile(paths.authPath, "utf8").catch(() => "{}");
  return JSON.parse(authText) as AuthFile;
}

export async function getCodexUsageSummary(agentId: AgentId): Promise<CodexUsageSummary> {
  const auth = await readAuth(agentId);
  const providerKey = auth.active_provider ?? "openai-codex";
  const provider = auth.providers?.[providerKey] ?? auth.providers?.["openai-codex"];
  const accessToken = provider?.tokens?.access_token;
  const fallbackPlan = readPlanFromIdToken(provider?.tokens?.id_token) ?? "unknown";

  if (!accessToken) {
    return summarizeCodexUsage({ plan_type: fallbackPlan });
  }

  try {
    const response = await fetch("https://chatgpt.com/backend-api/wham/usage", {
      method: "GET",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": "Aesir OSS/0.1",
      },
    });

    if (!response.ok) {
      return summarizeCodexUsage({ plan_type: fallbackPlan });
    }

    const payload = (await response.json()) as CodexUsagePayload;
    return summarizeCodexUsage({ ...payload, plan_type: payload.plan_type ?? fallbackPlan });
  } catch {
    return summarizeCodexUsage({ plan_type: fallbackPlan });
  }
}
