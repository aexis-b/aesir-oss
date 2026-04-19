import { describe, expect, it } from "vitest";

import {
  buildComposerStatusItems,
  formatDurationCompact,
  summarizeCodexUsage,
} from "@/lib/composer-status";

const session = {
  id: "local-1",
  agentId: "builder",
  title: "Untitled session",
  createdAt: "2026-04-14T00:00:00.000Z",
  updatedAt: "2026-04-14T00:00:00.000Z",
  archived: false,
  messages: [
    {
      id: "m-1",
      role: "user",
      content: "First message",
      createdAt: "2026-04-14T00:00:00.000Z",
    },
    {
      id: "m-2",
      role: "assistant",
      content: "First reply",
      createdAt: "2026-04-14T00:00:01.000Z",
    },
  ],
  source: "local",
  readOnly: false,
  externalSessionId: "6c76877c-f3a5-4d87-bcbc-b9460d37b5e1",
  runtimeSource: "hermes-profile-cli:builder",
  runState: null,
} as const;

describe("composer status", () => {
  it("formats compact reset durations", () => {
    expect(formatDurationCompact(49)).toBe("49s");
    expect(formatDurationCompact(1470)).toBe("24m");
    expect(formatDurationCompact(7200)).toBe("2h");
    expect(formatDurationCompact(176437)).toBe("2d");
  });

  it("summarizes codex usage windows into a compact label", () => {
    const usage = summarizeCodexUsage({
      plan_type: "pro",
      rate_limit: {
        allowed: true,
        limit_reached: false,
        primary_window: {
          used_percent: 10,
          limit_window_seconds: 18000,
          reset_after_seconds: 1470,
        },
        secondary_window: {
          used_percent: 16,
          limit_window_seconds: 604800,
          reset_after_seconds: 176437,
        },
      },
      credits: {
        unlimited: false,
      },
    });

    expect(usage.plan).toBe("pro");
    expect(usage.primary).toBe("5h 10% · 24m");
    expect(usage.secondary).toBe("7d 16% · 2d");
    expect(usage.compact).toBe("5h 10% · 24m / 7d 16% · 2d");
  });

  it("builds context and limit items for profile-backed threads without extra mode noise", () => {
    const items = buildComposerStatusItems({
      session,
      usage: {
        plan: "pro",
        primary: "5h 10% · 24m",
        secondary: "7d 16% · 2d",
        compact: "5h 10% · 24m / 7d 16% · 2d",
        state: "ok",
      },
    });

    expect(items).toEqual([
      { label: "ctx", value: "2 msgs · resume 6c76877c" },
      { label: "limits", value: "5h 10% · 24m / 7d 16% · 2d" },
    ]);
  });

  it("falls back to read-only mode and plan label when live limits are unavailable", () => {
    const items = buildComposerStatusItems({
      session: {
        ...session,
        readOnly: true,
        source: "hermes-root-cli",
        runtimeSource: "hermes-root-cli",
        externalSessionId: null,
      },
      usage: {
        plan: "pro",
        primary: null,
        secondary: null,
        compact: "plan pro",
        state: "unavailable",
      },
    });

    expect(items).toEqual([
      { label: "mode", value: "read-only · Hermes CLI" },
      { label: "ctx", value: "2 msgs · imported" },
      { label: "limits", value: "plan pro" },
    ]);
  });
});
