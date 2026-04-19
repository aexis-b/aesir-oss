"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import spinners from "unicode-animations";
import { Archive, ArrowCounterClockwise, CaretDown, CaretRight, Moon, NotePencil, Sun } from "@phosphor-icons/react";

import type { AgentId, ChatSession, ChatSessionSummary } from "@/lib/agents";
import { formatSessionSource, getAgent } from "@/lib/agents";
import {
  filterCommandMenuItems,
  getCommandInsertion,
  moveCommandSelection,
} from "@/lib/chat-command-menu";
import {
  buildComposerStatusItems,
  type CodexUsageSummary,
} from "@/lib/composer-status";
import { buildTransientFeedState } from "@/lib/chat-feed-state";
import { buildMentionDispatchPlan } from "@/lib/mention-dispatch";
import { TUI_COMMANDS, findCommand } from "@/lib/slash-commands";
import styles from "./chat-shell.module.css";

interface ChatShellProps {
  runtimeMode: string;
}

interface ChatProfile {
  id: string;
  name: string;
  displayName: string;
  accent: string;
  lightAccent: string;
  glyph: string;
  shortcut: string | null;
  home: string;
  sessionsPath: string;
  root: boolean;
}

interface ProfilesResponse {
  status: "ready" | "needs-setup" | "missing-hermes";
  install: {
    hermesHome: string;
    cliAvailable: boolean;
    homeExists: boolean;
    hermesBin: string | null;
  };
  profiles: ChatProfile[];
}

interface SessionsResponse {
  sessions: ChatSessionSummary[];
}

interface SessionResponse {
  session: ChatSession;
}

interface ChatResponse {
  session: ChatSession;
  disposition: "queued" | "started";
}

interface ProfileSettings {
  agentId: AgentId;
  profileName: string;
  home: string;
  model: string;
  provider: string;
  baseUrl: string;
  personality: string;
  skin: string;
  toolsets: string[];
  authProvider: string | null;
  authMode: string | null;
}

interface ProfileSettingsResponse {
  settings: ProfileSettings;
}

interface UsageLimitsResponse {
  summary: CodexUsageSummary;
}

interface AttachmentUploadResponse {
  path: string;
  name: string;
  mimeType: string;
}

type ThemeMode = "dark" | "light";

function getMentionQuery(value: string) {
  const match = value.match(/(?:^|\s)@([a-z0-9_-]*)$/i);
  return match?.[1]?.toLowerCase() ?? null;
}

function replaceMentionQuery(value: string, profileId: string) {
  return value.replace(/(^|\s)@[a-z0-9_-]*$/i, (_match, prefix) => `${prefix}@${profileId} `);
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function normalizeInlineText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function buildSessionPreview(messages: ChatSession["messages"]) {
  const latest = messages.at(-1);
  if (!latest) {
    return "No messages yet";
  }

  const normalized = normalizeInlineText(latest.content);
  const previewBody =
    normalized.length <= 72
      ? normalized
      : `${normalized.slice(0, 72).replace(/[\s.,:;!?-]+$/u, "")}…`;

  if (latest.role === "assistant" && latest.speakerName) {
    return `${latest.speakerName} · ${previewBody}`;
  }

  return previewBody;
}

function toSessionSummary(session: ChatSession): ChatSessionSummary {
  return {
    id: session.id,
    agentId: session.agentId,
    title: session.title,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    archived: session.archived,
    messageCount: session.messages.length,
    preview: buildSessionPreview(session.messages),
    source: session.source,
    readOnly: session.readOnly,
    externalSessionId: session.externalSessionId,
    runtimeSource: session.runtimeSource,
  };
}

function getPreferredSessionId(items: ChatSessionSummary[]) {
  return items.find((session) => !session.readOnly && !session.archived)?.id ?? null;
}

function resolveStoredSessionId(
  items: ChatSessionSummary[],
  storedSessionId?: string | null,
) {
  if (storedSessionId && items.some((session) => session.id === storedSessionId)) {
    return storedSessionId;
  }

  return getPreferredSessionId(items);
}

function isTextEntryTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target.isContentEditable) {
    return true;
  }

  return target.closest("input, textarea, select, [contenteditable='true']") instanceof HTMLElement;
}

function renderThreadSkeleton(frame: string, label: string) {
  return (
    <div className={styles.loadingCard}>
      <div className={styles.loadingHeader}>
        <span className={styles.loadingSpinner}>{frame}</span>
        <span>{label}</span>
      </div>
      <div className={styles.loadingLines}>
        <span className={styles.loadingLineLong} />
        <span className={styles.loadingLineShort} />
        <span className={styles.loadingLineLong} />
      </div>
    </div>
  );
}

