import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { createHermesSessionBridge } from "@/lib/hermes-session-bridge";

const cleanupDirectories: string[] = [];

async function createFixtureDirectory() {
  const directory = await mkdtemp(join(tmpdir(), "aesir-hermes-bridge-"));
  cleanupDirectories.push(directory);
  return directory;
}

async function writeTranscript(
  directory: string,
  fileName: string,
  identity: string,
  messages: Array<{ role: string; content: string }>,
  sessionId: string,
) {
  await mkdir(directory, { recursive: true });

  await writeFile(
    join(directory, fileName),
    JSON.stringify(
      {
        session_id: sessionId,
        session_start: "2026-04-14T02:00:00.000Z",
        last_updated: "2026-04-14T02:10:00.000Z",
        system_prompt: `# Identity\n${identity}\n\nrest`,
        messages,
      },
      null,
      2,
    ),
  );
}

afterEach(async () => {
  while (cleanupDirectories.length > 0) {
    const directory = cleanupDirectories.pop();
    if (directory) {
      await rm(directory, { recursive: true, force: true });
    }
  }
});

describe("hermes session bridge", () => {
  it("imports root and named profile transcripts as read-only GUI sessions", async () => {
    const directory = await createFixtureDirectory();
    const hermesDir = join(directory, "hermes");
    const builderDir = join(directory, "builder");

    await writeTranscript(
      hermesDir,
      "session_hermes.json",
      "Hermes",
      [
        { role: "user", content: "Map the product strategy for Aesir." },
        { role: "assistant", content: "Hermes reply\n\n- with spacing" },
        { role: "tool", content: "should be hidden" },
      ],
      "hermes-001",
    );

    await writeTranscript(
      builderDir,
      "session_builder.json",
      "Builder",
      [
        { role: "user", content: "Ship the UI shell." },
        { role: "assistant", content: "Builder reply" },
      ],
      "builder-001",
    );

    const bridge = createHermesSessionBridge({
      roots: [
        { directory: hermesDir, source: "hermes-root-cli", agentId: "hermes" },
        { directory: builderDir, source: "hermes-profile-cli:builder", agentId: "builder" },
      ],
    });

    const sessions = await bridge.listSessions();
    expect(sessions).toHaveLength(2);
    expect(sessions.map((session) => session.agentId).sort()).toEqual(["builder", "hermes"]);
    expect(sessions.every((session) => session.readOnly)).toBe(true);
    expect(sessions.every((session) => session.source !== "local")).toBe(true);

    const hermesSession = sessions.find((session) => session.agentId === "hermes");
    expect(hermesSession?.title).toBe("Map the product strategy for Aesir.");

    const loaded = await bridge.getSession(hermesSession!.id);
    expect(loaded?.messages).toHaveLength(2);
    expect(loaded?.messages.map((message) => message.role)).toEqual(["user", "assistant"]);
    expect(loaded?.messages[1]?.content).toBe("Hermes reply\n\n- with spacing");
  });

  it("ignores transcripts with no visible chat messages", async () => {
    const directory = await createFixtureDirectory();
    const sourceDir = join(directory, "mixed");

    await writeTranscript(
      sourceDir,
      "empty.json",
      "Builder",
      [{ role: "tool", content: "tool only" }],
      "empty-001",
    );

    const bridge = createHermesSessionBridge({
      roots: [{ directory: sourceDir, source: "hermes-profile-cli:builder", agentId: "builder" }],
    });

    expect(await bridge.listSessions()).toEqual([]);
  });
});
