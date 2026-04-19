import { describe, expect, it } from "vitest";

import { filterCommandMenuItems, getCommandInsertion, moveCommandSelection } from "@/lib/chat-command-menu";
import { TUI_COMMANDS } from "@/lib/slash-commands";

describe("chat command menu", () => {
  it("filters commands by name, alias, description, and category", () => {
    const providerMatches = filterCommandMenuItems(TUI_COMMANDS, "provi");

    expect(filterCommandMenuItems(TUI_COMMANDS, "queue").some((command) => command.name === "queue")).toBe(true);
    expect(filterCommandMenuItems(TUI_COMMANDS, "reset").some((command) => command.name === "new")).toBe(true);
    expect(filterCommandMenuItems(TUI_COMMANDS, "provider").some((command) => command.name === "provider")).toBe(true);
    expect(filterCommandMenuItems(TUI_COMMANDS, "session").some((command) => command.name === "new")).toBe(true);
    expect(providerMatches[0]?.name).toBe("provider");
  });

  it("wraps keyboard selection cleanly", () => {
    expect(moveCommandSelection(0, -1, 5)).toBe(4);
    expect(moveCommandSelection(4, 1, 5)).toBe(0);
    expect(moveCommandSelection(1, 1, 5)).toBe(2);
  });

  it("builds the inserted slash command text", () => {
    const title = TUI_COMMANDS.find((command) => command.name === "title");
    const help = TUI_COMMANDS.find((command) => command.name === "help");

    expect(title).toBeTruthy();
    expect(help).toBeTruthy();
    expect(getCommandInsertion(title!)).toBe("/title ");
    expect(getCommandInsertion(help!)).toBe("/help");
  });
});
