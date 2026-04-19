import type { ChatSession } from "@/lib/agents";
import { formatSessionSource } from "@/lib/agents";

interface UsageWindow {
  used_percent?: number;
  limit_window_seconds?: number;
  reset_after_seconds?: number;
}

interface UsageRateLimit {
  allowed?: boolean;
  limit_reached?: boolean;
  primary_window?: UsageWindow | null;
  secondary_window?: UsageWindow | null;
}

interface UsageCredits {
  unlimited?: boolean;
}

export interface CodexUsagePayload {
  plan_type?: string | null;
  rate_limit?: UsageRateLimit | null;
  credits?: UsageCredits | null;
}

export interface CodexUsageSummary {
  plan: string;
  primary: string | null;
  secondary: string | null;
  compact: string;
  state: "ok" | "blocked" | "unlimited" | "unavailable";
}

export interface ComposerStatusItem {
  label: "mode" | "ctx" | "limits";
  value: string;
}

function formatUsageWindow(seconds: number | undefined) {
  if (!seconds || seconds <= 0) {
    return null;
  }

  if (seconds % 86400 === 0) {
    return `${Math.floor(seconds / 86400)}d`;
  }

  if (seconds % 3600 === 0) {
    return `${Math.floor(seconds / 3600)}h`;
  }

  return seconds >= 86400 ? `${Math.floor(seconds / 86400)}d` : `${Math.floor(seconds / 3600)}h`;
}

function summarizeWindow(window: UsageWindow | null | undefined) {
  if (!window) {
    return null;
  }

  const windowLabel = formatUsageWindow(window.limit_window_seconds);
  const usedPercent = typeof window.used_percent === "number" ? `${window.used_percent}%` : null;
  const resetLabel = formatDurationCompact(window.reset_after_seconds ?? 0);

  if (!windowLabel || !usedPercent || !resetLabel) {
    return null;
  }

  return `${windowLabel} ${usedPercent} · ${resetLabel}`;
}

export function formatDurationCompact(seconds: number) {
  if (seconds <= 0) {
    return null;
  }

  if (seconds < 60) {
    return `${Math.floor(seconds)}s`;
  }

  if (seconds < 3600) {
    return `${Math.floor(seconds / 60)}m`;
  }

  if (seconds < 86400) {
    return `${Math.floor(seconds / 3600)}h`;
  }

  return `${Math.floor(seconds / 86400)}d`;
}

export function summarizeCodexUsage(payload: CodexUsagePayload | null | undefined): CodexUsageSummary {
  const plan = payload?.plan_type ?? "unknown";
  const primary = summarizeWindow(payload?.rate_limit?.primary_window);
  const secondary = summarizeWindow(payload?.rate_limit?.secondary_window);
  const unlimited = payload?.credits?.unlimited === true;
  const blocked = payload?.rate_limit?.limit_reached === true || payload?.rate_limit?.allowed === false;

  if (unlimited) {
    return {
      plan,
      primary: null,
      secondary: null,
      compact: "unlimited",
      state: "unlimited",
    };
  }

  if (primary || secondary) {
    return {
      plan,
      primary,
      secondary,
      compact: [primary, secondary].filter(Boolean).join(" / "),
      state: blocked ? "blocked" : "ok",
    };
  }

  return {
    plan,
    primary: null,
    secondary: null,
    compact: `plan ${plan}`,
    state: "unavailable",
  };
}

function buildContextValue(session: ChatSession) {
  const countLabel = `${session.messages.length} msgs`;

  if (session.readOnly) {
    return `${countLabel} · imported`;
  }

  if (session.externalSessionId) {
    return `${countLabel} · resume ${session.externalSessionId.slice(0, 8)}`;
  }

  return `${countLabel} · new thread`;
}

export function buildComposerStatusItems(args: {
  session: ChatSession | null;
  usage?: CodexUsageSummary | null;
}): ComposerStatusItem[] {
  if (!args.session) {
    return [];
  }

  const items: ComposerStatusItem[] = [
    { label: "ctx", value: buildContextValue(args.session) },
    { label: "limits", value: args.usage?.compact ?? "limits unavailable" },
  ];

  if (args.session.readOnly) {
    items.unshift({
      label: "mode",
      value: `read-only · ${formatSessionSource(args.session.source)}`,
    });
  } else if (!args.session.runtimeSource) {
    items.unshift({
      label: "mode",
      value: `local · ${formatSessionSource(args.session.source)}`,
    });
  }

  return items;
}
