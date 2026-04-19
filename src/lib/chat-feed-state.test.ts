import { describe, expect, it } from "vitest";

import { buildTransientFeedState } from "@/lib/chat-feed-state";

describe("chat feed state", () => {
  it("surfaces the pending user message, queued prompts, and a compact working label", () => {
    const state = buildTransientFeedState({
      pendingPrompt: "Show me the final landing page copy.",
      queuedPrompts: ["Then tighten the headline.", "Then cut the body in half."],
      runTrace: {
        phase: "running",
        title: "Xiios",
        lines: [
          "runtime :: openai-codex/gpt-5.4",
          "auth :: openai-codex/chatgpt",
          "status :: waiting for model/tool activity",
        ],
      },
    });

    expect(state.pendingPrompt).toBe("Show me the final landing page copy.");
    expect(state.queueCards).toEqual([
      { id: "queued-0", content: "Then tighten the headline.", position: 1 },
      { id: "queued-1", content: "Then cut the body in half.", position: 2 },
    ]);
    expect(state.activityLabel).toBe("thinking…");
  });

  it("falls back to the trace status text when present", () => {
    const state = buildTransientFeedState({
      pendingPrompt: null,
      queuedPrompts: [],
      runTrace: {
        phase: "complete",
        title: "Hall relay",
        lines: ["status :: replies merged into shared hall thread"],
      },
    });

    expect(state.pendingPrompt).toBeNull();
    expect(state.queueCards).toEqual([]);
    expect(state.activityLabel).toBe("replies merged into shared hall thread");
  });
});
