import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { createSessionStore } from "@/lib/session-store";

async function createIsolatedStore() {
  const directory = await mkdtemp(join(tmpdir(), "constellation-chat-"));

  return {
    directory,
    store: createSessionStore(join(directory, "sessions.json")),
  };
}

afterEach(async (context) => {
  const directory = context.task.meta.directory as string | undefined;

  if (directory) {
    await rm(directory, { recursive: true, force: true });
  }
});

describe("session store", () => {
  it("creates sessions and lists them newest first", async (context) => {
    const { directory, store } = await createIsolatedStore();
    context.task.meta.directory = directory;

    const first = await store.createSession("hermes");
    await store.appendMessage(first.id, "user", "Earlier thread");

    const second = await store.createSession("atlas");
    await store.appendMessage(second.id, "user", "Latest thread");

    const sessions = await store.listSessions();

    expect(sessions.map((session) => session.id)).toEqual([second.id, first.id]);
  });

  it("filters sessions by agent and derives a title from the first user message", async (context) => {
    const { directory, store } = await createIsolatedStore();
    context.task.meta.directory = directory;

    const hermes = await store.createSession("hermes");
    await store.appendMessage(
      hermes.id,
      "user",
      "Map the architecture for a local-first memory system.",
    );

    const analyst = await store.createSession("analyst");
    await store.appendMessage(analyst.id, "user", "Talk to me about symbolic patterns.");

    const hermesSessions = await store.listSessions("hermes");

    expect(hermesSessions).toHaveLength(1);
    expect(hermesSessions[0]?.title).toBe("Map the architecture for a local-first memory…");
  });

  it("persists run state across queued prompts and failures", async (context) => {
    const { directory, store } = await createIsolatedStore();
    context.task.meta.directory = directory;

    const session = await store.createSession("atlas");
    const runningTrace = {
      phase: "running" as const,
      title: "Atlas",
      lines: ["status :: waiting for model/tool activity"],
    };

    await store.activateRun(session.id, "Ship the first version.", runningTrace);
    await store.queuePrompt(session.id, "Then tighten the copy.");

    const active = await store.getSession(session.id);
    expect(active?.runState?.phase).toBe("running");
    expect(active?.runState?.activePrompt).toBe("Ship the first version.");
    expect(active?.runState?.queuedPrompts).toEqual(["Then tighten the copy."]);

    const resolved = await store.resolveRun(session.id, {
      replies: [{ content: "First version shipped.", speakerId: "atlas", speakerName: "Atlas" }],
      nextTrace: runningTrace,
    });

    expect(resolved.result).toBe("Then tighten the copy.");
    expect(resolved.session.messages.map((message) => message.content)).toEqual([
      "Ship the first version.",
      "First version shipped.",
      "Then tighten the copy.",
    ]);
    expect(resolved.session.runState?.activePrompt).toBe("Then tighten the copy.");
    expect(resolved.session.runState?.queuedPrompts).toEqual([]);

    const failed = await store.failRun(session.id, {
      phase: "error",
      title: "Atlas",
      lines: ["Provider timeout"],
    });

    expect(failed.runState?.phase).toBe("error");
    expect(failed.runState?.trace.lines).toEqual(["Provider timeout"]);
  });

  it("archives and restores sessions without needing a database", async (context) => {
    const { directory, store } = await createIsolatedStore();
    context.task.meta.directory = directory;

    const session = await store.createSession("hermes");
    expect(session.archived).toBe(false);

    const archived = await store.updateSession(session.id, { archived: true });
    expect(archived.archived).toBe(true);

    const storedArchived = await store.getSession(session.id);
    expect(storedArchived?.archived).toBe(true);

    const summaries = await store.listSessions("hermes");
    expect(summaries[0]?.archived).toBe(true);

    const restored = await store.updateSession(session.id, { archived: false });
    expect(restored.archived).toBe(false);
  });

  it("persists sessions via atomic replace without leaving temp files behind", async (context) => {
    const { directory, store } = await createIsolatedStore();
    context.task.meta.directory = directory;

    const session = await store.createSession("hermes");
    await store.appendMessage(session.id, "user", "Atomic write check");

    const files = await readdir(directory);
    expect(files).toEqual(["sessions.json"]);
  });
});
