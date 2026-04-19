import { readFile } from "node:fs/promises";

import { parse } from "yaml";

import type { AgentId } from "@/lib/agents";
import { getProfileInstallById } from "@/lib/hermes-install";

interface ProfilePaths {
  name: string;
  home: string;
  configPath: string;
  authPath: string;
  sessionsPath: string;
}

export interface ProfileSettingsSummary {
  agentId: AgentId;
  profileName: string;
  home: string;
  model: string;
  provider: string;
  baseUrl: string;
  personality: string;
  skin: string;
  toolsets: string[];
  authProvider: string | null;
  authMode: string | null;
}

export async function getProfilePaths(agentId: AgentId): Promise<ProfilePaths | null> {
  const install = await getProfileInstallById(agentId);
  if (!install) {
    return null;
  }

  return {
    name: install.id,
    home: install.home,
    configPath: install.configPath,
    authPath: install.authPath,
    sessionsPath: install.sessionsPath,
  };
}

export async function getProfileSettings(agentId: AgentId): Promise<ProfileSettingsSummary | null> {
  const paths = await getProfilePaths(agentId);
  if (!paths) {
    return null;
  }

  try {
    const [configText, authText] = await Promise.all([
      readFile(paths.configPath, "utf8"),
      readFile(paths.authPath, "utf8").catch(() => "{}"),
    ]);

    const config = parse(configText) as {
      model?: { default?: string; provider?: string; base_url?: string };
      display?: { personality?: string; skin?: string };
      toolsets?: string[];
    };
    const auth = JSON.parse(authText) as {
      active_provider?: string;
      providers?: Record<string, { auth_mode?: string }>;
    };
    const activeAuthProvider = auth.active_provider ?? null;

    return {
      agentId,
      profileName: paths.name,
      home: paths.home,
      model: config.model?.default ?? "unknown",
      provider: config.model?.provider ?? "unknown",
      baseUrl: config.model?.base_url ?? "",
      personality: config.display?.personality ?? "default",
      skin: config.display?.skin ?? "default",
      toolsets: Array.isArray(config.toolsets) ? config.toolsets : [],
      authProvider: activeAuthProvider,
      authMode: activeAuthProvider ? auth.providers?.[activeAuthProvider]?.auth_mode ?? null : null,
    };
  } catch {
    return null;
  }
}
