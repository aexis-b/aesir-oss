import { execFile, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { promisify } from "node:util";

import type { AgentId, SessionSource } from "@/lib/agents";
import { toProfileSessionSource } from "@/lib/agents";

const execFileAsync = promisify(execFile);
let resolvedHermesCommand: string | null | undefined;

const DEFAULT_HERMES_CANDIDATES = [
  join(homedir(), ".local", "bin", "hermes"),
  "/opt/homebrew/bin/hermes",
  "/usr/local/bin/hermes",
];

interface HermesRuntimeInput {
  agentId: AgentId;
  message: string;
  externalSessionId?: string | null;
}

export interface HermesRuntimeReply {
  content: string;
  externalSessionId: string | null;
  source: SessionSource;
}

function stripAnsi(value: string) {
  return value.replace(/\u001b\[[0-9;]*m/g, "");
}

export function __resetHermesCommandCacheForTests() {
  resolvedHermesCommand = undefined;
}

export function resolveHermesCommand() {
  if (process.env.AESIR_DISABLE_HERMES_CLI === "1") {
    return null;
  }

  if (resolvedHermesCommand !== undefined) {
    return resolvedHermesCommand;
  }

  const explicitCandidate = process.env.HERMES_BIN?.trim();
  const candidates = [explicitCandidate, ...DEFAULT_HERMES_CANDIDATES].filter(
    (candidate): candidate is string => Boolean(candidate),
  );

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      resolvedHermesCommand = candidate;
      return resolvedHermesCommand;
    }
  }

  const result = spawnSync("hermes", ["--version"], {
    encoding: "utf8",
    stdio: "ignore",
    timeout: 500,
  });

  resolvedHermesCommand = result.status === 0 ? "hermes" : null;
  return resolvedHermesCommand;
}

export function parseHermesCliOutput(output: string): HermesRuntimeReply {
  const cleaned = stripAnsi(output);
  const sessionId = cleaned.match(/^session_id:\s*(.+)$/m)?.[1]?.trim() ?? null;
  const content = cleaned
    .split(/\r?\n/)
    .filter((line) => {
      const trimmed = line.trim();
      return !(
        trimmed === "" ||
        trimmed.startsWith("╭─ ⚕ Hermes") ||
        trimmed.startsWith("↻ Resumed session") ||
        trimmed.startsWith("session_id:")
      );
    })
    .join("\n")
    .trim();

  return {
    content,
    externalSessionId: sessionId,
    source: "hermes-root-cli",
  };
}

export async function generateHermesProfileReply({
  agentId,
  message,
  externalSessionId,
}: HermesRuntimeInput): Promise<HermesRuntimeReply> {
  const hermesCommand = resolveHermesCommand();

  if (!hermesCommand) {
    throw new Error("Hermes CLI not available");
  }

  const args: string[] = [];
  const normalizedAgentId = agentId.trim().toLowerCase();

  if (normalizedAgentId !== "hermes") {
    args.push("--profile", normalizedAgentId);
  }

  args.push("chat", "-Q", "--source", "tool");

  if (externalSessionId) {
    args.push("--resume", externalSessionId);
  }

  args.push("-q", message);

  const { stdout } = await execFileAsync(hermesCommand, args, {
    cwd: process.cwd(),
    env: process.env,
    maxBuffer: 1024 * 1024 * 4,
    timeout: 1000 * 60 * 8,
  });

  const parsed = parseHermesCliOutput(stdout);

  return {
    ...parsed,
    source: toProfileSessionSource(normalizedAgentId),
  };
}
