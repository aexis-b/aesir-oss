import type { SlashCommandDefinition } from "@/lib/slash-commands";

export function filterCommandMenuItems(commands: SlashCommandDefinition[], query: string) {
  const normalized = query.trim().replace(/^\//, "").toLowerCase();

  if (!normalized) {
    return commands;
  }

  return commands
    .map((command) => {
      const aliasStarts = command.aliases.some((alias) => alias.toLowerCase().startsWith(normalized));
      const aliasIncludes = command.aliases.some((alias) => alias.toLowerCase().includes(normalized));
      const description = command.description.toLowerCase();
      const category = command.category.toLowerCase();

      let score = 99;
      if (command.name === normalized || command.aliases.some((alias) => alias.toLowerCase() === normalized)) score = 0;
      else if (command.name.startsWith(normalized) || aliasStarts) score = 1;
      else if (command.name.includes(normalized) || aliasIncludes) score = 2;
      else if (description.includes(normalized)) score = 3;
      else if (category.includes(normalized)) score = 4;

      return { command, score };
    })
    .filter((entry) => entry.score < 99)
    .sort((left, right) => left.score - right.score || left.command.name.localeCompare(right.command.name))
    .map((entry) => entry.command);
}

export function moveCommandSelection(currentIndex: number, direction: -1 | 1, total: number) {
  if (total <= 0) {
    return 0;
  }

  return (currentIndex + direction + total) % total;
}

export function getCommandInsertion(command: SlashCommandDefinition) {
  return `/${command.name}${command.argsHint ? " " : ""}`;
}
