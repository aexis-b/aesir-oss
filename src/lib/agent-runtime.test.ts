import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("node:child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:child_process")>();

  return {
    ...actual,
    spawnSync: vi.fn(() => ({ status: 1 })),
  };
});

import { generateAgentReply, generateAgentReplyResults } from "@/lib/agent-runtime";

beforeEach(() => {
  process.env.AESIR_DISABLE_HERMES_CLI = "1";
  delete process.env.OPENAI_API_KEY;
  delete process.env.OPENROUTER_API_KEY;
});

describe("agent runtime fallback", () => {
  it("returns a generic fallback reply when Hermes CLI is unavailable", async () => {
    const reply = await generateAgentReply({
      agentId: "builder",
      messages: [{ role: "user", content: "Build me a minimal shell." }],
    });

    expect(reply).toContain("Builder");
    expect(reply).toContain("minimal shell");
    expect(reply).toContain("Hermes CLI");
  });

  it("returns a single profile-scoped reply result", async () => {
    const replies = await generateAgentReplyResults({
      agentId: "research",
      messages: [{ role: "user", content: "What pattern do you see in this workflow?" }],
    });

    expect(replies).toHaveLength(1);
    expect(replies[0]?.speakerId).toBe("research");
    expect(replies[0]?.speakerName).toBe("Research");
    expect(replies[0]?.content).toContain("workflow");
  });
});
