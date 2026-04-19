import { describe, expect, it } from "vitest";

import { buildMentionDispatchPlan } from "@/lib/mention-dispatch";

describe("mention dispatch", () => {
  it("prefixes the forwarded message with the sender profile mention", () => {
    expect(buildMentionDispatchPlan("hermes", "hermes", "@atlas hey!")).toEqual({
      targetIds: ["atlas"],
      forwardedBody: "hey!",
      forwardedMessage: "Message from @hermes: hey!",
    });
  });

  it("strips common lead-in phrasing while preserving contextual mentions in the body", () => {
    expect(
      buildMentionDispatchPlan(
        "hermes",
        "hermes",
        "Tell @atlas to use the markdowns I just made for @scribe",
      ),
    ).toEqual({
      targetIds: ["atlas"],
      forwardedBody: "use the markdowns I just made for @scribe",
      forwardedMessage: "Message from @hermes: use the markdowns I just made for @scribe",
    });
  });

  it("supports multiple direct targets without treating later body mentions as dispatch targets", () => {
    expect(
      buildMentionDispatchPlan("hermes", "hermes", "@atlas @scribe review this with @operator"),
    ).toEqual({
      targetIds: ["atlas", "scribe"],
      forwardedBody: "review this with @operator",
      forwardedMessage: "Message from @hermes: review this with @operator",
    });
  });

  it("falls back to a bare sender notice when no body remains", () => {
    expect(buildMentionDispatchPlan("hermes", "hermes", "@atlas")).toEqual({
      targetIds: ["atlas"],
      forwardedBody: "",
      forwardedMessage: "Message from @hermes.",
    });
  });
});
