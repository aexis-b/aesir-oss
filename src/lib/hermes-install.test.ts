import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { getHermesHome, getHermesInstallStatus } from "@/lib/hermes-install";

const cleanup: string[] = [];

afterEach(async () => {
  delete process.env.HERMES_HOME;
  while (cleanup.length > 0) {
    const target = cleanup.pop();
    if (target) {
      await rm(target, { recursive: true, force: true });
    }
  }
});

describe("hermes install", () => {
  it("normalizes a profile-scoped HERMES_HOME back to the root install", () => {
    process.env.HERMES_HOME = "/tmp/example/.hermes/profiles/atlas";
    expect(getHermesHome()).toBe("/tmp/example/.hermes");
  });

  it("discovers root and named profiles from Hermes home", async () => {
    const hermesHome = await mkdtemp(join(tmpdir(), "aesir-oss-hermes-"));
    cleanup.push(hermesHome);
    await mkdir(join(hermesHome, "profiles", "builder"), { recursive: true });
    await mkdir(join(hermesHome, "profiles", "research"), { recursive: true });
    await writeFile(join(hermesHome, "config.yaml"), "model: {}\n");
    process.env.HERMES_HOME = hermesHome;

    const install = await getHermesInstallStatus();
    expect(install.hermesHome).toBe(hermesHome);
    expect(install.rootProfile.id).toBe("hermes");
    expect(install.namedProfiles.map((profile) => profile.id)).toEqual(["builder", "research"]);
  });
});
