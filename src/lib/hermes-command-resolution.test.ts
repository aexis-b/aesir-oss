import { beforeEach, describe, expect, it, vi } from "vitest";
import { homedir } from "node:os";
import { join } from "node:path";

const { existsSyncMock, spawnSyncMock } = vi.hoisted(() => ({
  existsSyncMock: vi.fn<(path: string) => boolean>(),
  spawnSyncMock: vi.fn(() => ({ status: 1 })),
}));

vi.mock("node:fs", () => ({
  existsSync: existsSyncMock,
}));

vi.mock("node:child_process", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:child_process")>();

  return {
    ...actual,
    spawnSync: spawnSyncMock,
  };
});

import {
  __resetHermesCommandCacheForTests,
  resolveHermesCommand,
} from "@/lib/hermes-profile-runtime";

describe("hermes command resolution", () => {
  beforeEach(() => {
    delete process.env.AESIR_DISABLE_HERMES_CLI;
    delete process.env.HERMES_BIN;
    existsSyncMock.mockReset();
    spawnSyncMock.mockReset();
    spawnSyncMock.mockReturnValue({ status: 1 });
    __resetHermesCommandCacheForTests();
  });

  it("prefers the local install path when PATH lookup would miss hermes", () => {
    const expected = join(homedir(), ".local", "bin", "hermes");
    existsSyncMock.mockImplementation((candidate) => candidate === expected);

    expect(resolveHermesCommand()).toBe(expected);
    expect(spawnSyncMock).not.toHaveBeenCalled();
  });
});
