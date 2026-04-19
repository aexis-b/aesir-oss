import { describe, expect, it } from "vitest";

import { parseHermesCliOutput } from "@/lib/hermes-profile-runtime";

describe("hermes profile runtime", () => {
  it("parses quiet Hermes CLI output and extracts the session id", () => {
    const parsed = parseHermesCliOutput(`↻ Resumed session 20260414_030109_476a36 (1 user message, 2 total messages)\n\n╭─ ⚕ Hermes ───────────────────────────────────────────────────────────────────╮\nREADY\n\nsession_id: 20260414_030109_476a36`);

    expect(parsed.content).toBe("READY");
    expect(parsed.externalSessionId).toBe("20260414_030109_476a36");
  });
});
