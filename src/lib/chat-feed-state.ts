export interface FeedTrace {
  phase: "running" | "complete" | "error";
  title: string;
  lines: string[];
}

export interface QueueCard {
  id: string;
  content: string;
  position: number;
}

export interface TransientFeedState {
  pendingPrompt: string | null;
  queueCards: QueueCard[];
  activityLabel: string | null;
}

function compactTraceStatus(trace: FeedTrace | null) {
  if (!trace) {
    return null;
  }

  const statusLine = trace.lines.find((line) => line.startsWith("status :: "))?.replace(/^status ::\s*/, "").trim();

  if (statusLine === "waiting for model/tool activity") {
    return "thinking…";
  }

  if (statusLine) {
    return statusLine;
  }

  if (trace.phase === "running") {
    return "thinking…";
  }

  return trace.lines[0]?.trim() ?? null;
}

export function buildTransientFeedState(args: {
  pendingPrompt: string | null;
  queuedPrompts: string[];
  runTrace: FeedTrace | null;
}): TransientFeedState {
  return {
    pendingPrompt: args.pendingPrompt,
    queueCards: args.queuedPrompts.map((content, index) => ({
      id: `queued-${index}`,
      content,
      position: index + 1,
    })),
    activityLabel: compactTraceStatus(args.runTrace),
  };
}
