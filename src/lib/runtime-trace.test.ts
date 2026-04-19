import { beforeEach, describe, expect, it } from "vitest";

import { buildPendingRunTrace } from "@/lib/runtime-trace";

const baseSession = {
  id: "local-1",
  agentId: "builder",
  title: "Untitled session",
  createdAt: "2026-04-14T00:00:00.000Z",
  updatedAt: "2026-04-14T00:00:00.000Z",
  archived: false,
  messages: [],
  source: "local",
  readOnly: false,
  externalSessionId: null,
  runtimeSource: null,
  runState: null,
} as const;

beforeEach(() => {
  process.env.AESIR_DISABLE_HERMES_CLI = "1";
});

describe("runtime trace", () => {
  it("builds a pending profile-backed trace", () => {
    const trace = buildPendingRunTrace({
      agentId: "builder",
      session: baseSession,
      runtimeMode: "profile-runtime",
      profileSettings: {
        agentId: "builder",
        profileName: "builder",
        home: "/tmp/builder",
        model: "gpt-5.4",
        provider: "openai-codex",
        baseUrl: "https://chatgpt.com/backend-api/codex",
        personality: "concise",
        skin: "default",
        toolsets: ["terminal"],
        authProvider: "openai-codex",
        authMode: "chatgpt",
      },
    });

    expect(trace.phase).toBe("running");
    expect(trace.title).toBe("Builder");
    expect(trace.lines[0]).toContain("openai-codex/gpt-5.4");
    expect(trace.lines[1]).toContain("openai-codex/chatgpt");
  });

  it("falls back to runtime labels when profile settings are unavailable", () => {
    const trace = buildPendingRunTrace({
      agentId: "hermes",
      session: { ...baseSession, agentId: "hermes", runtimeSource: "hermes-root-cli" },
      runtimeMode: "local-fallback",
      profileSettings: null,
    });

    expect(trace.title).toBe("Hermes");
    expect(trace.lines[0]).toContain("local-fallback");
    expect(trace.lines[3]).toContain("Hermes CLI");
  });
});
