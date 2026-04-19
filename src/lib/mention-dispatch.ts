function collapseWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function uniqueProfileIds(values: string[], currentProfileId: string | null) {
  return Array.from(
    new Set(
      values
        .map((value) => value.toLowerCase())
        .filter((value) => value.length > 0)
        .filter((value) => value !== currentProfileId),
    ),
  );
}

function collectMentionIds(value: string) {
  return Array.from(value.matchAll(/@([a-z0-9_-]+)/gi))
    .map((match) => match[1] ?? "")
    .filter(Boolean);
}

function parseLeadingMentionTargets(message: string) {
  const match = message.match(/^((?:@[a-z0-9_-]+(?:[\s,:;-]+|$))+)/i);
  if (!match) {
    return null;
  }

  return {
    targetIds: collectMentionIds(match[1]),
    body: message.slice(match[1].length).trim(),
  };
}

function parseImperativeMentionTargets(message: string) {
  const match = message.match(/^(?:please\s+)?(?:tell|ask|message|notify|ping)\s+((?:@[a-z0-9_-]+(?:[\s,:;-]+|$))+)(.*)$/i);
  if (!match) {
    return null;
  }

  const tail = match[2].trim().replace(/^(?:to|that)\s+/i, "").trim();
  return {
    targetIds: collectMentionIds(match[1]),
    body: tail,
  };
}

function buildForwardedMessage(senderProfileId: string, forwardedBody: string) {
  return forwardedBody.length > 0
    ? `Message from @${senderProfileId}: ${forwardedBody}`
    : `Message from @${senderProfileId}.`;
}

export interface MentionDispatchPlan {
  targetIds: string[];
  forwardedBody: string;
  forwardedMessage: string;
}

export function buildMentionDispatchPlan(
  senderProfileId: string,
  currentProfileId: string | null,
  message: string,
): MentionDispatchPlan {
  const raw = message.trim();
  const parsed = parseLeadingMentionTargets(raw) ?? parseImperativeMentionTargets(raw);
  const targetIds = uniqueProfileIds(parsed?.targetIds ?? [], currentProfileId);
  const forwardedBody = collapseWhitespace(parsed?.body ?? "");

  return {
    targetIds,
    forwardedBody,
    forwardedMessage: buildForwardedMessage(senderProfileId, forwardedBody),
  };
}
