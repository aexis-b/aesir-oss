export interface SlashCommandDefinition {
  name: string;
  description: string;
  category: string;
  aliases: string[];
  argsHint: string;
  subcommands: string[];
  cliOnly: boolean;
  gatewayOnly: boolean;
  guiSupported: boolean;
  guiBehavior: string | null;
}

export const TUI_COMMANDS: SlashCommandDefinition[] = [
  {
    "name": "new",
    "description": "Start a new session (fresh session ID + history)",
    "category": "Session",
    "aliases": [
      "reset"
    ],
    "argsHint": "",
    "subcommands": [],
    "cliOnly": false,
    "gatewayOnly": false,
    "guiBehavior": "session:new",
    "guiSupported": true
  },
  {
    "name": "clear",
    "description": "Clear screen and start a new session",
    "category": "Session",
    "aliases": [],
    "argsHint": "",
    "subcommands": [],
    "cliOnly": true,
    "gatewayOnly": false,
    "guiBehavior": "session:new",
    "guiSupported": true
  },
  {
    "name": "history",
    "description": "Show conversation history",
    "category": "Session",
    "aliases": [],
    "argsHint": "",
    "subcommands": [],
    "cliOnly": true,
    "gatewayOnly": false,
    "guiBehavior": null,
    "guiSupported": false
  },
  {
    "name": "save",
    "description": "Save the current conversation",
    "category": "Session",
    "aliases": [],
    "argsHint": "",
    "subcommands": [],
    "cliOnly": true,
    "gatewayOnly": false,
    "guiBehavior": null,
    "guiSupported": false
  },
  {
    "name": "retry",
    "description": "Retry the last message (resend to agent)",
    "category": "Session",
    "aliases": [],
    "argsHint": "",
    "subcommands": [],
    "cliOnly": false,
    "gatewayOnly": false,
    "guiBehavior": null,
    "guiSupported": false
  },
  {
    "name": "undo",
    "description": "Remove the last user/assistant exchange",
    "category": "Session",
    "aliases": [],
    "argsHint": "",
    "subcommands": [],
    "cliOnly": false,
    "gatewayOnly": false,
    "guiBehavior": null,
    "guiSupported": false
  },
  {
    "name": "title",
    "description": "Set a title for the current session",
    "category": "Session",
    "aliases": [],
    "argsHint": "[name]",
    "subcommands": [],
    "cliOnly": false,
    "gatewayOnly": false,
    "guiBehavior": "session:title",
    "guiSupported": true
  },
  {
    "name": "branch",
    "description": "Branch the current session (explore a different path)",
    "category": "Session",
    "aliases": [
      "fork"
    ],
    "argsHint": "[name]",
    "subcommands": [],
    "cliOnly": false,
    "gatewayOnly": false,
    "guiBehavior": null,
    "guiSupported": false
  },
  {
    "name": "compress",
    "description": "Manually compress conversation context",
    "category": "Session",
    "aliases": [],
    "argsHint": "[focus topic]",
    "subcommands": [],
    "cliOnly": false,
    "gatewayOnly": false,
    "guiBehavior": null,
    "guiSupported": false
  },
  {
    "name": "rollback",
    "description": "List or restore filesystem checkpoints",
    "category": "Session",
    "aliases": [],
    "argsHint": "[number]",
    "subcommands": [],
    "cliOnly": false,
    "gatewayOnly": false,
    "guiBehavior": null,
    "guiSupported": false
  },
  {
    "name": "snapshot",
    "description": "Create or restore state snapshots of Hermes config/state",
    "category": "Session",
    "aliases": [
      "snap"
    ],
    "argsHint": "[create|restore <id>|prune]",
    "subcommands": [],
    "cliOnly": false,
    "gatewayOnly": false,
    "guiBehavior": null,
    "guiSupported": false
  },
  {
    "name": "stop",
    "description": "Kill all running background processes",
    "category": "Session",
    "aliases": [],
    "argsHint": "",
    "subcommands": [],
    "cliOnly": false,
    "gatewayOnly": false,
    "guiBehavior": null,
    "guiSupported": false
  },
  {
    "name": "approve",
    "description": "Approve a pending dangerous command",
    "category": "Session",
    "aliases": [],
    "argsHint": "[session|always]",
    "subcommands": [],
    "cliOnly": false,
    "gatewayOnly": true,
    "guiBehavior": null,
    "guiSupported": false
  },
  {
    "name": "deny",
    "description": "Deny a pending dangerous command",
    "category": "Session",
    "aliases": [],
    "argsHint": "",
    "subcommands": [],
    "cliOnly": false,
    "gatewayOnly": true,
    "guiBehavior": null,
    "guiSupported": false
  },
  {
    "name": "background",
    "description": "Run a prompt in the background",
    "category": "Session",
    "aliases": [
      "bg"
    ],
    "argsHint": "<prompt>",
    "subcommands": [],
    "cliOnly": false,
    "gatewayOnly": false,
    "guiBehavior": null,
    "guiSupported": false
  },
  {
    "name": "btw",
    "description": "Ephemeral side question using session context (no tools, not persisted)",
    "category": "Session",
    "aliases": [],
    "argsHint": "<question>",
    "subcommands": [],
    "cliOnly": false,
    "gatewayOnly": false,
    "guiBehavior": null,
    "guiSupported": false
  },
  {
    "name": "queue",
    "description": "Queue a prompt for the next turn (doesn't interrupt)",
    "category": "Session",
    "aliases": [
      "q"
    ],
    "argsHint": "<prompt>",
    "subcommands": [],
    "cliOnly": false,
    "gatewayOnly": false,
    "guiBehavior": null,
    "guiSupported": false
  },
  {
    "name": "status",
    "description": "Show session info",
    "category": "Session",
    "aliases": [],
    "argsHint": "",
    "subcommands": [],
    "cliOnly": false,
    "gatewayOnly": false,
    "guiBehavior": "inspect:status",
    "guiSupported": true
  },
  {
    "name": "profile",
    "description": "Show active profile name and home directory",
    "category": "Info",
    "aliases": [],
    "argsHint": "",
    "subcommands": [],
    "cliOnly": false,
    "gatewayOnly": false,
    "guiBehavior": "inspect:profile",
    "guiSupported": true
  },
  {
    "name": "sethome",
    "description": "Set this chat as the home channel",
    "category": "Session",
    "aliases": [
      "set-home"
    ],
    "argsHint": "",
    "subcommands": [],
    "cliOnly": false,
    "gatewayOnly": true,
    "guiBehavior": null,
    "guiSupported": false
  },
  {
    "name": "resume",
    "description": "Resume a previously-named session",
    "category": "Session",
    "aliases": [],
    "argsHint": "[name]",
    "subcommands": [],
    "cliOnly": false,
    "gatewayOnly": false,
    "guiBehavior": null,
    "guiSupported": false
  },
  {
    "name": "config",
    "description": "Show current configuration",
    "category": "Configuration",
    "aliases": [],
    "argsHint": "",
    "subcommands": [],
    "cliOnly": true,
    "gatewayOnly": false,
    "guiBehavior": null,
    "guiSupported": false
  },
  {
    "name": "model",
    "description": "Switch model for this session",
    "category": "Configuration",
    "aliases": [],
    "argsHint": "[model] [--global]",
    "subcommands": [],
    "cliOnly": false,
    "gatewayOnly": false,
    "guiBehavior": "inspect:model",
    "guiSupported": true
  },
  {
    "name": "provider",
    "description": "Show available providers and current provider",
    "category": "Configuration",
    "aliases": [],
    "argsHint": "",
    "subcommands": [],
    "cliOnly": false,
    "gatewayOnly": false,
    "guiBehavior": "inspect:provider",
    "guiSupported": true
  },
  {
    "name": "personality",
    "description": "Set a predefined personality",
    "category": "Configuration",
    "aliases": [],
    "argsHint": "[name]",
    "subcommands": [],
    "cliOnly": false,
    "gatewayOnly": false,
    "guiBehavior": null,
    "guiSupported": false
  },
  {
    "name": "statusbar",
    "description": "Toggle the context/model status bar",
    "category": "Configuration",
    "aliases": [
      "sb"
    ],
    "argsHint": "",
    "subcommands": [],
    "cliOnly": true,
    "gatewayOnly": false,
    "guiBehavior": null,
    "guiSupported": false
  },
  {
    "name": "verbose",
    "description": "Cycle tool progress display: off -> new -> all -> verbose",
    "category": "Configuration",
    "aliases": [],
    "argsHint": "",
    "subcommands": [],
    "cliOnly": true,
    "gatewayOnly": false,
    "guiBehavior": null,
    "guiSupported": false
  },
  {
    "name": "yolo",
    "description": "Toggle YOLO mode (skip all dangerous command approvals)",
    "category": "Configuration",
    "aliases": [],
    "argsHint": "",
    "subcommands": [],
    "cliOnly": false,
    "gatewayOnly": false,
    "guiBehavior": null,
    "guiSupported": false
  },
  {
    "name": "reasoning",
    "description": "Manage reasoning effort and display",
    "category": "Configuration",
    "aliases": [],
    "argsHint": "[level|show|hide]",
    "subcommands": [
      "none",
      "minimal",
      "low",
      "medium",
      "high",
      "xhigh",
      "show",
      "hide",
      "on",
      "off"
    ],
    "cliOnly": false,
    "gatewayOnly": false,
    "guiBehavior": null,
    "guiSupported": false
  },
  {
    "name": "fast",
    "description": "Toggle fast mode \u2014 OpenAI Priority Processing / Anthropic Fast Mode (Normal/Fast)",
    "category": "Configuration",
    "aliases": [],
    "argsHint": "[normal|fast|status]",
    "subcommands": [
      "normal",
      "fast",
      "status",
      "on",
      "off"
    ],
    "cliOnly": false,
    "gatewayOnly": false,
    "guiBehavior": null,
    "guiSupported": false
  },
  {
    "name": "skin",
    "description": "Show or change the display skin/theme",
    "category": "Configuration",
    "aliases": [],
    "argsHint": "[name]",
    "subcommands": [],
    "cliOnly": true,
    "gatewayOnly": false,
    "guiBehavior": null,
    "guiSupported": false
  },
  {
    "name": "voice",
    "description": "Toggle voice mode",
    "category": "Configuration",
    "aliases": [],
    "argsHint": "[on|off|tts|status]",
    "subcommands": [
      "on",
      "off",
      "tts",
      "status"
    ],
    "cliOnly": false,
    "gatewayOnly": false,
    "guiBehavior": null,
    "guiSupported": false
  },
  {
    "name": "tools",
    "description": "Manage tools: /tools [list|disable|enable] [name...]",
    "category": "Tools & Skills",
    "aliases": [],
    "argsHint": "[list|disable|enable] [name...]",
    "subcommands": [],
    "cliOnly": true,
    "gatewayOnly": false,
    "guiBehavior": null,
    "guiSupported": false
  },
  {
    "name": "toolsets",
    "description": "List available toolsets",
    "category": "Tools & Skills",
    "aliases": [],
    "argsHint": "",
    "subcommands": [],
    "cliOnly": true,
    "gatewayOnly": false,
    "guiBehavior": null,
    "guiSupported": false
  },
  {
    "name": "skills",
    "description": "Search, install, inspect, or manage skills",
    "category": "Tools & Skills",
    "aliases": [],
    "argsHint": "",
    "subcommands": [
      "search",
      "browse",
      "inspect",
      "install"
    ],
    "cliOnly": true,
    "gatewayOnly": false,
    "guiBehavior": null,
    "guiSupported": false
  },
  {
    "name": "cron",
    "description": "Manage scheduled tasks",
    "category": "Tools & Skills",
    "aliases": [],
    "argsHint": "[subcommand]",
    "subcommands": [
      "list",
      "add",
      "create",
      "edit",
      "pause",
      "resume",
      "run",
      "remove"
    ],
    "cliOnly": true,
    "gatewayOnly": false,
    "guiBehavior": null,
    "guiSupported": false
  },
  {
    "name": "reload",
    "description": "Reload .env variables into the running session",
    "category": "Tools & Skills",
    "aliases": [],
    "argsHint": "",
    "subcommands": [],
    "cliOnly": false,
    "gatewayOnly": false,
    "guiBehavior": null,
    "guiSupported": false
  },
  {
    "name": "reload-mcp",
    "description": "Reload MCP servers from config",
    "category": "Tools & Skills",
    "aliases": [
      "reload_mcp"
    ],
    "argsHint": "",
    "subcommands": [],
    "cliOnly": false,
    "gatewayOnly": false,
    "guiBehavior": null,
    "guiSupported": false
  },
  {
    "name": "browser",
    "description": "Connect browser tools to your live Chrome via CDP",
    "category": "Tools & Skills",
    "aliases": [],
    "argsHint": "[connect|disconnect|status]",
    "subcommands": [
      "connect",
      "disconnect",
      "status"
    ],
    "cliOnly": true,
    "gatewayOnly": false,
    "guiBehavior": null,
    "guiSupported": false
  },
  {
    "name": "plugins",
    "description": "List installed plugins and their status",
    "category": "Tools & Skills",
    "aliases": [],
    "argsHint": "",
    "subcommands": [],
    "cliOnly": true,
    "gatewayOnly": false,
    "guiBehavior": null,
    "guiSupported": false
  },
  {
    "name": "commands",
    "description": "Browse all commands and skills (paginated)",
    "category": "Info",
    "aliases": [],
    "argsHint": "[page]",
    "subcommands": [],
    "cliOnly": false,
    "gatewayOnly": true,
    "guiBehavior": "panel:commands",
    "guiSupported": true
  },
  {
    "name": "help",
    "description": "Show available commands",
    "category": "Info",
    "aliases": [],
    "argsHint": "",
    "subcommands": [],
    "cliOnly": false,
    "gatewayOnly": false,
    "guiBehavior": "panel:commands",
    "guiSupported": true
  },
  {
    "name": "restart",
    "description": "Gracefully restart the gateway after draining active runs",
    "category": "Session",
    "aliases": [],
    "argsHint": "",
    "subcommands": [],
    "cliOnly": false,
    "gatewayOnly": true,
    "guiBehavior": null,
    "guiSupported": false
  },
  {
    "name": "usage",
    "description": "Show token usage and rate limits for the current session",
    "category": "Info",
    "aliases": [],
    "argsHint": "",
    "subcommands": [],
    "cliOnly": false,
    "gatewayOnly": false,
    "guiBehavior": "inspect:usage",
    "guiSupported": true
  },
  {
    "name": "insights",
    "description": "Show usage insights and analytics",
    "category": "Info",
    "aliases": [],
    "argsHint": "[days]",
    "subcommands": [],
    "cliOnly": false,
    "gatewayOnly": false,
    "guiBehavior": null,
    "guiSupported": false
  },
  {
    "name": "platforms",
    "description": "Show gateway/messaging platform status",
    "category": "Info",
    "aliases": [
      "gateway"
    ],
    "argsHint": "",
    "subcommands": [],
    "cliOnly": true,
    "gatewayOnly": false,
    "guiBehavior": null,
    "guiSupported": false
  },
  {
    "name": "paste",
    "description": "Check clipboard for an image and attach it",
    "category": "Info",
    "aliases": [],
    "argsHint": "",
    "subcommands": [],
    "cliOnly": true,
    "gatewayOnly": false,
    "guiBehavior": null,
    "guiSupported": false
  },
  {
    "name": "image",
    "description": "Attach a local image file for your next prompt",
    "category": "Info",
    "aliases": [],
    "argsHint": "<path>",
    "subcommands": [],
    "cliOnly": true,
    "gatewayOnly": false,
    "guiBehavior": null,
    "guiSupported": false
  },
  {
    "name": "update",
    "description": "Update Hermes Agent to the latest version",
    "category": "Info",
    "aliases": [],
    "argsHint": "",
    "subcommands": [],
    "cliOnly": false,
    "gatewayOnly": true,
    "guiBehavior": null,
    "guiSupported": false
  },
  {
    "name": "debug",
    "description": "Upload debug report (system info + logs) and get shareable links",
    "category": "Info",
    "aliases": [],
    "argsHint": "",
    "subcommands": [],
    "cliOnly": false,
    "gatewayOnly": false,
    "guiBehavior": null,
    "guiSupported": false
  },
  {
    "name": "quit",
    "description": "Exit the CLI",
    "category": "Exit",
    "aliases": [
      "exit",
      "q"
    ],
    "argsHint": "",
    "subcommands": [],
    "cliOnly": true,
    "gatewayOnly": false,
    "guiBehavior": null,
    "guiSupported": false
  }
] as SlashCommandDefinition[];

export function findCommand(name: string) {
  const normalized = name.toLowerCase().replace(/^\//, "");
  return TUI_COMMANDS.find((command) => command.name === normalized || command.aliases.includes(normalized)) ?? null;
}