export function ChatShell({ runtimeMode }: ChatShellProps) {
  const [profiles, setProfiles] = useState<ChatProfile[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [activeSession, setActiveSession] = useState<ChatSession | null>(null);
  const [draft, setDraft] = useState("");
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const [bootPhase, setBootPhase] = useState("Locating Hermes home…");
  const [bootFrameIndex, setBootFrameIndex] = useState(0);
  const [activityFrameIndex, setActivityFrameIndex] = useState(0);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [commandNotice, setCommandNotice] = useState<string | null>(null);
  const [profileSettings, setProfileSettings] = useState<ProfileSettings | null>(null);
  const [usageSummary, setUsageSummary] = useState<CodexUsageSummary | null>(null);
  const [appStatus, setAppStatus] = useState<ProfilesResponse["status"]>("missing-hermes");
  const [installInfo, setInstallInfo] = useState<ProfilesResponse["install"] | null>(null);
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const [archivedThreadsOpen, setArchivedThreadsOpen] = useState(false);
  const [readOnlyThreadsOpen, setReadOnlyThreadsOpen] = useState(false);
  const [selectedCommandIndex, setSelectedCommandIndex] = useState(0);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const [commandsOpen, setCommandsOpen] = useState(false);
  const [commandPaletteSuppressed, setCommandPaletteSuppressed] = useState(false);
  const [mentionPaletteSuppressed, setMentionPaletteSuppressed] = useState(false);
  const [focusTicket, setFocusTicket] = useState(0);
  const [optimisticSessionOverrides, setOptimisticSessionOverrides] = useState<Record<string, { archived: boolean; updatedAt: string }>>({});

  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const feedRef = useRef<HTMLDivElement | null>(null);
  const commandListRef = useRef<HTMLDivElement | null>(null);
  const commandRowRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const sessionsCacheRef = useRef(new Map<string, ChatSessionSummary[]>());
  const sessionDetailCacheRef = useRef(new Map<string, ChatSession>());
  const selectedAgentIdRef = useRef<string | null>(null);
  const shouldStickFeedToBottomRef = useRef(true);
  const lastFeedSessionIdRef = useRef<string | null>(null);
  const lastFeedMessageCountRef = useRef(0);
  const activeSessionRequestRef = useRef(0);
  const profileSettingsRequestRef = useRef(0);
  const usageSummaryRequestRef = useRef(0);

  const selectedProfile = useMemo(
    () => profiles.find((profile) => profile.id === selectedAgentId) ?? null,
    [profiles, selectedAgentId],
  );

  const displaySessions = useMemo(
    () =>
      sessions
        .map((session) => {
          const override = optimisticSessionOverrides[session.id];
          return override ? { ...session, archived: override.archived, updatedAt: override.updatedAt } : session;
        })
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
    [optimisticSessionOverrides, sessions],
  );

  const filteredSessions = useMemo(
    () => displaySessions.filter((session) => session.agentId === selectedAgentId),
    [displaySessions, selectedAgentId],
  );
  const activeLocalSessions = useMemo(
    () => filteredSessions.filter((session) => !session.readOnly && !session.archived),
    [filteredSessions],
  );
  const archivedSessions = useMemo(
    () => filteredSessions.filter((session) => !session.readOnly && session.archived),
    [filteredSessions],
  );
  const importedSessions = useMemo(
    () => filteredSessions.filter((session) => session.readOnly),
    [filteredSessions],
  );

  const normalizedDraft = draft.trimStart();
  const visibleCommands = useMemo(
    () => TUI_COMMANDS.filter((command) => command.guiSupported),
    [],
  );
  const commandMode = normalizedDraft.startsWith("/") && !commandPaletteSuppressed;
  const mentionQuery = getMentionQuery(draft);
  const mentionCandidates = useMemo(
    () =>
      mentionQuery !== null && !mentionPaletteSuppressed
        ? profiles.filter(
            (profile) =>
              profile.id !== selectedAgentId &&
              (mentionQuery.length === 0 ||
                profile.id.includes(mentionQuery) ||
                profile.displayName.toLowerCase().includes(mentionQuery)),
          )
        : [],
    [mentionPaletteSuppressed, mentionQuery, profiles, selectedAgentId],
  );
  const mentionMode = mentionCandidates.length > 0;
  const selectedMention = mentionCandidates[selectedMentionIndex] ?? mentionCandidates[0] ?? null;
  const commandPreview = useMemo(
    () => filterCommandMenuItems(visibleCommands, normalizedDraft),
    [normalizedDraft, visibleCommands],
  );
  const selectedCommand = commandPreview[selectedCommandIndex] ?? commandPreview[0] ?? null;
  const selectedCommandName = selectedCommand?.name ?? null;

  const activeRunState = activeSession?.runState ?? null;
  const activeSessionMessageCount = activeSession?.messages.length ?? 0;
  const activeSessionKey = activeSession?.id ?? null;
  const transientFeedState = useMemo(
    () =>
      buildTransientFeedState({
        pendingPrompt: null,
        queuedPrompts: activeRunState?.queuedPrompts ?? [],
        runTrace: activeRunState?.trace ?? null,
      }),
    [activeRunState],
  );
  const composerStatusItems = buildComposerStatusItems({
    session: activeSession,
    usage: usageSummary,
  });

  const activeAccent = theme === "light"
    ? (selectedProfile?.lightAccent ?? "#9270cf")
    : (selectedProfile?.accent ?? "#c5a6ff");
  const bootSpinner = spinners.braille;
  const bootFrame = bootSpinner.frames[bootFrameIndex % bootSpinner.frames.length] ?? "⠋";
  const activitySpinner = spinners.helix;
  const activityFrame = activitySpinner.frames[activityFrameIndex % activitySpinner.frames.length] ?? "⠋";
  const ThemeIcon = theme === "dark" ? Sun : Moon;
  const themeLabel = theme === "dark" ? "Light" : "Dark";

  const applySession = useCallback((session: ChatSession) => {
    sessionDetailCacheRef.current.set(session.id, session);
    setActiveSession(session);
    setSessions((current) => {
      const next = [...current];
      const summary = toSessionSummary(session);
      const index = next.findIndex((entry) => entry.id === session.id);
      if (index >= 0) {
        next[index] = summary;
      } else {
        next.unshift(summary);
      }
      const sorted = next.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
      sessionsCacheRef.current.set(session.agentId, sorted);
      return sorted;
    });
  }, []);

  const loadProfiles = useCallback(async () => {
    const response = await fetch("/api/profiles", { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Failed to load Hermes profiles");
    }

    const data = (await response.json()) as ProfilesResponse;
    setProfiles(data.profiles);
    setInstallInfo(data.install);
    setAppStatus(data.status);
    return data;
  }, []);

  const loadSessions = useCallback(async (agentId?: string) => {
    const query = agentId ? `?agentId=${encodeURIComponent(agentId)}` : "";
    const response = await fetch(`/api/sessions${query}`, { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Failed to load sessions");
    }

    const data = (await response.json()) as SessionsResponse;
    if (agentId) {
      sessionsCacheRef.current.set(agentId, data.sessions);
      if (agentId === selectedAgentIdRef.current) {
        setSessions(data.sessions);
      }
    } else {
      setSessions(data.sessions);
    }
    return data.sessions;
  }, []);

  const loadSession = useCallback(
    async (sessionId: string, showLoading = true) => {
      const requestId = activeSessionRequestRef.current + 1;
      activeSessionRequestRef.current = requestId;
      const cachedSession = sessionDetailCacheRef.current.get(sessionId) ?? null;
      if (!cachedSession && showLoading && !activeSession) {
        setLoadingConversation(true);
      }
      if (cachedSession) {
        setActiveSession(cachedSession);
      }

      try {
        const response = await fetch(`/api/sessions/${sessionId}`, { cache: "no-store" });
        if (!response.ok) {
          throw new Error("Failed to load session");
        }

        const data = (await response.json()) as SessionResponse;
        if (requestId === activeSessionRequestRef.current) {
          applySession(data.session);
        }
        return data.session;
      } finally {
        if (showLoading && requestId === activeSessionRequestRef.current) {
          setLoadingConversation(false);
        }
      }
    },
    [activeSession, applySession],
  );

  const loadProfileSettings = useCallback(async (agentId: string) => {
    const requestId = profileSettingsRequestRef.current + 1;
    profileSettingsRequestRef.current = requestId;
    const response = await fetch(`/api/profile-settings?agentId=${encodeURIComponent(agentId)}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      if (requestId === profileSettingsRequestRef.current) {
        setProfileSettings(null);
      }
      return null;
    }

    const data = (await response.json()) as ProfileSettingsResponse;
    if (requestId === profileSettingsRequestRef.current) {
      setProfileSettings(data.settings);
    }
    return data.settings;
  }, []);

  const loadUsageSummary = useCallback(async (agentId: string) => {
    const requestId = usageSummaryRequestRef.current + 1;
    usageSummaryRequestRef.current = requestId;
    const response = await fetch(`/api/usage-limits?agentId=${encodeURIComponent(agentId)}`, {
      cache: "no-store",
    });

    if (!response.ok) {
      if (requestId === usageSummaryRequestRef.current) {
        setUsageSummary(null);
      }
      return null;
    }

    const data = (await response.json()) as UsageLimitsResponse;
    if (requestId === usageSummaryRequestRef.current) {
      setUsageSummary(data.summary);
    }
    return data.summary;
  }, []);

  const handleSelectAgent = useCallback((agentId: string) => {
    setSelectedAgentId(agentId);
    setCommandsOpen(false);
    setCommandNotice(null);
    setFocusTicket((value) => value + 1);

    const focusComposer = (attempt = 0) => {
      const input = inputRef.current;
      if (input && !input.disabled) {
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
        return;
      }

      if (attempt < 4) {
        window.setTimeout(() => focusComposer(attempt + 1), 80);
      }
    };

    window.setTimeout(() => focusComposer(), 80);
  }, []);

  const handleNewSession = useCallback(async (agentId: string) => {
    const response = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ agentId }),
    });

    if (!response.ok) {
      throw new Error("Failed to create session");
    }

    const data = (await response.json()) as { session: ChatSession };
    await loadSessions(agentId);
    setSelectedAgentId(agentId);
    setActiveSessionId(data.session.id);
    setActiveSession(data.session);
    setDraft("");
    setCommandsOpen(false);
    setFocusTicket((value) => value + 1);
  }, [loadSessions]);

  async function handleRenameSession(title: string) {
    if (!activeSessionId) {
      throw new Error("No active session to rename");
    }

    const response = await fetch(`/api/sessions/${activeSessionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });

    if (!response.ok) {
      throw new Error("Failed to rename session");
    }

    const data = (await response.json()) as SessionResponse;
    applySession(data.session);
    setCommandNotice(`/title :: ${title}`);
  }

  async function handleArchiveSession(session: ChatSessionSummary, archived: boolean) {
    const previousSession = sessionDetailCacheRef.current.get(session.id) ?? null;
    const previousSummary = session;
    const updatedAt = new Date().toISOString();
    const optimisticSummary: ChatSessionSummary = {
      ...session,
      archived,
      updatedAt,
    };

    flushSync(() => {
      setOptimisticSessionOverrides((current) => ({
        ...current,
        [session.id]: { archived, updatedAt },
      }));

      setSessions((current) => {
        const next = current.map((entry) => (entry.id === session.id ? optimisticSummary : entry));
        const sorted = next.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
        if (selectedAgentId) {
          sessionsCacheRef.current.set(selectedAgentId, sorted);
        }
        return sorted;
      });

      if (session.id === activeSessionId) {
        setActiveSession((current) => (current ? { ...current, archived, updatedAt } : current));
      }

      if (archived) {
        setArchivedThreadsOpen(true);
      }
    });

    try {
      const response = await fetch(`/api/sessions/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived }),
      });

      if (!response.ok) {
        throw new Error(archived ? "Failed to archive thread" : "Failed to restore thread");
      }

      const data = (await response.json()) as SessionResponse;
      setOptimisticSessionOverrides((current) => {
        const next = { ...current };
        delete next[session.id];
        return next;
      });
      applySession(data.session);
      await loadSessions(selectedAgentId ?? undefined);
      setCommandNotice(archived ? `archived :: ${session.title}` : `restored :: ${session.title}`);
    } catch (error) {
      setOptimisticSessionOverrides((current) => {
        const next = { ...current };
        delete next[session.id];
        return next;
      });
      setSessions((current) => {
        const next = current.map((entry) => (entry.id === session.id ? previousSummary : entry));
        const sorted = next.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
        if (selectedAgentId) {
          sessionsCacheRef.current.set(selectedAgentId, sorted);
        }
        return sorted;
      });

      if (session.id === activeSessionId) {
        setActiveSession(previousSession);
      }

      throw error;
    }
  }

  async function handleUploadPastedImage(file: File) {
    const form = new FormData();
    form.append("image", file, file.name || "pasted-image.png");

    const response = await fetch("/api/attachments", {
      method: "POST",
      body: form,
    });

    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      throw new Error(data.error ?? "Failed to attach image");
    }

    const data = (await response.json()) as AttachmentUploadResponse;
    setDraft((current) => {
      const prefix = current.trimEnd();
      return `${prefix ? `${prefix}\n\n` : ""}Attached image: ${data.path}`;
    });
    setCommandNotice(`attached :: ${data.name}`);
    setFocusTicket((value) => value + 1);
  }

  async function handleMentionDispatch(message: string) {
    if (!selectedProfile) {
      return;
    }

    const dispatchPlan = buildMentionDispatchPlan(selectedProfile.id, selectedProfile.id, message);

    if (dispatchPlan.targetIds.length === 0) {
      return;
    }

    await Promise.all(
      dispatchPlan.targetIds.map(async (targetId) => {
        await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agentId: targetId,
            message: dispatchPlan.forwardedMessage,
          }),
        });
      }),
    );

    setCommandNotice(`dispatch :: ${dispatchPlan.targetIds.map((id) => `@${id}`).join(", ")}`);
  }

  async function handleSendMessage(explicitMessage?: string) {
    const message = (explicitMessage ?? draft).trim();
    if (!message) {
      return;
    }

    const wasWorking = activeRunState?.phase === "running";
    if (!explicitMessage) {
      setDraft("");
      setFocusTicket((value) => value + 1);
    }

    const dispatchPlan = buildMentionDispatchPlan(selectedProfile?.id ?? "profile", selectedProfile?.id ?? null, message);

    setSubmitting(true);
    setError(null);
    setCommandNotice(wasWorking ? `queued :: ${message}` : null);

    try {
      if (dispatchPlan.targetIds.length > 0) {
        await handleMentionDispatch(message);
        return;
      }

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: activeSessionId,
          agentId: selectedAgentId,
          message,
        }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? "Failed to send message");
      }

      const data = (await response.json()) as ChatResponse;
      applySession(data.session);
      setActiveSessionId(data.session.id);
      if (selectedAgentId) {
        await loadSessions(selectedAgentId);
      }
      if (data.disposition === "queued") {
        setCommandNotice(`queued :: ${message}`);
      }
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Failed to send message");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSlashCommand(rawCommand: string) {
    const match = rawCommand.trim().match(/^\/([^\s]+)\s*(.*)$/);
    if (!match) {
      return false;
    }

    const [, rawName, rawArgs] = match;
    const command = findCommand(rawName);
    if (!command) {
      setCommandNotice(`unknown command :: /${rawName}`);
      setCommandsOpen(true);
      setDraft("");
      return true;
    }

    const args = rawArgs.trim();

    if (command.name === "queue") {
      if (!args) {
        setCommandNotice("usage :: /queue <prompt>");
        return true;
      }

      setDraft("");
      setFocusTicket((value) => value + 1);
      setCommandNotice(activeRunState?.phase === "running" ? `/queue :: ${args}` : `/queue :: dispatching`);
      await handleSendMessage(args);
      return true;
    }

    switch (command.guiBehavior) {
      case "session:new":
        if (!selectedAgentId) {
          setCommandNotice("profile :: unavailable");
          return true;
        }
        await handleNewSession(selectedAgentId);
        setDraft("");
        return true;
      case "session:title":
        if (!args) {
          setCommandNotice("usage :: /title [name]");
          return true;
        }
        await handleRenameSession(args);
        setDraft("");
        return true;
      case "inspect:profile":
        if (!profileSettings) {
          setCommandNotice("profile :: unavailable");
          return true;
        }
        setCommandNotice(`profile :: ${profileSettings.profileName} · ${profileSettings.home}`);
        setDraft("");
        return true;
      case "inspect:model":
        if (!profileSettings) {
          setCommandNotice(`model :: ${runtimeMode}`);
          return true;
        }
        setCommandNotice(`model :: ${profileSettings.provider}/${profileSettings.model}`);
        setDraft("");
        return true;
      case "inspect:provider":
        if (!profileSettings) {
          setCommandNotice(`provider :: ${runtimeMode}`);
          return true;
        }
        setCommandNotice(
          `provider :: ${profileSettings.provider}${profileSettings.authProvider ? ` · auth ${profileSettings.authProvider}` : ""}`,
        );
        setDraft("");
        return true;
      case "inspect:status":
        setCommandNotice(
          `status :: ${selectedProfile?.displayName ?? "profile"} · ${activeSession?.readOnly ? "read-only" : activeSession?.runtimeSource ? "profile-backed" : "local"}`,
        );
        setDraft("");
        return true;
      default:
        setCommandNotice(`/${command.name} unavailable in GUI`);
        return true;
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      setLoadingProfiles(true);
      setBootPhase("Locating Hermes home…");
      setLoadingSessions(true);
      setError(null);

      try {
        const storedTheme = window.localStorage.getItem("aesir-theme");
        const nextTheme =
          storedTheme === "light" || storedTheme === "dark"
            ? storedTheme
            : window.matchMedia("(prefers-color-scheme: light)").matches
              ? "light"
              : "dark";
        setTheme(nextTheme);

        const storedAgent = window.localStorage.getItem("aesir-selected-agent");
        const storedSessionId = window.localStorage.getItem("aesir-active-session-id");
        setBootPhase("Discovering Hermes profiles…");
        const profileData = await loadProfiles();
        const initialAgent =
          profileData.profiles.find((profile) => profile.id === storedAgent)?.id ??
          profileData.profiles[0]?.id ??
          null;

        if (cancelled) {
          return;
        }

        setSelectedAgentId(initialAgent);
        if (!initialAgent) {
          setActiveSessionId(null);
          setActiveSession(null);
          return;
        }

        setBootPhase("Loading your first profile…");
        const loadedSessions = await loadSessions(initialAgent);
        if (cancelled) {
          return;
        }

        const preferredSessionId = resolveStoredSessionId(loadedSessions, storedSessionId);
        setActiveSessionId(preferredSessionId);
      } catch (bootError) {
        if (!cancelled) {
          setError(bootError instanceof Error ? bootError.message : "Failed to bootstrap app");
        }
      } finally {
        if (!cancelled) {
          setLoadingProfiles(false);
          setLoadingSessions(false);
        }
      }
    }

    void boot();
    return () => {
      cancelled = true;
    };
  }, [loadProfiles, loadSessions]);

  useEffect(() => {
    if (!(loadingProfiles && profiles.length === 0 && !selectedAgentId)) {
      return;
    }

    const timer = window.setInterval(() => {
      setBootFrameIndex((current) => (current + 1) % bootSpinner.frames.length);
    }, bootSpinner.interval);

    return () => window.clearInterval(timer);
  }, [bootSpinner.frames.length, bootSpinner.interval, loadingProfiles, profiles.length, selectedAgentId]);

  useEffect(() => {
    const shouldAnimate = loadingSessions || (loadingConversation && !activeSession) || activeRunState?.phase === "running";
    if (!shouldAnimate) {
      return;
    }

    const timer = window.setInterval(() => {
      setActivityFrameIndex((current) => (current + 1) % activitySpinner.frames.length);
    }, activitySpinner.interval);

    return () => window.clearInterval(timer);
  }, [activeRunState?.phase, activitySpinner.frames.length, activitySpinner.interval, activeSession, loadingConversation, loadingSessions]);

  useEffect(() => {
    selectedAgentIdRef.current = selectedAgentId;
  }, [selectedAgentId]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    window.localStorage.setItem("aesir-theme", theme);
  }, [theme]);

  useEffect(() => {
    if (selectedAgentId) {
      window.localStorage.setItem("aesir-selected-agent", selectedAgentId);
    }
  }, [selectedAgentId]);

  useEffect(() => {
    if (activeSessionId) {
      window.localStorage.setItem("aesir-active-session-id", activeSessionId);
      return;
    }

    window.localStorage.removeItem("aesir-active-session-id");
  }, [activeSessionId]);

  useEffect(() => {
    setArchivedThreadsOpen(false);
    setReadOnlyThreadsOpen(false);
  }, [selectedAgentId]);

  useEffect(() => {
    if (filteredSessions.some((session) => session.id === activeSessionId)) {
      return;
    }

    const nextSessionId = getPreferredSessionId(filteredSessions);
    setActiveSessionId(nextSessionId);
    if (!nextSessionId) {
      setActiveSession(null);
    }
  }, [activeSessionId, filteredSessions]);

  useEffect(() => {
    if (!activeSessionId) {
      setActiveSession(null);
      return;
    }

    void loadSession(activeSessionId).catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : "Failed to load session");
    });
  }, [activeSessionId, loadSession]);

  useEffect(() => {
    if (!selectedAgentId) {
      setProfileSettings(null);
      setUsageSummary(null);
      return;
    }

    setSessions(sessionsCacheRef.current.get(selectedAgentId) ?? []);
    void loadSessions(selectedAgentId).catch((sessionError) => {
      setError(sessionError instanceof Error ? sessionError.message : "Failed to load sessions");
    });
    void loadProfileSettings(selectedAgentId);
    void loadUsageSummary(selectedAgentId);
  }, [loadProfileSettings, loadSessions, loadUsageSummary, selectedAgentId]);

  useEffect(() => {
    if (activeSession?.readOnly) {
      setReadOnlyThreadsOpen(true);
    }
    if (activeSession?.archived) {
      setArchivedThreadsOpen(true);
    }
  }, [activeSession]);

  useEffect(() => {
    if (!focusTicket) {
      return;
    }

    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(
        inputRef.current.value.length,
        inputRef.current.value.length,
      );
    }, 60);
    return () => window.clearTimeout(timer);
  }, [focusTicket, activeSessionId]);

  useEffect(() => {
    if (!activeSession || activeSession.readOnly || activeSession.messages.length > 0) {
      return;
    }

    const timer = window.setTimeout(() => inputRef.current?.focus(), 40);
    return () => window.clearTimeout(timer);
  }, [activeSession]);

  useEffect(() => {
    if (selectedMentionIndex >= mentionCandidates.length) {
      setSelectedMentionIndex(0);
    }
  }, [mentionCandidates.length, selectedMentionIndex]);

  useEffect(() => {
    if (selectedCommandIndex >= commandPreview.length) {
      setSelectedCommandIndex(0);
    }
  }, [commandPreview.length, selectedCommandIndex]);

  useEffect(() => {
    if (!commandMode || !selectedCommandName) {
      return;
    }

    const list = commandListRef.current;
    const selected = commandRowRefs.current[selectedCommandName];
    if (!list || !selected) {
      return;
    }

    selected.scrollIntoView({ block: "nearest" });
  }, [commandMode, selectedCommandName]);

  useEffect(() => {
    if (!activeSessionId || activeRunState?.phase !== "running") {
      return;
    }

    const timer = window.setInterval(() => {
      void loadSession(activeSessionId, false).catch(() => undefined);
    }, 1200);

    return () => window.clearInterval(timer);
  }, [activeRunState?.phase, activeSessionId, loadSession]);

  useEffect(() => {
    if (!feedRef.current || !activeSessionKey || !activeSession) {
      lastFeedSessionIdRef.current = activeSessionKey;
      lastFeedMessageCountRef.current = activeSessionMessageCount;
      return;
    }

    const feed = feedRef.current;
    const sessionChanged = lastFeedSessionIdRef.current !== activeSessionKey;
    const messageCountIncreased = activeSessionMessageCount > lastFeedMessageCountRef.current;
    const shouldStick = sessionChanged || messageCountIncreased || shouldStickFeedToBottomRef.current;

    if (!shouldStick) {
      lastFeedSessionIdRef.current = activeSessionKey;
      lastFeedMessageCountRef.current = activeSessionMessageCount;
      return;
    }

    const frame = window.requestAnimationFrame(() => {
      feed.scrollTop = feed.scrollHeight;
      shouldStickFeedToBottomRef.current = true;
      lastFeedSessionIdRef.current = activeSessionKey;
      lastFeedMessageCountRef.current = activeSessionMessageCount;
    });

    return () => window.cancelAnimationFrame(frame);
  }, [activeSession, activeSessionKey, activeSessionMessageCount, activeRunState?.queuedPrompts?.length, transientFeedState.queueCards.length]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (isTextEntryTarget(event.target)) {
        return;
      }

      if (!event.altKey || event.metaKey || event.ctrlKey || event.shiftKey) {
        return;
      }

      if (event.code === "KeyN" && selectedAgentId) {
        event.preventDefault();
        void handleNewSession(selectedAgentId).catch((sessionError) => {
          setError(sessionError instanceof Error ? sessionError.message : "Failed to create session");
        });
        return;
      }

      const digitMatch = event.code.match(/^Digit([1-9])$/);
      if (!digitMatch) {
        return;
      }

      const index = Number(digitMatch[1]) - 1;
      const target = profiles[index];
      if (!target) {
        return;
      }

      event.preventDefault();
      handleSelectAgent(target.id);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleNewSession, handleSelectAgent, profiles, selectedAgentId]);

  if (loadingProfiles && profiles.length === 0 && !selectedAgentId) {
    return (
      <main className={styles.app}>
        <section className={styles.bootShell}>
          <div className={styles.bootMark}>✦</div>
          <div className={styles.bootCopy}>
            <span className={styles.bootTitle}>Aesir OSS</span>
            <p className={styles.bootDescription}>
              Connects to your local Hermes install and opens your real profiles and sessions.
            </p>
            <div className={styles.bootStatus} aria-live="polite" role="status">
              <span className={styles.bootSpinner}>{bootFrame}</span>
              <span>{bootPhase}</span>
            </div>
          </div>
        </section>
      </main>
    );
  }

  if (appStatus !== "ready" || profiles.length === 0) {
    return (
      <main className={styles.app}>
        <section className={styles.bootShell}>
          <div className={styles.bootMark}>✦</div>
          <div className={styles.bootCopy}>
            <span className={styles.bootTitle}>Aesir OSS</span>
            <p className={styles.bootDescription}>
              Connect Aesir OSS to your local Hermes install to discover profiles,
              sessions, and profile-backed chat.
            </p>
            <div className={styles.bootStatus}>
              <span className={styles.bootSpinner}>@</span>
              <span>
                {appStatus === "missing-hermes"
                  ? "Hermes not detected yet"
                  : "Hermes needs a little setup before this app can use it"}
              </span>
            </div>
            <div className={styles.bootActions}>
              <button
                className={styles.primaryButton}
                onClick={() => window.location.reload()}
                type="button"
              >
                Retry detection
              </button>
              <a
                className={styles.ghostButton}
                href="https://hermes-agent.nousresearch.com/docs/reference/cli-commands"
                rel="noreferrer"
                target="_blank"
              >
                Install Hermes
              </a>
            </div>
            <div className={styles.bootFacts}>
              <span>home :: {installInfo?.hermesHome ?? "~/.hermes"}</span>
              <span>cli :: {installInfo?.cliAvailable ? "found" : "missing"}</span>
              <span>config :: {installInfo?.homeExists ? "present" : "missing"}</span>
            </div>
          </div>
        </section>
      </main>
    );
  }

  function renderThreadCard(session: ChatSessionSummary) {
    const isActive = session.id === activeSessionId;
    const ArchiveToggleIcon = session.archived ? ArrowCounterClockwise : Archive;
    const archiveLabel = session.archived ? "Restore thread" : "Archive thread";

    return (
      <div className={styles.threadCard} key={session.id}>
        {!session.readOnly ? (
          <button
            aria-label={`${archiveLabel}: ${session.title}`}
            className={styles.threadActionButton}
            onClick={(event) => {
              event.stopPropagation();
              void handleArchiveSession(session, !session.archived).catch((archiveError) => {
                setError(
                  archiveError instanceof Error
                    ? archiveError.message
                    : session.archived
                      ? "Failed to restore thread"
                      : "Failed to archive thread",
                );
              });
            }}
            title={archiveLabel}
            type="button"
          >
            <ArchiveToggleIcon size={13} weight="regular" />
          </button>
        ) : null}
        <button
          className={`${styles.threadButton} ${isActive ? styles.threadButtonActive : ""} ${session.readOnly ? styles.threadButtonReadOnly : ""}`}
          onClick={() => {
            setActiveSessionId(session.id);
            setCommandsOpen(false);
          }}
          type="button"
        >
          <span className={styles.threadTop}>
            <span className={styles.threadTitle}>{session.title}</span>
            <span className={styles.threadTime}>{formatTimestamp(session.updatedAt)}</span>
          </span>
          <span className={styles.threadPreview}>{session.preview}</span>
        </button>
      </div>
    );
  }

  return (
    <main className={styles.app} style={{ ["--agent-accent" as string]: activeAccent }}>
      <div aria-hidden="true" className={styles.desktopChrome}>
        <div className={styles.desktopChromeSpacer} />
        <div className={styles.desktopChromeDrag} />
      </div>
      <section className={styles.window}>
        <aside className={styles.sidebar}>
          <div className={styles.sidebarHeader}>
            <span className={styles.brand}>Aesir</span>
          </div>

          <div className={styles.agentList}>
            {profiles.map((profile) => {
              const isActive = profile.id === selectedAgentId;
              return (
                <button
                  key={profile.id}
                  className={`${styles.agentButton} ${isActive ? styles.agentButtonActive : ""}`}
                  onClick={() => handleSelectAgent(profile.id)}
                  style={{ ["--agent-accent" as string]: theme === "light" ? profile.lightAccent : profile.accent }}
                  type="button"
                >
                  <span className={styles.agentMain}>
                    <span className={styles.agentIconWrap}>{profile.glyph}</span>
                    <span className={styles.agentCopy}>
                      <span className={styles.agentName}>{profile.displayName}</span>
                    </span>
                  </span>
                  <span className={styles.agentMeta}>
                    {profile.shortcut ? <span className={styles.shortcutBadge}>{profile.shortcut}</span> : null}
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        <aside className={styles.threadPane}>
          <div className={styles.threadToolbar}>
            <div className={styles.threadToolbarRow}>
              <button
                className={styles.primaryButton}
                onClick={() =>
                  selectedAgentId
                    ? void handleNewSession(selectedAgentId).catch((sessionError) => {
                        setError(
                          sessionError instanceof Error
                            ? sessionError.message
                            : "Failed to create session",
                        );
                      })
                    : undefined
                }
                type="button"
              >
                <NotePencil size={16} weight="regular" />
                <span>New thread</span>
              </button>
              <button
                aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
                className={`${styles.ghostButton} ${styles.themeButton}`}
                onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
                type="button"
              >
                <ThemeIcon size={15} weight="regular" />
                <span>{themeLabel}</span>
              </button>
            </div>
          </div>

          <div className={styles.threadList}>
            {loadingSessions && filteredSessions.length === 0 ? (
              <div className={styles.loadingStack}>
                {renderThreadSkeleton(
                  activityFrame,
                  `Loading ${selectedProfile?.displayName ?? "profile"} sessions…`,
                )}
              </div>
            ) : filteredSessions.length === 0 ? (
              <div className={styles.placeholder}>No threads</div>
            ) : (
              <>
                {activeLocalSessions.map((session) => renderThreadCard(session))}

                {archivedSessions.length > 0 ? (
                  <div className={styles.threadGroup}>
                    <button
                      className={`${styles.groupToggle} ${archivedThreadsOpen ? styles.groupToggleOpen : ""}`}
                      onClick={() => setArchivedThreadsOpen((current) => !current)}
                      type="button"
                    >
                      <span className={styles.groupToggleLabel}>
                        {archivedThreadsOpen ? (
                          <CaretDown size={12} weight="bold" />
                        ) : (
                          <CaretRight size={12} weight="bold" />
                        )}
                        <span>Archived Threads</span>
                      </span>
                      <span>{String(archivedSessions.length).padStart(2, "0")}</span>
                    </button>
                    {archivedThreadsOpen ? (
                      <div className={styles.groupList}>
                        {archivedSessions.map((session) => renderThreadCard(session))}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                {importedSessions.length > 0 ? (
                  <div className={styles.threadGroup}>
                    <button
                      className={`${styles.groupToggle} ${readOnlyThreadsOpen ? styles.groupToggleOpen : ""}`}
                      onClick={() => setReadOnlyThreadsOpen((current) => !current)}
                      type="button"
                    >
                      <span className={styles.groupToggleLabel}>
                        {readOnlyThreadsOpen ? (
                          <CaretDown size={12} weight="bold" />
                        ) : (
                          <CaretRight size={12} weight="bold" />
                        )}
                        <span>External Sessions</span>
                      </span>
                      <span>{String(importedSessions.length).padStart(2, "0")}</span>
                    </button>
                    {readOnlyThreadsOpen ? (
                      <div className={styles.groupList}>
                        {importedSessions.map((session) => renderThreadCard(session))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </>
            )}
          </div>
        </aside>

        <section className={styles.chatPane}>
          <header className={styles.chatHeader}>
            <div className={styles.chatIdentity}>
              <span className={styles.activeIcon}>{selectedProfile?.glyph ?? "◉"}</span>
              <span className={styles.chatName}>{selectedProfile?.displayName ?? "Profile"}</span>
            </div>
            <div className={styles.chatMeta}>
              {activeSession?.runtimeSource
                ? `${formatSessionSource(activeSession.runtimeSource)} · profile-backed`
                : profileSettings
                  ? `${profileSettings.provider}/${profileSettings.model}`
                  : runtimeMode}
            </div>
          </header>

          <div
            className={styles.feed}
            onScroll={(event) => {
              const feed = event.currentTarget;
              const distanceFromBottom = feed.scrollHeight - feed.scrollTop - feed.clientHeight;
              shouldStickFeedToBottomRef.current = distanceFromBottom <= 24;
            }}
            ref={feedRef}
          >
            {loadingConversation && !activeSession ? (
              <div className={styles.loadingStack}>
                {renderThreadSkeleton(
                  activityFrame,
                  `Loading ${selectedProfile?.displayName ?? "profile"} conversation…`,
                )}
              </div>
            ) : !activeSession ? (
              <div className={styles.starterCard}>
                <div className={styles.starterHeader}>
                  <span className={styles.messageSpeaker}>{selectedProfile?.displayName ?? "Profile"}</span>
                  <span>new thread</span>
                </div>
                <div className={styles.starterBody}>
                  <span className={styles.chatName}>Start a new thread</span>
                  <p>
                    Message {selectedProfile?.displayName ?? "this profile"} below to create it.
                    Imported threads stay read-only.
                  </p>
                </div>
              </div>
            ) : activeSession.messages.length ? (
              activeSession.messages.map((message) => {
                const speakerId = message.role === "assistant"
                  ? (message.speakerId ?? activeSession.agentId)
                  : activeSession.agentId;
                const speaker = getAgent(speakerId);
                const speakerName = message.role === "assistant"
                  ? (message.speakerName ?? speaker.name)
                  : "You";

                return (
                  <article
                    key={message.id}
                    className={`${styles.message} ${message.role === "assistant" ? styles.messageAssistant : styles.messageUser}`}
                    style={{ ["--message-accent" as string]: theme === "light" ? speaker.lightAccent : speaker.accent }}
                  >
                    <div className={styles.messageMeta}>
                      <span className={styles.messageSpeaker}>{speaker.glyph} {speakerName}</span>
                      <span>{formatTimestamp(message.createdAt)}</span>
                    </div>
                    <p className={styles.messageBody}>{message.content}</p>
                  </article>
                );
              })
            ) : (
              <div className={styles.placeholder}>No messages</div>
            )}

            {activeRunState?.trace && transientFeedState.activityLabel ? (
              <article
                className={`${styles.traceCard} ${activeRunState.trace.phase === "running" ? styles.traceCardRunning : styles.traceCardError}`}
              >
                <div className={styles.traceHeader}>
                  <span>{activeRunState.trace.title}</span>
                  <span>
                    {activeRunState.trace.phase === "running"
                      ? `${activityFrame} working`
                      : "error"}
                  </span>
                </div>
                <div className={styles.traceLines}>
                  <span>{transientFeedState.activityLabel}</span>
                </div>
              </article>
            ) : null}

            {transientFeedState.queueCards.length > 0 ? (
              <div className={styles.queueStack}>
                {transientFeedState.queueCards.map((item) => (
                  <article className={styles.queueMiniCard} key={item.id}>
                    <div className={styles.queueMiniMeta}>
                      <span>queued</span>
                      <span>{item.position}</span>
                    </div>
                    <p className={styles.queueMiniBody}>{item.content}</p>
                  </article>
                ))}
              </div>
            ) : null}
          </div>

          <div className={styles.composer}>
            <textarea
              ref={inputRef}
              id="chat-input"
              className={styles.input}
              disabled={activeSession?.readOnly}
              onChange={(event) => {
                setDraft(event.target.value);
                setCommandPaletteSuppressed(false);
                if (event.target.value.includes("@")) {
                  setMentionPaletteSuppressed(false);
                }
              }}
              onPaste={(event) => {
                const file = Array.from(event.clipboardData?.items ?? [])
                  .find((item) => item.type.startsWith("image/"))
                  ?.getAsFile();

                if (!file) {
                  return;
                }

                event.preventDefault();
                void handleUploadPastedImage(file).catch((uploadError) => {
                  setError(uploadError instanceof Error ? uploadError.message : "Failed to attach image");
                });
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setCommandsOpen(false);
                  setCommandPaletteSuppressed(true);
                  setMentionPaletteSuppressed(true);
                  setSelectedCommandIndex(0);
                  setSelectedMentionIndex(0);
                  return;
                }

                if (mentionMode && event.key === "ArrowDown") {
                  event.preventDefault();
                  setSelectedMentionIndex((current) => moveCommandSelection(current, 1, mentionCandidates.length));
                  return;
                }

                if (mentionMode && event.key === "ArrowUp") {
                  event.preventDefault();
                  setSelectedMentionIndex((current) => moveCommandSelection(current, -1, mentionCandidates.length));
                  return;
                }

                if (mentionMode && (event.key === "Tab" || event.key === "Enter")) {
                  event.preventDefault();
                  if (selectedMention) {
                    setDraft((current) => replaceMentionQuery(current, selectedMention.id));
                    setMentionPaletteSuppressed(false);
                    setSelectedMentionIndex(0);
                    setFocusTicket((value) => value + 1);
                  }
                  return;
                }

                if (commandMode && commandPreview.length > 0 && event.key === "ArrowDown") {
                  event.preventDefault();
                  setSelectedCommandIndex((current) => moveCommandSelection(current, 1, commandPreview.length));
                  return;
                }

                if (commandMode && commandPreview.length > 0 && event.key === "ArrowUp") {
                  event.preventDefault();
                  setSelectedCommandIndex((current) => moveCommandSelection(current, -1, commandPreview.length));
                  return;
                }

                if (commandMode && commandPreview.length > 0 && event.key === "Tab") {
                  event.preventDefault();
                  if (selectedCommand) {
                    setDraft(getCommandInsertion(selectedCommand));
                    setCommandsOpen(false);
                    setCommandPaletteSuppressed(false);
                    setSelectedCommandIndex(0);
                    setFocusTicket((value) => value + 1);
                  }
                  return;
                }

                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();

                  if (normalizedDraft.startsWith("/")) {
                    const partialName = normalizedDraft.slice(1).trim();
                    const exactCommand = partialName && !partialName.includes(" ") ? findCommand(partialName) : null;

                    if (
                      commandPreview.length > 0 &&
                      (!exactCommand || commandsOpen) &&
                      !normalizedDraft.includes(" ")
                    ) {
                      const command = selectedCommand ?? commandPreview[0];
                      if (command) {
                        setDraft(getCommandInsertion(command));
                        setCommandsOpen(false);
                        setCommandPaletteSuppressed(false);
                        setSelectedCommandIndex(0);
                        setFocusTicket((value) => value + 1);
                      }
                      return;
                    }

                    void handleSlashCommand(normalizedDraft).catch((commandError) => {
                      setError(commandError instanceof Error ? commandError.message : "Failed to run command");
                    });
                    return;
                  }

                  void handleSendMessage();
                }
              }}
              placeholder={
                activeSession?.readOnly
                  ? `Imported ${formatSessionSource(activeSession.source)} session — start a new local thread to continue.`
                  : commandMode
                    ? "Type a slash command…"
                    : `Message ${selectedProfile?.displayName ?? "profile"}`
              }
              rows={3}
              value={draft}
            />
            {mentionMode ? (
              <section className={styles.commandPalette}>
                <div className={styles.commandPaletteMeta}>
                  <span>@{mentionQuery ?? ""}</span>
                  <span>{mentionCandidates.length} profiles</span>
                </div>
                <div
                  className={styles.commandList}
                  role="listbox"
                  aria-label="Profiles"
                >
                  {mentionCandidates.map((profile, index) => (
                    <button
                      key={profile.id}
                      className={`${styles.commandRow} ${index === selectedMentionIndex ? styles.commandRowActive : ""}`}
                      onClick={() => {
                        setDraft((current) => replaceMentionQuery(current, profile.id));
                        setMentionPaletteSuppressed(false);
                        setSelectedMentionIndex(0);
                        setFocusTicket((value) => value + 1);
                      }}
                      type="button"
                    >
                      <span className={styles.commandRowPrimary}>
                        <span className={styles.commandName}>@{profile.id}</span>
                        <span className={styles.commandArgs}>{profile.displayName}</span>
                      </span>
                      <span className={styles.commandDescription}>
                        create a new thread for {profile.displayName} with this message
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            ) : commandMode ? (
              <section className={styles.commandPalette}>
                <div className={styles.commandPaletteMeta}>
                  <span>{normalizedDraft.startsWith("/") ? normalizedDraft : "/commands"}</span>
                  <span>{commandPreview.length} shown</span>
                </div>
                <div
                  className={styles.commandList}
                  role="listbox"
                  aria-label="Commands"
                  ref={commandListRef}
                >
                  {commandPreview.length > 0 ? (
                    commandPreview.map((command, index) => (
                      <button
                        key={command.name}
                        className={`${styles.commandRow} ${index === selectedCommandIndex ? styles.commandRowActive : ""}`}
                        onClick={() => {
                          setDraft(getCommandInsertion(command));
                          setCommandsOpen(false);
                          setCommandPaletteSuppressed(false);
                          setSelectedCommandIndex(0);
                          setFocusTicket((value) => value + 1);
                        }}
                        ref={(element) => {
                          commandRowRefs.current[command.name] = element;
                        }}
                        type="button"
                      >
                        <span className={styles.commandRowPrimary}>
                          <span className={styles.commandName}>/{command.name}</span>
                          {command.argsHint ? <span className={styles.commandArgs}>{command.argsHint}</span> : null}
                        </span>
                        <span className={styles.commandDescription}>{command.description}</span>
                      </button>
                    ))
                  ) : (
                    <div className={styles.commandEmpty}>No matching commands</div>
                  )}
                </div>
              </section>
            ) : null}
            {composerStatusItems.length > 0 ? (
              <div className={styles.statusBar}>
                {composerStatusItems.map((item) => (
                  <span className={styles.statusItem} key={item.label}>
                    <span className={styles.statusKey}>{item.label}</span>
                    <span className={styles.statusValue}>{item.value}</span>
                  </span>
                ))}
              </div>
            ) : null}
            <div className={styles.composerBottom}>
              <button
                className={styles.ghostButton}
                onClick={() => {
                  setCommandsOpen((current) => !current);
                  setCommandPaletteSuppressed(false);
                  setSelectedCommandIndex(0);
                  setFocusTicket((value) => value + 1);
                }}
                type="button"
              >
                / commands
              </button>
              <div className={styles.composerActions}>
                <span className={styles.composerMeta}>
                  {commandMode ? `${visibleCommands.length} commands` : (selectedProfile?.shortcut ?? "")}
                </span>
                <button
                  className={styles.sendButton}
                  disabled={submitting || !draft.trim() || !!activeSession?.readOnly}
                  onClick={() => {
                    if (normalizedDraft.startsWith("/")) {
                      void handleSlashCommand(normalizedDraft).catch((commandError) => {
                        setError(commandError instanceof Error ? commandError.message : "Failed to run command");
                      });
                      return;
                    }

                    void handleSendMessage();
                  }}
                  type="button"
                >
                  {commandMode ? "Run" : "Send"}
                </button>
              </div>
            </div>
            {commandNotice ? (
              <p aria-live="polite" className={styles.commandNotice} role="status">
                {commandNotice}
              </p>
            ) : null}
            {error ? (
              <p aria-live="assertive" className={styles.error} role="alert">
                {error}
              </p>
            ) : null}
          </div>
        </section>
      </section>
    </main>
  );
}
